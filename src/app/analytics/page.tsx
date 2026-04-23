'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, Cell, ReferenceLine, Legend,
} from 'recharts';
import { clsx } from 'clsx';
import Spinner from '@/components/ui/Spinner';
import { getTeamLogoUrl } from '@/lib/mlb-api/logos';
import type { TeamPitchingStats, PitchingMetric, DateRange } from '@/types/results';

// ─── constants ───────────────────────────────────────────────────────────────

const METRICS: { key: PitchingMetric; label: string; desc: string; lowerIsBetter: boolean }[] = [
  { key: 'era',   label: 'ERA',   desc: 'Earned Run Average',      lowerIsBetter: true },
  { key: 'fip',   label: 'FIP',   desc: 'Fielding Independent Pitching', lowerIsBetter: true },
  { key: 'kPct',  label: 'K%',    desc: 'Strikeout Rate',          lowerIsBetter: false },
  { key: 'whip',  label: 'WHIP',  desc: 'Walks + Hits per IP',     lowerIsBetter: true },
  { key: 'bbPct', label: 'BB%',   desc: 'Walk Rate',               lowerIsBetter: true },
];

const RANGES: { key: DateRange; label: string }[] = [
  { key: 'season', label: 'Season' },
  { key: '30d',    label: 'L30' },
  { key: '14d',    label: 'L14' },
  { key: '7d',     label: 'L7' },
];

const CHART_COLORS = ['#34d399', '#38bdf8', '#a78bfa', '#fb923c', '#f472b6'];

const METRIC_FORMAT: Record<PitchingMetric, (v: number) => string> = {
  era:   (v) => v.toFixed(2),
  fip:   (v) => v.toFixed(2),
  kPct:  (v) => `${v.toFixed(1)}%`,
  whip:  (v) => v.toFixed(2),
  bbPct: (v) => `${v.toFixed(1)}%`,
};

// ─── custom tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  metric,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  metric: PitchingMetric;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-xs shadow-xl">
      <p className="mb-2 font-semibold text-zinc-300">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{METRIC_FORMAT[metric](p.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ─── main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [allTeams, setAllTeams] = useState<TeamPitchingStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metric, setMetric] = useState<PitchingMetric>('kPct');
  const [range, setRange] = useState<DateRange>('season');
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // Fetch when range changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/analytics/team-pitching?range=${range}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load stats');
        return r.json() as Promise<{ teams: TeamPitchingStats[] }>;
      })
      .then(({ teams }) => {
        setAllTeams(teams);
        // Default selection: top 5 teams by current metric
        if (selectedTeams.size === 0) {
          const sorted = [...teams].sort((a, b) =>
            METRICS.find((m) => m.key === 'kPct')!.lowerIsBetter
              ? a.kPct - b.kPct
              : b.kPct - a.kPct
          );
          setSelectedTeams(new Set(sorted.slice(0, 5).map((t) => t.abbr)));
        }
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Sort teams by selected metric for the chart
  const sortedTeams = useMemo(() => {
    const m = METRICS.find((x) => x.key === metric)!;
    return [...allTeams].sort((a, b) =>
      m.lowerIsBetter ? a[metric] - b[metric] : b[metric] - a[metric]
    );
  }, [allTeams, metric]);

  const chartTeams = useMemo(() => {
    const teams = sortedTeams.filter((t) => selectedTeams.has(t.abbr));
    return teams.length > 0 ? teams : sortedTeams.slice(0, 5);
  }, [sortedTeams, selectedTeams]);

  const leagueAvg = useMemo(() => {
    if (allTeams.length === 0) return 0;
    return allTeams.reduce((s, t) => s + t[metric], 0) / allTeams.length;
  }, [allTeams, metric]);

  const toggleTeam = (abbr: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(abbr)) {
        next.delete(abbr);
      } else {
        next.add(abbr);
      }
      return next;
    });
  };

  const currentMetric = METRICS.find((m) => m.key === metric)!;
  const displayTeams = showAll ? sortedTeams : sortedTeams.slice(0, 15);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Analytics Explorer
        </h1>
        <p className="text-sm text-zinc-500">
          MLB team pitching trends — interactive comparison tool
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Metric selector */}
        <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              title={m.desc}
              className={clsx(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                metric === m.key
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={clsx(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                range === r.key
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && allTeams.length > 0 && (
        <>
          {/* Chart */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-zinc-200">{currentMetric.desc}</p>
                <p className="text-xs text-zinc-500">
                  League avg: {METRIC_FORMAT[metric](leagueAvg)} ·{' '}
                  {currentMetric.lowerIsBetter ? 'Lower is better' : 'Higher is better'}
                </p>
              </div>
              <span className="text-xs text-zinc-600">Click team chips below to compare</span>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartTeams} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <XAxis
                  dataKey="abbr"
                  tick={{ fontSize: 11, fill: '#71717a' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => METRIC_FORMAT[metric](v)}
                />
                <Tooltip
                  content={<CustomTooltip metric={metric} />}
                  cursor={{ fill: '#ffffff06' }}
                />
                <ReferenceLine
                  y={leagueAvg}
                  stroke="#52525b"
                  strokeDasharray="4 3"
                  label={{ value: 'Avg', position: 'insideTopRight', fill: '#52525b', fontSize: 10 }}
                />
                <Bar dataKey={metric} radius={[5, 5, 0, 0]} name={currentMetric.label}>
                  {chartTeams.map((team, i) => (
                    <Cell
                      key={team.abbr}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Team chip selector */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
              Select teams to compare (showing {chartTeams.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {sortedTeams.map((team) => {
                const isSelected = selectedTeams.has(team.abbr);
                return (
                  <button
                    key={team.abbr}
                    onClick={() => toggleTeam(team.abbr)}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                      isSelected
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                    )}
                  >
                    <div className="flex items-center justify-center bg-white rounded-full w-4 h-4">
                      <img
                        src={getTeamLogoUrl(team.abbr)}
                        alt={team.abbr}
                        className="w-3 h-3 object-contain"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                    {team.abbr}
                    <span className="text-zinc-600">
                      {METRIC_FORMAT[metric](team[metric])}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Leaderboard table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <p className="text-sm font-semibold text-zinc-200">
                All Teams — {currentMetric.label} Ranked
              </p>
              <span className="text-xs text-zinc-500">{range === 'season' ? '2026 Season' : range} · {allTeams.length} teams</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">#</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">Team</th>
                    {METRICS.map((m) => (
                      <th
                        key={m.key}
                        className={clsx(
                          'px-4 py-2.5 text-right text-xs font-medium cursor-pointer transition-colors',
                          metric === m.key ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                        )}
                        onClick={() => setMetric(m.key)}
                      >
                        {m.label}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">Ks</th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-zinc-500">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {displayTeams.map((team, i) => (
                    <tr
                      key={team.abbr}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                      onClick={() => toggleTeam(team.abbr)}
                    >
                      <td className="px-4 py-2.5 text-xs text-zinc-600">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center bg-white rounded-full w-5 h-5">
                            <img
                              src={getTeamLogoUrl(team.abbr)}
                              alt={team.abbr}
                              className="w-4 h-4 object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                          <span className={clsx(
                            'text-xs font-semibold',
                            selectedTeams.has(team.abbr) ? 'text-emerald-400' : 'text-zinc-300'
                          )}>
                            {team.abbr}
                          </span>
                        </div>
                      </td>
                      {METRICS.map((m) => (
                        <td
                          key={m.key}
                          className={clsx(
                            'px-4 py-2.5 text-right text-xs tabular-nums',
                            metric === m.key ? 'font-semibold text-zinc-200' : 'text-zinc-500'
                          )}
                        >
                          {METRIC_FORMAT[m.key](team[m.key])}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-zinc-500">
                        {team.strikeOuts}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-zinc-500">
                        {team.inningsPitched.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAll && sortedTeams.length > 15 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-3 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800"
              >
                Show all {sortedTeams.length} teams
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
