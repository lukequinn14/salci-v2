'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FlaskConical, RotateCcw, ChevronUp, ChevronDown, Minus, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import TeamLogo from '@/components/ui/TeamLogo';
import type { User } from '@supabase/supabase-js';

interface PitcherRow {
  id: number;
  name: string;
  team: string;
  grade: string;
  salci: number;
  stuff: number;
  matchup: number;
  workload: number;
  location: number;
  floor: number;
  ceiling: number;
  recommendOver: boolean;
}

interface Weights {
  stuff: number;
  matchup: number;
  workload: number;
  location: number;
}

const DEFAULT_WEIGHTS: Weights = { stuff: 52, matchup: 30, workload: 10, location: 8 };

const PRESETS: { label: string; weights: Weights }[] = [
  { label: 'Stuff Max', weights: { stuff: 70, matchup: 20, workload: 5, location: 5 } },
  { label: 'Matchup Heavy', weights: { stuff: 35, matchup: 50, workload: 10, location: 5 } },
];

const SLIDER_CONFIG: { key: keyof Weights; label: string; color: string; min: number; max: number }[] = [
  { key: 'stuff',    label: 'Stuff',    color: '#10b981', min: 20, max: 70 },
  { key: 'matchup',  label: 'Matchup',  color: '#38bdf8', min: 10, max: 50 },
  { key: 'workload', label: 'Workload', color: '#a78bfa', min: 5,  max: 30 },
  { key: 'location', label: 'Location', color: '#71717a', min: 5,  max: 25 },
];

const computeCustomSalci = (row: PitcherRow, w: Weights): number => {
  const total = w.stuff + w.matchup + w.workload + w.location;
  if (total === 0) return row.salci;
  const s = (row.stuff * (w.stuff / total)) + (row.matchup * (w.matchup / total)) + (row.workload * (w.workload / total)) + (row.location * (w.location / total));
  return Math.min(95, Math.max(10, Math.round(s)));
};

const deltaIcon = (delta: number) => {
  if (delta > 2) return <ChevronUp size={13} className="text-emerald-400 shrink-0" />;
  if (delta < -2) return <ChevronDown size={13} className="text-red-400 shrink-0" />;
  return <Minus size={13} className="text-zinc-600 shrink-0" />;
};

const deltaColor = (delta: number) => {
  if (delta > 2) return 'text-emerald-400';
  if (delta < -2) return 'text-red-400';
  return 'text-zinc-500';
};

export default function LabPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pitchers, setPitchers] = useState<PitcherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/pitchers');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        const rows: PitcherRow[] = (data.pitchers ?? []).map((p: Record<string, unknown>) => {
          const salci = p.salci as Record<string, number> & { recommendOver?: boolean; grade?: string };
          return {
            id: p.id as number,
            name: p.name as string,
            team: p.team as string,
            grade: salci?.grade ?? 'C',
            salci: salci?.total ?? 50,
            stuff: salci?.stuff ?? 50,
            matchup: salci?.matchup ?? 50,
            workload: salci?.workload ?? 50,
            location: salci?.location ?? 50,
            floor: salci?.floor ?? 2,
            ceiling: salci?.ceiling ?? 6,
            recommendOver: salci?.recommendOver ?? false,
          };
        });
        setPitchers(rows);
      } catch {
        setPitchers([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const weightSum = weights.stuff + weights.matchup + weights.workload + weights.location;
  const sumOk = Math.abs(weightSum - 100) <= 1;

  const normalize = useCallback(() => {
    const total = weightSum;
    if (total === 0) return;
    setWeights({
      stuff: Math.round((weights.stuff / total) * 100),
      matchup: Math.round((weights.matchup / total) * 100),
      workload: Math.round((weights.workload / total) * 100),
      location: Math.round((weights.location / total) * 100),
    });
  }, [weights, weightSum]);

  const ranked = useMemo(() => {
    return [...pitchers]
      .map((p) => ({ ...p, custom: computeCustomSalci(p, weights) }))
      .sort((a, b) => b.custom - a.custom);
  }, [pitchers, weights]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical size={22} className="text-emerald-400" />
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-100">The Lab</h1>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">PRO</span>
          </div>
          <p className="text-xs text-zinc-500">Adjust SALCI weights live and see how rankings shift.</p>
        </div>
      </div>

      {/* Sign-in banner */}
      {!user && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-amber-300">Sign in to save custom weight presets and compare across days.</p>
          <button
            onClick={() => router.push('/login')}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 transition-colors"
          >
            Sign in
          </button>
        </div>
      )}

      {/* Weight sliders */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">Weight Sliders</h2>
          <div className="flex items-center gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setWeights(preset.weights)}
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => setWeights(DEFAULT_WEIGHTS)}
              className="flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          </div>
        </div>

        {SLIDER_CONFIG.map(({ key, label, color, min, max }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">{label}</span>
              <span className="font-semibold text-zinc-200">{weights[key]}%</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              value={weights[key]}
              onChange={(e) => setWeights((prev) => ({ ...prev, [key]: parseInt(e.target.value) }))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: color }}
            />
          </div>
        ))}

        {/* Sum indicator */}
        <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
          <div className="flex items-center gap-2">
            {!sumOk && <AlertTriangle size={13} className="text-amber-400" />}
            <span className={`text-xs ${sumOk ? 'text-zinc-500' : 'text-amber-400 font-semibold'}`}>
              Sum: {weightSum}% {sumOk ? '✓' : '— weights must total 100'}
            </span>
          </div>
          {!sumOk && (
            <button
              onClick={normalize}
              className="rounded-md bg-amber-500/20 px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-500/30 transition-colors"
            >
              Auto-normalize
            </button>
          )}
        </div>
      </div>

      {/* Pitcher rankings */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">Custom Rankings</h2>
          <span className="text-xs text-zinc-600">{pitchers.length} pitchers · sorted by custom score</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
          </div>
        ) : ranked.length === 0 ? (
          <p className="text-center text-zinc-600 text-sm py-12">No pitchers available today.</p>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {ranked.map((p, i) => {
              const delta = p.custom - p.salci;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  onClick={() => router.push(`/pitcher/${p.id}`)}
                >
                  <span className="w-5 text-xs text-zinc-600 tabular-nums">{i + 1}</span>
                  <TeamLogo abbr={p.team} size={24} darkBg={false} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-zinc-600">{p.team}</p>
                  </div>
                  {/* Original score */}
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-600">orig</p>
                    <p className="text-xs font-medium text-zinc-400">{p.salci}</p>
                  </div>
                  {/* Delta */}
                  <div className="flex items-center gap-0.5 w-12 justify-end">
                    {deltaIcon(delta)}
                    <span className={`text-xs font-semibold ${deltaColor(delta)}`}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  </div>
                  {/* Custom score */}
                  <div className="text-right w-10">
                    <p className="text-[10px] text-zinc-600">new</p>
                    <p className="text-sm font-bold text-emerald-400">{p.custom}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
