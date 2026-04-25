'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ReferenceLine,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis,
} from 'recharts';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, Star, Search, X } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import RadarCompare from '@/components/analytics/RadarCompare';
import ParlayCardGenerator from '@/components/analytics/ParlayCardGenerator';
import { getTeamLogoUrl } from '@/lib/mlb-api/logos';
import TeamLogo from '@/components/ui/TeamLogo';
import { GRADE_COLORS, GRADE_BG_COLORS } from '@/lib/salci/grades';
import type { TeamPitchingStats, PitchingMetric, DateRange } from '@/types/results';
import type { Pitcher } from '@/types/pitcher';

// ── constants ──────────────────────────────────────────────────────────────────

const METRICS: { key: PitchingMetric; label: string; desc: string; lowerIsBetter: boolean }[] = [
  { key: 'era',   label: 'ERA',  desc: 'Earned Run Average',            lowerIsBetter: true },
  { key: 'fip',   label: 'FIP',  desc: 'Fielding Independent Pitching', lowerIsBetter: true },
  { key: 'kPct',  label: 'K%',   desc: 'Strikeout Rate',                lowerIsBetter: false },
  { key: 'whip',  label: 'WHIP', desc: 'Walks + Hits per IP',           lowerIsBetter: true },
  { key: 'bbPct', label: 'BB%',  desc: 'Walk Rate',                     lowerIsBetter: true },
];

const RANGES: { key: DateRange; label: string }[] = [
  { key: 'season', label: 'Season' },
  { key: '30d',    label: 'L30' },
  { key: '14d',    label: 'L14' },
  { key: '7d',     label: 'L7' },
];

const METRIC_FMT: Record<PitchingMetric, (v: number) => string> = {
  era: (v) => v.toFixed(2), fip: (v) => v.toFixed(2),
  kPct: (v) => `${v.toFixed(1)}%`, whip: (v) => v.toFixed(2),
  bbPct: (v) => `${v.toFixed(1)}%`,
};

const PITCHER_COLORS = ['#34d399', '#38bdf8', '#a78bfa', '#fb923c'];

// ── scatter plot dot — foreignObject works for scatter (not bar tick) ──────────

interface ScatterPoint { x: number; y: number; z: number; abbr: string }

const TeamLogoDot = (props: unknown) => {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScatterPoint };
  const size = 28;
  return (
    <g style={{ cursor: 'pointer' }}>
      <foreignObject x={cx - size / 2} y={cy - size / 2} width={size} height={size}>
        <img
          src={getTeamLogoUrl(payload.abbr, false)}
          width={size}
          height={size}
          style={{ objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
      </foreignObject>
      <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} fill="transparent" />
    </g>
  );
};

// ── custom HTML bar chart — logos rendered as HTML img, not SVG foreignObject ──

interface BarTooltipState { abbr: string; value: number; left: number; top: number }

const HtmlBarChart = ({
  data, metric, leagueAvg, highlightedTeams, focusTeam, onBarClick, onToggleHighlight,
}: {
  data: TeamPitchingStats[];
  metric: PitchingMetric;
  leagueAvg: number;
  highlightedTeams: Set<string>;
  focusTeam: string | null;
  onBarClick: (t: TeamPitchingStats) => void;
  onToggleHighlight: (abbr: string) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<BarTooltipState | null>(null);

  const maxVal = useMemo(() =>
    Math.max(...data.map((d) => d[metric] as number), leagueAvg * 1.1, 0.01),
    [data, metric, leagueAvg]
  );
  const avgPct = Math.min(98, (leagueAvg / maxVal) * 100);

  const barFill = (abbr: string) => {
    if (highlightedTeams.size === 0) return '#34d399';
    return highlightedTeams.has(abbr) ? '#34d399' : '#3f3f46';
  };
  const barOpacity = (abbr: string) =>
    highlightedTeams.size > 0 && !highlightedTeams.has(abbr) ? 0.3 : 1;

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, team: TeamPitchingStats) => {
    if (!containerRef.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const parent = containerRef.current.getBoundingClientRect();
    setTooltip({
      abbr: team.abbr,
      value: team[metric] as number,
      left: rect.left - parent.left + rect.width / 2,
      top: rect.top - parent.top - 8,
    });
  };

  return (
    <div ref={containerRef} className="relative select-none">
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-30 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs shadow-xl pointer-events-none"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <TeamLogo abbr={tooltip.abbr} size={14} darkBg={false} />
            <p className="font-semibold text-zinc-200">{tooltip.abbr}</p>
          </div>
          <p className="text-emerald-400 font-bold">{METRIC_FMT[metric](tooltip.value)}</p>
        </div>
      )}

      {/* Bar chart area */}
      <div className="relative flex items-end gap-px" style={{ height: 200 }}>
        {/* League average reference line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-zinc-600 pointer-events-none z-10"
          style={{ bottom: `${avgPct}%` }}
        >
          <span className="absolute right-1 -top-4 text-[9px] text-zinc-600">avg {METRIC_FMT[metric](leagueAvg)}</span>
        </div>

        {data.map((team) => {
          const pct = Math.max(2, ((team[metric] as number) / maxVal) * 100);
          const isFocused = focusTeam === team.abbr;
          return (
            <button
              key={team.abbr}
              className="flex-1 min-w-0 rounded-t-sm transition-all"
              style={{
                height: `${pct}%`,
                backgroundColor: isFocused ? '#6ee7b7' : barFill(team.abbr),
                opacity: barOpacity(team.abbr),
              }}
              onMouseEnter={(e) => handleMouseEnter(e, team)}
              onMouseLeave={() => setTooltip(null)}
              onClick={() => { onBarClick(team); onToggleHighlight(team.abbr); }}
              title={`${team.abbr}: ${METRIC_FMT[metric](team[metric] as number)}`}
            />
          );
        })}
      </div>

      {/* Logo row — HTML img tags, reliable on all browsers */}
      <div className="flex gap-px mt-1">
        {data.map((team) => (
          <div key={team.abbr} className="flex-1 min-w-0 flex justify-center">
            <TeamLogo
              abbr={team.abbr}
              size={14}
              darkBg={false}
              className={highlightedTeams.has(team.abbr) ? 'ring-1 ring-emerald-400/60 rounded-sm' : ''}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ── scatter tooltip ────────────────────────────────────────────────────────────

const ScatterTooltipContent = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint & { team: string } }> }) => {
  if (!active || !payload?.length) return null;
  const { abbr, x, y } = payload[0].payload;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-xs shadow-xl">
      <div className="flex items-center gap-1.5 mb-1">
        <TeamLogo abbr={abbr} size={16} darkBg={false} />
        <p className="font-semibold text-zinc-300">{abbr}</p>
      </div>
      <p className="text-zinc-400">K% <span className="text-emerald-400 font-bold">{x.toFixed(1)}%</span></p>
      <p className="text-zinc-400">ERA <span className="text-sky-400 font-bold">{y.toFixed(2)}</span></p>
    </div>
  );
};

// ── compare range bar ──────────────────────────────────────────────────────────

const RangeBar = ({ pitcher, bookLine, color }: { pitcher: Pitcher; bookLine: number; color: string }) => {
  const chartMin = Math.max(0, pitcher.salci.floor - 1);
  const chartMax = pitcher.salci.ceiling + 1;
  const span = Math.max(1, chartMax - chartMin);
  const toP = (v: number) => `${Math.max(0, Math.min(100, ((v - chartMin) / span) * 100))}%`;

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0">
        <p className="text-xs font-semibold text-zinc-200 truncate">{pitcher.name}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded ring-1', GRADE_BG_COLORS[pitcher.salci.grade], GRADE_COLORS[pitcher.salci.grade])}>
            {pitcher.salci.grade}
          </span>
          <span className="text-xs text-zinc-600">{Math.round(pitcher.salci.total)}</span>
        </div>
      </div>
      <div className="flex-1 relative" style={{ height: 32 }}>
        <div className="absolute h-1.5 rounded-full bg-zinc-800" style={{ top: 10, left: 0, right: 0 }} />
        <div className="absolute h-1.5 rounded-full opacity-40"
          style={{ top: 10, backgroundColor: color, left: toP(pitcher.salci.floor), width: `calc(${toP(pitcher.salci.ceiling)} - ${toP(pitcher.salci.floor)})` }} />
        <div className="absolute w-px bg-amber-400" style={{ top: 5, height: 21, left: toP(bookLine) }} />
        <div className="absolute w-3 h-3 rounded-full border-2 border-zinc-950 -translate-x-1/2"
          style={{ top: 9, left: toP(pitcher.salci.expectedKs), backgroundColor: color }} />
        <span className="absolute text-[9px] text-zinc-600 -translate-x-1/2" style={{ top: 24, left: toP(pitcher.salci.floor) }}>{pitcher.salci.floor}</span>
        <span className="absolute text-[9px] text-zinc-600 -translate-x-1/2" style={{ top: 24, left: toP(pitcher.salci.ceiling) }}>{pitcher.salci.ceiling}</span>
        <span className="absolute text-[9px] text-amber-400 -translate-x-1/2 whitespace-nowrap" style={{ top: 24, left: toP(bookLine) }}>L{bookLine}</span>
      </div>
      <div className="w-12 shrink-0 text-right">
        <p className="text-xs font-bold" style={{ color }}>{(Math.round(pitcher.salci.expectedKs * 10) / 10).toFixed(1)} K</p>
        {pitcher.salci.recommendOver && <p className="text-[9px] text-emerald-400">OVER</p>}
      </div>
    </div>
  );
};

// ── main page ──────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [tab, setTab] = useState<'teams' | 'compare' | 'parlay'>('teams');

  const [allTeams, setAllTeams] = useState<TeamPitchingStats[]>([]);
  const [l14Map, setL14Map] = useState<Map<string, number>>(new Map());
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [chartType, setChartType] = useState<'bar' | 'scatter'>('bar');
  const [metric, setMetric] = useState<PitchingMetric>('kPct');
  const [range, setRange] = useState<DateRange>('season');
  const [highlightedTeams, setHighlightedTeams] = useState<Set<string>>(new Set());
  const [focusTeam, setFocusTeam] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  const [pitchers, setPitchers] = useState<Pitcher[]>([]);
  const [pitchersLoading, setPitchersLoading] = useState(false);
  const [pitchersFetched, setPitchersFetched] = useState(false);
  const [compareSelected, setCompareSelected] = useState<Set<number>>(new Set());
  const [parlaySelected, setParlaySelected] = useState<Set<number>>(new Set());

  // ── data ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setTeamsLoading(true);
    fetch(`/api/analytics/team-pitching?range=${range}`)
      .then((r) => r.json() as Promise<{ teams: TeamPitchingStats[] }>)
      .then(({ teams }) => setAllTeams(teams))
      .catch(() => {})
      .finally(() => setTeamsLoading(false));
  }, [range]);

  useEffect(() => {
    fetch('/api/analytics/team-pitching?range=14d')
      .then((r) => r.json() as Promise<{ teams: TeamPitchingStats[] }>)
      .then(({ teams }) => {
        const m = new Map<string, number>();
        teams.forEach((t) => m.set(t.abbr, t.kPct));
        setL14Map(m);
      })
      .catch(() => {});
  }, []);

  const fetchPitchers = useCallback(() => {
    if (pitchersFetched) return;
    setPitchersLoading(true);
    fetch('/api/pitchers')
      .then((r) => r.json() as Promise<{ pitchers: Pitcher[] }>)
      .then(({ pitchers: p }) => { setPitchers(p); setPitchersFetched(true); })
      .catch(() => {})
      .finally(() => setPitchersLoading(false));
  }, [pitchersFetched]);

  const handleTabChange = (t: typeof tab) => {
    setTab(t);
    if (t === 'compare' || t === 'parlay') fetchPitchers();
  };

  // ── derived ───────────────────────────────────────────────────────────────

  const currentMetric = METRICS.find((m) => m.key === metric)!;

  const sortedTeams = useMemo(() => {
    const m = METRICS.find((x) => x.key === metric)!;
    return [...allTeams].sort((a, b) => m.lowerIsBetter ? a[metric] - b[metric] : b[metric] - a[metric]);
  }, [allTeams, metric]);

  const filteredChips = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedTeams;
    return sortedTeams.filter((t) => t.abbr.toLowerCase().includes(q) || t.team.toLowerCase().includes(q));
  }, [sortedTeams, search]);

  const scatterData = useMemo(() =>
    allTeams.map((t) => ({ x: t.kPct, y: t.era, z: Math.max(t.inningsPitched, 10), abbr: t.abbr, team: t.team })),
    [allTeams]
  );

  const leagueAvg = useMemo(() =>
    allTeams.length > 0 ? allTeams.reduce((s, t) => s + (t[metric] as number), 0) / allTeams.length : 0,
    [allTeams, metric]
  );

  const focusedPitchers = useMemo(() =>
    focusTeam ? pitchers.filter((p) => p.team === focusTeam) : [],
    [focusTeam, pitchers]
  );

  const selectedComparePitchers = useMemo(() =>
    pitchers.filter((p) => compareSelected.has(p.id)).slice(0, 4),
    [pitchers, compareSelected]
  );

  const overPitchers = useMemo(() => pitchers.filter((p) => p.salci.recommendOver), [pitchers]);

  const selectedParlayPitchers = useMemo(() =>
    overPitchers.filter((p) => parlaySelected.has(p.id)),
    [overPitchers, parlaySelected]
  );

  const bestBet = useMemo(() => {
    if (!overPitchers.length) return null;
    return overPitchers.reduce((b, p) =>
      p.salci.floor - p.salci.total / 10 > b.salci.floor - b.salci.total / 10 ? p : b,
      overPitchers[0]
    );
  }, [overPitchers]);

  const trendBadge = (abbr: string) => {
    const seasonK = allTeams.find((t) => t.abbr === abbr)?.kPct ?? 0;
    const l14K = l14Map.get(abbr);
    if (!l14K) return null;
    const diff = l14K - seasonK;
    if (diff > 0.5) return <TrendingUp size={10} className="text-emerald-400" />;
    if (diff < -0.5) return <TrendingDown size={10} className="text-red-400" />;
    return <Minus size={10} className="text-zinc-600" />;
  };

  const toggleHighlight = (abbr: string) =>
    setHighlightedTeams((prev) => { const n = new Set(prev); n.has(abbr) ? n.delete(abbr) : n.add(abbr); return n; });

  const handleBarClick = (team: TeamPitchingStats) => {
    const newFocus = focusTeam === team.abbr ? null : team.abbr;
    setFocusTeam(newFocus);
    if (newFocus) fetchPitchers();
  };

  const displayTeams = showAll ? sortedTeams : sortedTeams.slice(0, 15);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">Analytics Explorer</h1>
        <p className="text-sm text-zinc-500">MLB pitching analytics — all 30 teams, live data</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1 w-fit">
        {(['teams', 'compare', 'parlay'] as const).map((t) => (
          <button key={t} onClick={() => handleTabChange(t)}
            className={clsx('rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
              tab === t ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── TEAMS ─────────────────────────────────────────────────────────── */}
      {tab === 'teams' && (
        <div className="flex flex-col gap-6">
          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1">
              {METRICS.map((m) => (
                <button key={m.key} onClick={() => setMetric(m.key)} title={m.desc}
                  className={clsx('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    metric === m.key ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' : 'text-zinc-500 hover:text-zinc-300')}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1">
              {RANGES.map((r) => (
                <button key={r.key} onClick={() => setRange(r.key)}
                  className={clsx('rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    range === r.key ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
                  {r.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1">
              {(['bar', 'scatter'] as const).map((ct) => (
                <button key={ct} onClick={() => setChartType(ct)}
                  className={clsx('rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                    chartType === ct ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300')}>
                  {ct === 'bar' ? 'Bar' : 'Scatter'}
                </button>
              ))}
            </div>
          </div>

          {teamsLoading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : (
            <>
              {/* Chart */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-start justify-between mb-4 gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-200">{currentMetric.desc}</p>
                    <p className="text-xs text-zinc-500">
                      {allTeams.length} teams · avg {METRIC_FMT[metric](leagueAvg)}
                      {' '}· {currentMetric.lowerIsBetter ? 'lower is better' : 'higher is better'}
                    </p>
                  </div>
                  {highlightedTeams.size > 0 && (
                    <button onClick={() => setHighlightedTeams(new Set())}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 shrink-0">
                      <X size={11} /> clear
                    </button>
                  )}
                </div>

                {chartType === 'bar' ? (
                  /* Pure HTML bar chart — no SVG foreignObject, TeamLogo works reliably */
                  <HtmlBarChart
                    data={sortedTeams}
                    metric={metric}
                    leagueAvg={leagueAvg}
                    highlightedTeams={highlightedTeams}
                    focusTeam={focusTeam}
                    onBarClick={handleBarClick}
                    onToggleHighlight={toggleHighlight}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                      <XAxis type="number" dataKey="x" name="K%" unit="%" tick={{ fontSize: 10, fill: '#71717a' }}
                        axisLine={false} tickLine={false}
                        label={{ value: 'K%', position: 'insideBottom', offset: -10, fill: '#71717a', fontSize: 11 }} />
                      <YAxis type="number" dataKey="y" name="ERA" reversed tick={{ fontSize: 10, fill: '#71717a' }}
                        axisLine={false} tickLine={false}
                        label={{ value: 'ERA', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }} />
                      <ZAxis type="number" dataKey="z" range={[400, 400]} />
                      <Tooltip content={<ScatterTooltipContent />} cursor={{ strokeDasharray: '3 3', stroke: '#3f3f46' }} />
                      <Scatter
                        data={scatterData}
                        shape={<TeamLogoDot />}
                        onClick={(d: unknown) => handleBarClick(d as TeamPitchingStats)}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Search + highlight chips */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative max-w-xs w-full">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search teams..."
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600"
                    />
                  </div>
                  <p className="text-xs text-zinc-600">
                    Click chip or bar to highlight · Click bar for pitcher drill-down
                    {focusTeam && <span className="ml-1 text-emerald-400">— {focusTeam} pitchers below</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredChips.map((team) => (
                    <button
                      key={team.abbr}
                      onClick={() => toggleHighlight(team.abbr)}
                      className={clsx(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                        highlightedTeams.has(team.abbr)
                          ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                      )}
                    >
                      <TeamLogo abbr={team.abbr} size={14} darkBg={false} />
                      {team.abbr}
                      {trendBadge(team.abbr)}
                      <span className="text-zinc-600">{METRIC_FMT[metric](team[metric])}</span>
                    </button>
                  ))}
                  {filteredChips.length === 0 && search && (
                    <p className="text-xs text-zinc-600 py-1">No teams match &quot;{search}&quot;</p>
                  )}
                </div>
              </div>

              {/* Pitcher drill-down */}
              {focusTeam && (
                <div className="rounded-xl border border-emerald-500/20 bg-zinc-900 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-zinc-200">{focusTeam} Starters — Today</p>
                    <button onClick={() => setFocusTeam(null)} className="text-zinc-600 hover:text-zinc-400">
                      <X size={14} />
                    </button>
                  </div>
                  {pitchersLoading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : focusedPitchers.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-6">No pitchers found for {focusTeam} today</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {focusedPitchers.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2">
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">{p.name}</p>
                            <p className="text-xs text-zinc-500">{p.team} {p.isHome ? 'vs' : '@'} {p.opponent}</p>
                          </div>
                          <div className="text-right">
                            <p className={clsx('text-sm font-bold', GRADE_COLORS[p.salci.grade])}>
                              {p.salci.grade} · {Math.round(p.salci.total)}
                            </p>
                            <p className="text-xs text-zinc-500">{p.salci.floor}–{p.salci.ceiling} Ks</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Leaderboard */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                  <p className="text-sm font-semibold text-zinc-200">All Teams — {currentMetric.label}</p>
                  <span className="text-xs text-zinc-500">{allTeams.length} teams</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500 w-6">#</th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Team</th>
                        {METRICS.map((m) => (
                          <th key={m.key} onClick={() => setMetric(m.key)}
                            className={clsx('px-4 py-2.5 text-right text-xs font-medium cursor-pointer transition-colors',
                              metric === m.key ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300')}>
                            {m.label}
                          </th>
                        ))}
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayTeams.map((team, i) => (
                        <tr key={team.abbr}
                          onClick={() => { toggleHighlight(team.abbr); handleBarClick(team); }}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer">
                          <td className="px-4 py-2.5 text-xs text-zinc-600">{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <TeamLogo abbr={team.abbr} size={18} darkBg={false} />
                              <span className={clsx('text-xs font-semibold',
                                highlightedTeams.has(team.abbr) ? 'text-emerald-400' : 'text-zinc-300')}>
                                {team.abbr}
                              </span>
                            </div>
                          </td>
                          {METRICS.map((m) => (
                            <td key={m.key} className={clsx('px-4 py-2.5 text-right text-xs tabular-nums',
                              metric === m.key ? 'font-semibold text-zinc-200' : 'text-zinc-500')}>
                              {METRIC_FMT[m.key](team[m.key])}
                            </td>
                          ))}
                          <td className="px-4 py-2.5 text-right">{trendBadge(team.abbr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!showAll && sortedTeams.length > 15 && (
                  <button onClick={() => setShowAll(true)}
                    className="w-full py-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800">
                    Show all {sortedTeams.length} teams
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── COMPARE ───────────────────────────────────────────────────────── */}
      {tab === 'compare' && (
        <div className="flex flex-col gap-6">
          {pitchersLoading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : pitchers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20 text-center">
              <p className="text-zinc-400 font-medium">No pitcher data available</p>
              <p className="text-sm text-zinc-600">Pipeline must run first to populate today&apos;s SALCI scores</p>
            </div>
          ) : (
            <>
              {bestBet && (
                <div className="flex items-center gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <Star className="shrink-0 text-emerald-400" size={20} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-0.5">Best Bet Today</p>
                    <p className="font-semibold text-zinc-100">
                      {bestBet.name}
                      <span className={clsx('ml-2 text-sm font-bold', GRADE_COLORS[bestBet.salci.grade])}>
                        {bestBet.salci.grade} · {Math.round(bestBet.salci.total)}
                      </span>
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Floor {bestBet.salci.floor} · Expected {(Math.round(bestBet.salci.expectedKs * 10) / 10).toFixed(1)} · Ceiling {bestBet.salci.ceiling}
                    </p>
                  </div>
                  <ArrowUpRight className="shrink-0 text-emerald-400" size={16} />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  Select up to 4 pitchers to compare
                  {compareSelected.size > 0 && <span className="ml-2 text-zinc-400">({compareSelected.size} selected)</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {pitchers.map((p) => {
                    const isSelected = compareSelected.has(p.id);
                    const isDisabled = !isSelected && compareSelected.size >= 4;
                    return (
                      <button key={p.id}
                        disabled={isDisabled}
                        onClick={() => setCompareSelected((prev) => {
                          const n = new Set(prev); isSelected ? n.delete(p.id) : n.add(p.id); return n;
                        })}
                        className={clsx('flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                          isSelected ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' :
                          isDisabled ? 'border-zinc-800 text-zinc-700 cursor-not-allowed' :
                          'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300')}>
                        <TeamLogo abbr={p.team} size={14} darkBg={false} />
                        {p.name.split(' ').pop()}
                        <span className={clsx('font-bold', GRADE_COLORS[p.salci.grade])}>{p.salci.grade}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedComparePitchers.length >= 2 ? (
                <>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-sm font-semibold text-zinc-200 mb-4">SALCI Component Comparison</p>
                    <RadarCompare pitchers={selectedComparePitchers} />
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                    <p className="text-sm font-semibold text-zinc-200 mb-4">K Projection Ranges</p>
                    <div className="flex flex-col gap-4">
                      {selectedComparePitchers.map((p, i) => (
                        <RangeBar key={p.id} pitcher={p} bookLine={5.5} color={PITCHER_COLORS[i % PITCHER_COLORS.length]} />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-12 text-center">
                  <p className="text-zinc-500 text-sm">Select at least 2 pitchers to see the comparison</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PARLAY ────────────────────────────────────────────────────────── */}
      {tab === 'parlay' && (
        <div className="flex flex-col gap-6">
          {pitchersLoading ? (
            <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
          ) : overPitchers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20 text-center">
              <p className="text-zinc-400 font-medium">
                {pitchers.length === 0 ? 'No pitcher data yet' : 'No OVER picks today'}
              </p>
              <p className="text-sm text-zinc-600">
                {pitchers.length === 0 ? 'Run the pipeline to populate today\'s SALCI scores'
                  : 'No pitchers meet the floor ≥ line + 2 threshold today'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-zinc-200">OVER Picks ({overPitchers.length})</p>
                  <p className="text-xs text-zinc-500">Select 2–4 for parlay card</p>
                </div>
                <div className="flex flex-col gap-2">
                  {overPitchers.map((p) => {
                    const isChecked = parlaySelected.has(p.id);
                    const isDisabled = !isChecked && parlaySelected.size >= 4;
                    return (
                      <label key={p.id}
                        className={clsx('flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition-colors',
                          isChecked ? 'border-emerald-500/40 bg-emerald-500/5' :
                          isDisabled ? 'border-zinc-800 opacity-40 cursor-not-allowed' :
                          'border-zinc-800 bg-zinc-900 hover:border-zinc-700')}>
                        <input type="checkbox" checked={isChecked} disabled={isDisabled}
                          onChange={() => {
                            if (isDisabled) return;
                            setParlaySelected((prev) => { const n = new Set(prev); isChecked ? n.delete(p.id) : n.add(p.id); return n; });
                          }}
                          className="w-4 h-4 accent-emerald-500" />
                        <TeamLogo abbr={p.team} size={28} darkBg={false} className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-zinc-100 truncate">{p.name}</p>
                            <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded ring-1 shrink-0', GRADE_BG_COLORS[p.salci.grade], GRADE_COLORS[p.salci.grade])}>
                              {p.salci.grade}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">{p.team} {p.isHome ? 'vs' : '@'} {p.opponent}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-zinc-500">{p.salci.floor}–{p.salci.ceiling} Ks</p>
                          <p className="text-xs font-semibold text-emerald-400">+{(p.salci.floor - 5.5).toFixed(1)} edge</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-zinc-200">
                  Parlay Card {parlaySelected.size > 0 ? `(${parlaySelected.size} picks)` : ''}
                </p>
                {selectedParlayPitchers.length >= 2 ? (
                  <ParlayCardGenerator
                    pitchers={selectedParlayPitchers}
                    bookLines={Object.fromEntries(selectedParlayPitchers.map((p) => [p.id, 5.5]))}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-16 text-center">
                    <p className="text-sm text-zinc-500">Select 2–4 pitchers to generate the parlay card</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
