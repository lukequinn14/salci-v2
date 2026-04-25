'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { ChevronUp, ChevronDown, ChevronsUpDown, Copy, CheckCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import TeamLogo from '@/components/ui/TeamLogo';
import Spinner from '@/components/ui/Spinner';
import { GRADE_COLORS, GRADE_BG_COLORS } from '@/lib/salci/grades';
import type { Pitcher } from '@/types/pitcher';

const BOOK_LINE = 5.5;

// ─── helpers ─────────────────────────────────────────────────────────────────

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...getCombinations(rest, k - 1).map((c) => [first, ...c]),
    ...getCombinations(rest, k),
  ];
}

const confidencePill = (buffer: number) => {
  if (buffer <= 1.15) return { label: 'HIGH CONF', cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30' };
  if (buffer <= 1.75) return { label: 'MODERATE', cls: 'bg-yellow-500/15 text-yellow-400 ring-yellow-500/30' };
  return { label: 'VOLATILE', cls: 'bg-orange-500/15 text-orange-400 ring-orange-500/30' };
};

const edgeColor = (edge: number) => {
  if (edge >= 2) return 'text-emerald-400 font-bold';
  if (edge < 0) return 'text-red-400';
  return 'text-zinc-400';
};

const barColor = (buffer: number) => {
  if (buffer <= 1.15) return '#34d399';
  if (buffer <= 1.75) return '#fb923c';
  return '#f87171';
};

type SortCol = 'name' | 'grade' | 'expectedKs' | 'floor' | 'ceiling' | 'edge' | 'buffer';

// ─── main page ────────────────────────────────────────────────────────────────

export default function EdgeHubPage() {
  const router = useRouter();
  const [pitchers, setPitchers] = useState<Pitcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState<SortCol>('edge');
  const [sortAsc, setSortAsc] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/pitchers')
      .then((r) => r.json() as Promise<{ pitchers: Pitcher[] }>)
      .then(({ pitchers: p }) => setPitchers(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSort = useCallback((col: SortCol) => {
    setSortCol((prev) => {
      if (prev === col) { setSortAsc((a) => !a); return col; }
      setSortAsc(false);
      return col;
    });
  }, []);

  const sorted = useMemo(() => {
    return [...pitchers].sort((a, b) => {
      const edgeA = a.salci.floor - BOOK_LINE;
      const edgeB = b.salci.floor - BOOK_LINE;
      const gradeOrder = ['S', 'A', 'B+', 'B', 'C', 'D', 'F'];
      let v = 0;
      if (sortCol === 'name')       v = a.name.localeCompare(b.name);
      else if (sortCol === 'grade') v = gradeOrder.indexOf(a.salci.grade) - gradeOrder.indexOf(b.salci.grade);
      else if (sortCol === 'expectedKs') v = a.salci.expectedKs - b.salci.expectedKs;
      else if (sortCol === 'floor') v = a.salci.floor - b.salci.floor;
      else if (sortCol === 'ceiling') v = a.salci.ceiling - b.salci.ceiling;
      else if (sortCol === 'edge')  v = edgeA - edgeB;
      else if (sortCol === 'buffer') v = a.salci.buffer - b.salci.buffer;
      return sortAsc ? v : -v;
    });
  }, [pitchers, sortCol, sortAsc]);

  const overPitchers = useMemo(() => pitchers.filter((p) => p.salci.recommendOver), [pitchers]);

  const parlays = useMemo(() => {
    if (overPitchers.length < 2) return [];
    const twos = getCombinations(overPitchers, 2);
    const threes = overPitchers.length >= 3 ? getCombinations(overPitchers, 3) : [];
    return [...twos, ...threes]
      .map((combo) => ({
        pitchers: combo,
        edge: combo.reduce((s, p) => s + p.salci.floor - BOOK_LINE, 0),
      }))
      .sort((a, b) => b.edge - a.edge)
      .slice(0, 3);
  }, [overPitchers]);

  const copyParlay = async (combo: (typeof parlays)[0], idx: number) => {
    const text = `🎯 SALCI Parlay: ${combo.pitchers.map((p) => `${p.name} OVER ${BOOK_LINE}`).join(' + ')} | Edge: +${combo.edge.toFixed(1)} | #SALCI`;
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2500);
  };

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ChevronsUpDown size={11} className="text-zinc-600 ml-0.5" />;
    return sortAsc
      ? <ChevronUp size={11} className="text-emerald-400 ml-0.5" />
      : <ChevronDown size={11} className="text-emerald-400 ml-0.5" />;
  };

  const thCls = 'px-3 py-2.5 text-left text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none';
  const thRight = 'px-3 py-2.5 text-right text-xs font-medium text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none';

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">The Edge Hub</h1>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
            Live
          </span>
        </div>
        <p className="text-sm text-zinc-500">
          All today&apos;s starters ranked by edge · Book line {BOOK_LINE} · Edge = floor − line
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : pitchers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20">
          <p className="text-zinc-400 font-medium">No pitcher data available</p>
          <p className="text-sm text-zinc-600">Run the pipeline to populate today&apos;s SALCI scores</p>
        </div>
      ) : (
        <>
          {/* ── Section A: Edge Matrix ─────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
              Edge Matrix — {sorted.length} starters
            </h2>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className={thCls} onClick={() => handleSort('name')}>
                        <span className="flex items-center">Pitcher<SortIcon col="name" /></span>
                      </th>
                      <th className={thCls} onClick={() => handleSort('grade')}>
                        <span className="flex items-center">Grade<SortIcon col="grade" /></span>
                      </th>
                      <th className={thRight} onClick={() => handleSort('expectedKs')}>
                        <span className="flex items-center justify-end">Exp Ks<SortIcon col="expectedKs" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-medium text-zinc-500">
                        Floor · Line · Ceiling
                      </th>
                      <th className={thRight} onClick={() => handleSort('edge')}>
                        <span className="flex items-center justify-end">Edge<SortIcon col="edge" /></span>
                      </th>
                      <th className={thCls} onClick={() => handleSort('buffer')}>
                        <span className="flex items-center">Confidence<SortIcon col="buffer" /></span>
                      </th>
                      <th className="px-3 py-2.5 text-xs font-medium text-zinc-500">Rec</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, i) => {
                      const edge = p.salci.floor - BOOK_LINE;
                      const conf = confidencePill(p.salci.buffer);
                      return (
                        <motion.tr
                          key={p.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.22 }}
                          className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                          onClick={() => router.push(`/pitcher/${p.id}`)}
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <TeamLogo abbr={p.team} size={18} />
                              <div>
                                <p className="text-xs font-semibold text-zinc-200 leading-tight">{p.name}</p>
                                <p className="text-[10px] text-zinc-600">
                                  {p.team} {p.isHome ? 'vs' : '@'} {p.opponent}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded ring-1', GRADE_BG_COLORS[p.salci.grade], GRADE_COLORS[p.salci.grade])}>
                              {p.salci.grade}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold text-zinc-300 tabular-nums">
                            {(Math.round(p.salci.expectedKs * 10) / 10).toFixed(1)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs tabular-nums text-zinc-500">
                            <span className="text-zinc-400">{p.salci.floor}</span>
                            <span className="mx-1 text-zinc-700">·</span>
                            <span className="text-amber-400">{BOOK_LINE}</span>
                            <span className="mx-1 text-zinc-700">·</span>
                            <span className="text-zinc-400">{p.salci.ceiling}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <span className={clsx('text-xs', edgeColor(edge))}>
                              {edge >= 0 ? '+' : ''}{edge.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full ring-1', conf.cls)}>
                              {conf.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {p.salci.recommendOver && (
                              <span className="text-[10px] font-bold text-emerald-400">✓ OVER</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ── Section B: Volatility Index ──────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Volatility Index</h2>
              <p className="text-xs text-zinc-600 mt-0.5">
                Bar width = expected Ks (max 15) · Color: green=reliable, orange=boom/bust · Amber tick = book line
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 flex flex-col gap-3">
              {sorted.map((p) => {
                const color = barColor(p.salci.buffer);
                const chartMin = Math.max(0, p.salci.floor - 1);
                const chartMax = p.salci.ceiling + 1;
                const span = Math.max(1, chartMax - chartMin);
                const toPct = (v: number) => Math.max(0, Math.min(100, ((v - chartMin) / span) * 100));
                const barPct = toPct(p.salci.expectedKs);
                const floorPct = toPct(p.salci.floor);
                const ceilPct = toPct(p.salci.ceiling);
                const linePct = toPct(BOOK_LINE);
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <div className="w-36 shrink-0 flex items-center gap-2">
                      <TeamLogo abbr={p.team} size={14} />
                      <span className="text-xs text-zinc-300 truncate">{p.name.split(' ').pop()}</span>
                    </div>
                    <div className="flex-1 relative" style={{ height: 28 }}>
                      {/* Track */}
                      <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full bg-zinc-800" />
                      {/* Bar */}
                      <div
                        className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full transition-all"
                        style={{ width: `${barPct}%`, backgroundColor: color }}
                      />
                      {/* Book line tick */}
                      <div
                        className="absolute top-0 bottom-0 w-px bg-amber-400/70"
                        style={{ left: `${linePct}%` }}
                      />
                      {/* Floor label */}
                      <span
                        className="absolute text-[9px] text-zinc-500 -translate-x-1/2"
                        style={{ left: `${floorPct}%`, top: 0 }}
                      >
                        {p.salci.floor}
                      </span>
                      {/* Ceiling label */}
                      <span
                        className="absolute text-[9px] text-zinc-500 -translate-x-1/2"
                        style={{ left: `${ceilPct}%`, bottom: 0 }}
                      >
                        {p.salci.ceiling}
                      </span>
                    </div>
                    <div className="w-16 shrink-0 text-right">
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {(Math.round(p.salci.expectedKs * 10) / 10).toFixed(1)} Ks
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Section C: Best Parlays ──────────────────────────────────────── */}
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Best Parlays Today</h2>
              <p className="text-xs text-zinc-600 mt-0.5">
                Auto-generated from OVER picks · Ranked by combined edge
              </p>
            </div>
            {parlays.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center">
                <p className="text-sm text-zinc-500">
                  {overPitchers.length === 0
                    ? 'No OVER picks today — no pitchers meet the floor ≥ line + 2 threshold'
                    : 'Need at least 2 OVER picks to generate parlays'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {parlays.map((combo, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">
                        {combo.pitchers.length}-Leg Parlay
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        +{combo.edge.toFixed(1)} combined edge
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {combo.pitchers.map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <TeamLogo abbr={p.team} size={16} />
                          <span className="text-xs text-zinc-200 flex-1 truncate">{p.name}</span>
                          <span className={clsx('text-xs font-bold', GRADE_COLORS[p.salci.grade])}>
                            {p.salci.grade}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold">
                            OVER {BOOK_LINE}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => copyParlay(combo, idx)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
                    >
                      {copied === idx ? (
                        <><CheckCheck size={12} className="text-emerald-400" /> Copied!</>
                      ) : (
                        <><Copy size={12} /> Copy Picks</>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
