'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import TeamLogo from '@/components/ui/TeamLogo';
import { GRADE_COLORS, GRADE_BG_COLORS } from '@/lib/salci/grades';
import type { SalciScore } from '@/types/salci';

export interface TopPick {
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

interface TopPickCardProps {
  pick: TopPick;
}

const TopPickCard = ({ pick }: TopPickCardProps) => {
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
          <TeamLogo abbr={team} size={28} />
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

export default TopPickCard;
