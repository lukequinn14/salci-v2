import { notFound } from 'next/navigation';
import ShareCard from '@/components/pitcher/ShareCard';
import SalciGauge from '@/components/pitcher/SalciGauge';
import KLineChart from '@/components/pitcher/KLineChart';
import MetricTooltip from '@/components/ui/MetricTooltip';
import WatchlistButton from '@/components/pitcher/WatchlistButton';
import { getTeamLogoUrl } from '@/lib/mlb-api/logos';
import { GRADE_LABEL, GRADE_COLORS } from '@/lib/salci/grades';
import { createClient } from '@/lib/supabase/server';
import { getTodayStarters } from '@/lib/mlb-api/statsapi';
import {
  fetchStatcastCSV,
  computeArsenal,
  computeStuffPlusFromArsenal,
  computeLocationPlus,
  computeCswPct,
} from '@/lib/mlb-api/statcast';
import { computeSalci, SALCI_WEIGHTS } from '@/lib/salci/scoring';
import { getBookLineForPitcher } from '@/lib/odds/fetcher';
import type { Pitcher } from '@/types/pitcher';
import type { SalciScore } from '@/types/salci';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// ── Poisson helpers ───────────────────────────────────────────────────────────
const poissonGTE = (lambda: number, k: number): number => {
  let cdf = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i < k; i++) {
    cdf += term;
    term = (term * lambda) / (i + 1);
  }
  return Math.max(0, Math.min(1, 1 - cdf));
};

// ── Archetype classification ──────────────────────────────────────────────────
interface Archetype {
  label: string;
  description: string;
  color: string;
  quadrant: 'tl' | 'tr' | 'bl' | 'br' | 'center';
}

const classifyArchetype = (stuffPlus: number, locationPlus: number): Archetype => {
  const highStuff = stuffPlus >= 108;
  const highLoc = locationPlus >= 108;
  if (highStuff && highLoc)
    return { label: 'Electric Ace', description: 'Elite stuff and command — premium strikeout profile.', color: 'text-emerald-400', quadrant: 'tr' };
  if (highStuff && !highLoc)
    return { label: 'Power Pitcher', description: 'Stuff-heavy, aggressive approach — volatile but high ceiling.', color: 'text-sky-400', quadrant: 'tl' };
  if (!highStuff && highLoc)
    return { label: 'Command Artist', description: 'Fine control pitching to contact — limited K upside per SALCI.', color: 'text-amber-400', quadrant: 'br' };
  if (stuffPlus < 95 && locationPlus < 95)
    return { label: 'Crafty / Contact', description: 'Below average both axes — avoid for strikeout props.', color: 'text-red-400', quadrant: 'bl' };
  return { label: 'Balanced', description: 'Solid across both axes — moderate strikeout projection.', color: 'text-zinc-300', quadrant: 'center' };
};

interface CachedScoreRow {
  salci_total: number;
  stuff_score: number;
  location_score: number;
  matchup_score: number;
  workload_score: number;
  grade: string;
  floor_ks: number;
  ceiling_ks: number;
  expected_ks: number;
  buffer: number;
  recommend_over: boolean;
  book_line: number | null;
  opponent: string | null;
  is_home: boolean | null;
  pitchers: {
    name: string | null;
    team: string | null;
    handedness: string | null;
    stuff_plus: number | null;
    location_plus: number | null;
    csw_pct: number | null;
    era: number | null;
    whip: number | null;
    k_per_9: number | null;
  } | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PitcherDetailPage({ params }: PageProps) {
  const { id } = await params;
  const pitcherId = parseInt(id);
  if (isNaN(pitcherId)) notFound();

  const gameDate = today();
  const supabase = await createClient();

  const { data: cached } = await supabase
    .from('daily_salci_scores')
    .select(`
      salci_total, stuff_score, location_score, matchup_score, workload_score,
      grade, floor_ks, ceiling_ks, expected_ks, buffer, recommend_over, book_line,
      opponent, is_home,
      pitchers (name, team, handedness, stuff_plus, location_plus, csw_pct, era, whip, k_per_9)
    `)
    .eq('pitcher_id', pitcherId)
    .eq('game_date', gameDate)
    .single() as { data: CachedScoreRow | null };

  if (cached) {
    const p = cached.pitchers;
    const bookLine = cached.book_line ?? 5.5;
    const salci: SalciScore = {
      total: cached.salci_total,
      stuff: cached.stuff_score,
      location: cached.location_score,
      matchup: cached.matchup_score,
      workload: cached.workload_score,
      grade: cached.grade as SalciScore['grade'],
      floor: cached.floor_ks,
      ceiling: cached.ceiling_ks,
      expectedKs: cached.expected_ks,
      buffer: cached.buffer,
      recommendOver: cached.recommend_over,
    };
    const pitcher: Pitcher = {
      id: pitcherId,
      name: p?.name ?? `Pitcher #${id}`,
      team: p?.team ?? '—',
      opponent: cached.opponent ?? '—',
      isHome: cached.is_home ?? false,
      handedness: ((p?.handedness ?? 'R') as 'L' | 'R'),
      gameDate,
      era: p?.era ?? 0,
      whip: p?.whip ?? 0,
      kPer9: p?.k_per_9 ?? 0,
      stuffPlus: p?.stuff_plus ?? 100,
      locationPlus: p?.location_plus ?? 100,
      cswPct: p?.csw_pct ?? 0.29,
      salci,
    };
    return <DetailPage pitcher={pitcher} salci={salci} bookLine={bookLine} stuffPlus={pitcher.stuffPlus} locationPlus={pitcher.locationPlus} cswPct={pitcher.cswPct} arsenal={{}} />;
  }

  // ── Slow path: live Statcast fallback ─────────────────────────────────────
  const starters = await getTodayStarters(gameDate);
  const start = starters.find((s) => s.pitcher.id === pitcherId);
  const bookLine = start ? await getBookLineForPitcher(start.pitcher.fullName) : 5.5;

  const rows = await fetchStatcastCSV(pitcherId, daysAgo(30), gameDate, 8000, start?.pitcher.fullName);

  let stuffPlus = 100;
  let locationPlus = 100;
  let cswPct = 0.29;
  let arsenal = {};

  if (rows.length > 0) {
    cswPct = computeCswPct(rows);
    arsenal = computeArsenal(rows);
    stuffPlus = computeStuffPlusFromArsenal(arsenal, cswPct);
    locationPlus = computeLocationPlus(rows);
  }

  const salci = computeSalci({
    stuffPlus,
    locationPlus,
    matchupScore: 50,
    workloadScore: 50,
    projectedIP: 5.5,
    bookLine,
  });

  const pitcher: Pitcher = {
    id: pitcherId,
    name: start?.pitcher.fullName ?? `Pitcher #${id}`,
    team: start?.teamAbbr ?? '—',
    opponent: start?.opponentAbbr ?? '—',
    isHome: start?.isHome ?? false,
    handedness: 'R',
    gameDate,
    era: 0,
    whip: 0,
    kPer9: 0,
    stuffPlus,
    locationPlus,
    cswPct,
    salci,
  };

  return <DetailPage pitcher={pitcher} salci={salci} bookLine={bookLine} stuffPlus={stuffPlus} locationPlus={locationPlus} cswPct={cswPct} arsenal={arsenal} />;
}

// ── Shared render component ───────────────────────────────────────────────────

interface DetailPageProps {
  pitcher: Pitcher;
  salci: SalciScore;
  bookLine: number;
  stuffPlus: number;
  locationPlus: number;
  cswPct: number;
  arsenal: Record<string, unknown>;
}

const DetailPage = ({ pitcher, salci, bookLine, stuffPlus, locationPlus, cswPct, arsenal }: DetailPageProps) => {
  const weightLabels = [
    { label: 'Stuff',    score: salci.stuff,    weight: SALCI_WEIGHTS.stuff,    color: 'bg-emerald-500', tooltip: 'Measures whiff power, arsenal quality, and CSW%. The primary driver of the SALCI score at 52% weight.' },
    { label: 'Matchup',  score: salci.matchup,  weight: SALCI_WEIGHTS.matchup,  color: 'bg-sky-500',     tooltip: "Opponent K-propensity and zone contact rate. Higher = facing a strikeout-prone lineup." },
    { label: 'Workload', score: salci.workload, weight: SALCI_WEIGHTS.workload, color: 'bg-violet-500',  tooltip: 'Opportunity ceiling based on projected innings. More outs = more chances for strikeouts.' },
    { label: 'Location', score: salci.location, weight: SALCI_WEIGHTS.location, color: 'bg-zinc-500',    tooltip: 'Intentionally de-weighted. Extreme command hurts K prediction — fine control pitchers pitch to contact, not whiffs.' },
  ];

  const archetype = classifyArchetype(stuffPlus, locationPlus);

  // Quadrant dot position — stuff+ on Y (high=up), location+ on X (high=right)
  const dotX = Math.min(95, Math.max(5, ((locationPlus - 70) / 60) * 100));
  const dotY = Math.min(95, Math.max(5, 100 - ((stuffPlus - 70) / 60) * 100));

  // K-line probability table
  const lambda = salci.expectedKs;
  const kLines = [salci.floor, salci.floor + 1, salci.floor + 2, salci.floor + 3].map((k) => ({
    k,
    prob: poissonGTE(lambda, k),
    isBookLine: k === Math.ceil(bookLine),
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Hero */}
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center bg-white rounded-full w-12 h-12 shadow-sm shrink-0">
          <img
            src={getTeamLogoUrl(pitcher.team)}
            alt={pitcher.team}
            className="w-9 h-9 object-contain"
          />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-zinc-100">{pitcher.name}</h1>
          <p className="text-sm text-zinc-500">
            {pitcher.team} {pitcher.isHome ? 'vs' : '@'} {pitcher.opponent} · {pitcher.gameDate}
          </p>
        </div>
        <WatchlistButton pitcherId={pitcher.id} size="md" />
      </div>

      {/* SALCI overview */}
      <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <SalciGauge salci={salci} size={140} />
        <p className={`text-sm font-semibold ${GRADE_COLORS[salci.grade]}`}>
          {GRADE_LABEL[salci.grade]}
        </p>
        <p className="text-xs text-zinc-600 text-center max-w-xs">
          SALCI measures strikeout probability. 80+ = strong over play. Floor-minus-2 rule enforced.
        </p>
      </div>

      {/* K projection */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-3">Strikeout Projection</h2>
        <KLineChart salci={salci} bookLine={bookLine} />
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
          <span>Book line: <span className="text-amber-400 font-medium">{bookLine}</span></span>
          <span className={salci.recommendOver ? 'text-emerald-400 font-semibold' : ''}>
            {salci.recommendOver
              ? `✓ Play OVER (floor ${salci.floor} ≥ line + 2)`
              : `Floor ${salci.floor} — no edge`}
          </span>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Score Breakdown</h2>
        <div className="flex flex-col gap-3">
          {weightLabels.map(({ label, score, weight, color, tooltip }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-20 flex items-center gap-1">
                <span className="text-sm text-zinc-400">{label}</span>
                <MetricTooltip text={tooltip} />
              </div>
              <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(score)}%` }} />
              </div>
              <span className="w-8 text-right text-sm font-semibold text-zinc-300">{Math.round(score)}</span>
              <span className="w-10 text-right text-xs text-zinc-600">{(weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-500 border-t border-zinc-800 pt-3">
          <div className="flex items-center gap-1">
            <span>Stuff+</span>
            <MetricTooltip text="A scaled index of pitch quality and whiff generation. Above 100 = above league average. Drives 52% of SALCI." />
            <span className="text-zinc-300 font-medium ml-auto">{Math.round(stuffPlus)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Location+</span>
            <MetricTooltip text="A scaled index of command precision. Note: extremely high Location+ can hurt SALCI — fine control pitchers induce weak contact, not strikeouts." />
            <span className="text-zinc-300 font-medium ml-auto">{Math.round(locationPlus)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>CSW%</span>
            <MetricTooltip text="Called Strikes + Whiffs divided by total pitches. Elite starters typically exceed 30%. The single strongest raw predictor of strikeout rate." />
            <span className="text-zinc-300 font-medium ml-auto">{(cswPct * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Volatility</span>
            <MetricTooltip text="The spread multiplier applied to floor/ceiling. Driven by the gap between Stuff+ and Location+. Wider gap = higher ceiling but lower floor." />
            <span className="text-zinc-300 font-medium ml-auto">{salci.buffer.toFixed(2)}×</span>
          </div>
        </div>
      </div>

      {/* Archetype Classification */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-zinc-300">Pitcher Archetype</h2>
          <MetricTooltip text="Classified from Stuff+ vs Location+ axes. SALCI favors stuff-heavy archetypes. Command Artists are penalized — high command signals pitching to contact, not chasing strikeouts." />
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* 2x2 quadrant */}
          <div className="relative w-48 h-48 shrink-0 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-950">
            {/* Quadrant backgrounds */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              <div className="border-r border-b border-zinc-800 flex items-center justify-center">
                <span className="text-[9px] text-sky-500/50 font-semibold">POWER</span>
              </div>
              <div className="border-b border-zinc-800 flex items-center justify-center">
                <span className="text-[9px] text-emerald-500/50 font-semibold">ELECTRIC</span>
              </div>
              <div className="border-r border-zinc-800 flex items-center justify-center">
                <span className="text-[9px] text-red-500/40 font-semibold">CRAFTY</span>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-[9px] text-amber-500/50 font-semibold">COMMAND</span>
              </div>
            </div>
            {/* Axis labels */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-zinc-600">Location+ →</div>
            <div className="absolute top-1/2 left-1 -translate-y-1/2 -rotate-90 text-[8px] text-zinc-600">Stuff+ ↑</div>
            {/* Pitcher dot */}
            <div
              className="absolute w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-emerald-400/40 shadow-lg z-10"
              style={{ left: `${dotX}%`, top: `${dotY}%`, transform: 'translate(-50%, -50%)' }}
              title={`${pitcher.name}`}
            />
          </div>
          {/* Label + description */}
          <div className="flex flex-col gap-2 justify-center">
            <span className={`text-lg font-bold ${archetype.color}`}>{archetype.label}</span>
            <p className="text-xs text-zinc-400 leading-relaxed">{archetype.description}</p>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span>Stuff+ <span className="text-zinc-300 font-medium">{Math.round(stuffPlus)}</span></span>
              <span>Location+ <span className="text-zinc-300 font-medium">{Math.round(locationPlus)}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* K-Line Probability Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-zinc-300">K-Line Probability</h2>
          <MetricTooltip text="Poisson-approximated probability of reaching each strikeout total. Based on the SALCI expected K projection (λ). Highlighted row = nearest book line." />
        </div>
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-800/50 text-zinc-500">
                <th className="text-left px-4 py-2 font-medium">K Target</th>
                <th className="text-left px-4 py-2 font-medium">Probability</th>
                <th className="px-4 py-2 font-medium text-right">Bar</th>
              </tr>
            </thead>
            <tbody>
              {kLines.map(({ k, prob, isBookLine }) => (
                <tr
                  key={k}
                  className={isBookLine ? 'bg-amber-500/10 border-l-2 border-amber-500' : 'border-b border-zinc-800/60 last:border-0'}
                >
                  <td className="px-4 py-2.5 font-semibold text-zinc-200">
                    {k}+ Ks
                    {isBookLine && <span className="ml-2 text-[9px] text-amber-400 font-bold">BOOK</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-bold ${prob >= 0.65 ? 'text-emerald-400' : prob >= 0.45 ? 'text-amber-400' : 'text-red-400'}`}>
                      {(prob * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      <div className="w-24 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${prob >= 0.65 ? 'bg-emerald-500' : prob >= 0.45 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${(prob * 100).toFixed(0)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600">λ = {lambda.toFixed(2)} expected Ks · Poisson model</p>
      </div>

      {/* Arsenal — only shown on live Statcast path */}
      {Object.keys(arsenal).length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3">Arsenal (Last 30 Days)</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(arsenal).map(([pitchType, data]) => (
              <div key={pitchType} className="rounded-lg bg-zinc-800/60 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-zinc-300">{pitchType}</span>
                  <span className="text-xs text-zinc-500">{((data as { usage: number }).usage * 100).toFixed(0)}%</span>
                </div>
                <div className="text-xs text-zinc-500">
                  <div>{(data as { avgSpeed: number }).avgSpeed.toFixed(1)} mph</div>
                  <div>Whiff {((data as { whiffRate: number }).whiffRate * 100).toFixed(0)}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Share Card</h2>
        <ShareCard pitcher={pitcher} bookLine={bookLine} />
      </div>
    </div>
  );
};
