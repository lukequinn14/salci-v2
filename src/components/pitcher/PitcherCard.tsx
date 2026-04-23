'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import SalciGauge from './SalciGauge';
import KLineChart from './KLineChart';
import Badge from '@/components/ui/Badge';
import TeamLogo from '@/components/ui/TeamLogo';
import { GRADE_COLORS } from '@/lib/salci/grades';
import type { Pitcher } from '@/types/pitcher';

interface PitcherCardProps {
  pitcher: Pitcher;
  bookLine?: number;
}

const StatItem = ({ label, value }: { label: string; value: string | number }) => (
  <div className="flex flex-col items-center gap-0.5">
    <span className="text-xs text-zinc-500">{label}</span>
    <span className="text-sm font-semibold text-zinc-200">{value}</span>
  </div>
);

const ScoreBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="flex items-center gap-2">
    <span className="w-16 text-right text-xs text-zinc-500">{label}</span>
    <div className="flex-1 rounded-full bg-zinc-800 h-1.5 overflow-hidden">
      <div
        className={clsx('h-full rounded-full transition-all', color)}
        style={{ width: `${Math.round(value)}%` }}
      />
    </div>
    <span className="w-7 text-xs text-zinc-400">{Math.round(value)}</span>
  </div>
);

const PitcherCard = ({ pitcher, bookLine = 5.5 }: PitcherCardProps) => {
  const { salci } = pitcher;
  const overConfident = salci.recommendOver;

  return (
    <div
      className={clsx(
        'flex flex-col gap-4 rounded-xl border bg-zinc-900 p-4 transition-colors',
        overConfident
          ? 'border-emerald-500/40 shadow-[0_0_20px_-4px_rgba(52,211,153,0.15)]'
          : 'border-zinc-800'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeamLogo abbr={pitcher.team} size={32} />
          <div>
            <p className="font-semibold text-zinc-100 leading-tight">{pitcher.name}</p>
            <p className="text-xs text-zinc-500">
              {pitcher.team} {pitcher.isHome ? 'vs' : '@'} {pitcher.opponent}
              {pitcher.handedness && (
                <span className="ml-1 text-zinc-600">({pitcher.handedness}HP)</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {overConfident && (
            <Badge variant="emerald">
              <TrendingUp size={10} className="mr-1" />
              OVER
            </Badge>
          )}
          <span className={clsx('text-xs font-medium', GRADE_COLORS[salci.grade])}>
            {salci.grade}
          </span>
        </div>
      </div>

      {/* Gauge + K chart */}
      <div className="grid grid-cols-2 gap-4">
        <SalciGauge salci={salci} size={110} />
        <KLineChart salci={salci} bookLine={bookLine} />
      </div>

      {/* Component bars */}
      <div className="flex flex-col gap-1.5 rounded-lg bg-zinc-800/50 p-3">
        <ScoreBar label="Stuff" value={salci.stuff} color="bg-emerald-500" />
        <ScoreBar label="Matchup" value={salci.matchup} color="bg-sky-500" />
        <ScoreBar label="Workload" value={salci.workload} color="bg-violet-500" />
        <ScoreBar label="Location" value={salci.location} color="bg-zinc-500" />
      </div>

      {/* Season stats */}
      {(pitcher.era > 0 || pitcher.kPer9 > 0) && (
        <div className="grid grid-cols-3 divide-x divide-zinc-800 rounded-lg bg-zinc-800/30 py-2">
          <StatItem label="ERA" value={pitcher.era.toFixed(2)} />
          <StatItem label="WHIP" value={pitcher.whip.toFixed(2)} />
          <StatItem label="K/9" value={pitcher.kPer9.toFixed(1)} />
        </div>
      )}

      {/* Floor / ceiling row */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className="text-zinc-500">K range</span>
          <span className="font-semibold text-zinc-300">
            {salci.floor}–{salci.ceiling}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          {overConfident ? (
            <TrendingUp size={13} className="text-emerald-400" />
          ) : salci.floor < bookLine - 1 ? (
            <TrendingDown size={13} className="text-red-400" />
          ) : (
            <Minus size={13} />
          )}
          <span>Line {bookLine}</span>
        </div>
      </div>

      {/* Detail link */}
      <Link
        href={`/pitcher/${pitcher.id}`}
        className="flex items-center justify-center gap-1 rounded-lg border border-zinc-800 py-2 text-xs text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
      >
        Full breakdown <ArrowRight size={12} />
      </Link>
    </div>
  );
};

export default PitcherCard;
