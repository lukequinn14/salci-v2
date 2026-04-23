import { TrendingUp, Users, BarChart2, Zap } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section className="flex flex-col gap-3 pt-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
            Live Today
          </span>
          <span className="text-xs text-zinc-500">Apr 23, 2026</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 md:text-4xl">
          Today&apos;s <span className="text-emerald-400">SALCI</span> Picks
        </h1>
        <p className="max-w-lg text-sm text-zinc-400 md:text-base">
          Statcast-powered strikeout projections for tonight&apos;s starters. SALCI scores
          above 80 signal high-confidence strikeout over plays.
        </p>
      </section>

      {/* Quick nav cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          href="/pitchers"
          className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-500/40 hover:bg-zinc-800/60"
        >
          <div className="flex items-center justify-between">
            <TrendingUp className="text-emerald-400" size={22} />
            <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
              View all →
            </span>
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Pitchers</p>
            <p className="text-xs text-zinc-500 mt-0.5">SALCI scores &amp; K projections</p>
          </div>
        </Link>

        <Link
          href="/hitters"
          className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-500/40 hover:bg-zinc-800/60"
        >
          <div className="flex items-center justify-between">
            <Users className="text-emerald-400" size={22} />
            <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
              View all →
            </span>
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Hitters</p>
            <p className="text-xs text-zinc-500 mt-0.5">Matchup heat maps &amp; hit likelihood</p>
          </div>
        </Link>

        <Link
          href="/analytics"
          className="group flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition-colors hover:border-emerald-500/40 hover:bg-zinc-800/60"
        >
          <div className="flex items-center justify-between">
            <BarChart2 className="text-emerald-400" size={22} />
            <span className="text-xs text-zinc-600 group-hover:text-zinc-400 transition-colors">
              Explore →
            </span>
          </div>
          <div>
            <p className="font-semibold text-zinc-100">Analytics</p>
            <p className="text-xs text-zinc-500 mt-0.5">Interactive charts &amp; team trends</p>
          </div>
        </Link>
      </section>

      {/* Coming soon banner */}
      <section className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <Zap className="shrink-0 text-emerald-400" size={18} />
        <p className="text-sm text-zinc-400">
          Pitcher data loading soon — SALCI analytics pipeline is being connected.
        </p>
      </section>
    </div>
  );
}
