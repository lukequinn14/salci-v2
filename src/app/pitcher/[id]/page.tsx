import { notFound } from 'next/navigation';
import ShareCard from '@/components/pitcher/ShareCard';
import SalciGauge from '@/components/pitcher/SalciGauge';
import KLineChart from '@/components/pitcher/KLineChart';
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

  // ── Fast path: read from pre-computed cache ───────────────────────────────
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
    stuffPlus, locationPlus, cswPct,
    oppKPct: 0.22, oppZoneContact: 0.82, sameSidePct: 0.5,
    pPerIP: 16, projectedBF: 21, managerLeash: 70, tttKDrop: 1,
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
    { label: 'Stuff',    score: salci.stuff,    weight: SALCI_WEIGHTS.stuff,    color: 'bg-emerald-500' },
    { label: 'Matchup',  score: salci.matchup,  weight: SALCI_WEIGHTS.matchup,  color: 'bg-sky-500' },
    { label: 'Workload', score: salci.workload, weight: SALCI_WEIGHTS.workload, color: 'bg-violet-500' },
    { label: 'Location', score: salci.location, weight: SALCI_WEIGHTS.location, color: 'bg-zinc-500' },
  ];

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
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">{pitcher.name}</h1>
          <p className="text-sm text-zinc-500">
            {pitcher.team} {pitcher.isHome ? 'vs' : '@'} {pitcher.opponent} · {pitcher.gameDate}
          </p>
        </div>
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

      {/* Component breakdown */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-sm font-semibold text-zinc-300 mb-4">Score Breakdown</h2>
        <div className="flex flex-col gap-3">
          {weightLabels.map(({ label, score, weight, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-16 text-sm text-zinc-400">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round(score)}%` }} />
              </div>
              <span className="w-8 text-right text-sm font-semibold text-zinc-300">{Math.round(score)}</span>
              <span className="w-10 text-right text-xs text-zinc-600">{(weight * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-500 border-t border-zinc-800 pt-3">
          <div>Stuff+ <span className="text-zinc-300 font-medium">{Math.round(stuffPlus)}</span></div>
          <div>Location+ <span className="text-zinc-300 font-medium">{Math.round(locationPlus)}</span></div>
          <div>CSW% <span className="text-zinc-300 font-medium">{(cswPct * 100).toFixed(1)}%</span></div>
          <div>Volatility buffer <span className="text-zinc-300 font-medium">{salci.buffer.toFixed(2)}×</span></div>
        </div>
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
