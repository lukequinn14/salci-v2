import { TrendingUp, Users, BarChart2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getTeamLogoUrl } from '@/lib/mlb-api/logos';
import { GRADE_COLORS, GRADE_BG_COLORS } from '@/lib/salci/grades';
import { clsx } from 'clsx';
import type { SalciScore } from '@/types/salci';

interface PipelineRun {
  run_date: string;
  computed_at: string;
  pitchers_computed: number;
  pitchers_failed: number;
  status: 'success' | 'partial' | 'failed';
}

interface TopPick {
  pitcher_id: number;
  salci_total: number;
  grade: SalciScore['grade'];
  floor_ks: number;
  ceiling_ks: number;
  expected_ks: number;
  recommend_over: boolean;
  opponent: string | null;
  is_home: boolean | null;
  pitchers: { name: string; team: string } | null;
}

const formatAge = (computedAt: string): string => {
  const ageMs = Date.now() - new Date(computedAt).getTime();
  const hours = Math.floor(ageMs / 3_600_000);
  const minutes = Math.floor((ageMs % 3_600_000) / 60_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ago`;
  if (hours > 0) return `${hours}h ${minutes}m ago`;
  return `${minutes}m ago`;
};

const PipelineBadge = ({ run }: { run: PipelineRun | null }) => {
  if (!run) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-500 ring-1 ring-zinc-700">
        <Clock size={11} />
        Not yet computed
      </span>
    );
  }

  const ageMs = Date.now() - new Date(run.computed_at).getTime();
  const isStale = ageMs > 24 * 3_600_000;

  const icon = run.status === 'failed' ? <AlertCircle size={11} />
    : isStale ? <Clock size={11} />
    : <CheckCircle2 size={11} />;

  const colorClass = run.status === 'failed'
    ? 'bg-red-500/10 text-red-400 ring-red-500/20'
    : isStale
    ? 'bg-yellow-500/10 text-yellow-400 ring-yellow-500/20'
    : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20';

  return (
    <span className={clsx('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1', colorClass)}>
      {icon}
      Updated {formatAge(run.computed_at)} · {run.pitchers_computed} pitchers
    </span>
  );
};

const TopPickCard = ({ pick }: { pick: TopPick }) => {
  const team = pick.pitchers?.team ?? '—';
  const name = pick.pitchers?.name ?? `Pitcher #${pick.pitcher_id}`;
  const opponent = pick.opponent ?? '—';

  return (
    <Link
      href={`/pitcher/${pick.pitcher_id}`}
      className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/60"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center bg-white rounded-full w-8 h-8 shadow-sm shrink-0">
            <img
              src={getTeamLogoUrl(team)}
              alt={team}
              className="w-6 h-6 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100 leading-tight">{name}</p>
            <p className="text-xs text-zinc-500">
              {team} {pick.is_home ? 'vs' : '@'} {opponent}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={clsx(
            'text-xs font-bold px-2 py-0.5 rounded ring-1',
            GRADE_BG_COLORS[pick.grade],
            GRADE_COLORS[pick.grade],
          )}>
            {pick.grade}
          </span>
          <span className="text-xs text-zinc-500">{Math.round(pick.salci_total)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          Exp <span className="text-zinc-300 font-medium">
            {(Math.round(pick.expected_ks * 10) / 10).toFixed(1)} Ks
          </span>
        </span>
        <span className="text-zinc-500">
          Range <span className="text-zinc-300 font-medium">{pick.floor_ks}–{pick.ceiling_ks}</span>
        </span>
        {pick.recommend_over && (
          <span className="font-semibold text-emerald-400">✓ OVER</span>
        )}
      </div>
    </Link>
  );
};

export default async function HomePage() {
  const supabase = await createClient();
  const todayDate = new Date().toISOString().slice(0, 10);

  const [{ data: run }, { data: topPicksRaw }] = await Promise.all([
    supabase
      .from('pipeline_runs')
      .select('run_date, computed_at, pitchers_computed, pitchers_failed, status')
      .order('computed_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('daily_salci_scores')
      .select('pitcher_id, salci_total, grade, floor_ks, ceiling_ks, expected_ks, recommend_over, opponent, is_home, pitchers(name, team)')
      .eq('game_date', todayDate)
      .order('salci_total', { ascending: false })
      .limit(3),
  ]);

  const topPicks = (topPicksRaw ?? []) as unknown as TopPick[];

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="flex flex-col gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
            Live Today
          </span>
          <span className="text-xs text-zinc-500">{currentDate}</span>
          <PipelineBadge run={run as PipelineRun | null} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
          Today&apos;s <span className="text-emerald-400">SALCI</span> Picks
        </h1>
        <p className="max-w-lg text-sm text-zinc-400 md:text-base">
          Statcast-powered strikeout projections for tonight&apos;s starters. SALCI scores
          above 80 signal high-confidence strikeout over plays.
        </p>
      </section>

      {/* Top 3 picks */}
      {topPicks.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
              Today&apos;s Top Picks
            </h2>
            <Link href="/pitchers" className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {topPicks.map((pick) => (
              <TopPickCard key={pick.pitcher_id} pick={pick} />
            ))}
          </div>
        </section>
      )}

      {/* Quick nav cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/pitchers"
          className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-500/40 hover:bg-zinc-800/60">
          <div className="flex items-center justify-between">
            <TrendingUp className="text-emerald-400" size={22} />
            <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">View all →</span>
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Pitchers</p>
            <p className="text-xs text-zinc-500 mt-0.5">SALCI scores &amp; K projections</p>
          </div>
        </Link>

        <Link href="/hitters"
          className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-500/40 hover:bg-zinc-800/60">
          <div className="flex items-center justify-between">
            <Users className="text-emerald-400" size={22} />
            <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">View all →</span>
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Hitters</p>
            <p className="text-xs text-zinc-500 mt-0.5">Matchup heat maps &amp; hit likelihood</p>
          </div>
        </Link>

        <Link href="/analytics"
          className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-500/40 hover:bg-zinc-800/60">
          <div className="flex items-center justify-between">
            <BarChart2 className="text-emerald-400" size={22} />
            <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">Explore →</span>
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Analytics</p>
            <p className="text-xs text-zinc-500 mt-0.5">Interactive charts &amp; team trends</p>
          </div>
        </Link>
      </section>
    </div>
  );
}
