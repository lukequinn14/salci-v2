'use client';

import { getTeamLogoUrl } from '@/lib/mlb-api/logos';
import HitLikelihoodBar from './HitLikelihoodBar';
import type { HitterMatchup } from '@/types/hitter';

interface HitterMatchupCardProps {
  matchup: HitterMatchup;
}

const HitterMatchupCard = ({ matchup }: HitterMatchupCardProps) => {
  const { hitter } = matchup;
  const isConfirmed = hitter.lineupStatus === 'confirmed';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center bg-white rounded-full w-8 h-8 shadow-sm shrink-0">
          <img
            src={getTeamLogoUrl(hitter.team)}
            alt={hitter.team}
            className="w-6 h-6 object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-100">{hitter.name}</p>
          <p className="text-xs text-zinc-500">
            {isConfirmed
              ? <span className="text-emerald-400 font-medium">#{hitter.battingOrder}</span>
              : <span className="text-zinc-500">Probable</span>}
            {' '}· {hitter.handedness}HB
            {matchup.platoonAdvantage && (
              <span className="ml-1 text-emerald-400">Platoon adv.</span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">K Like.</p>
          <p className="text-sm font-bold text-zinc-200">{Math.round(matchup.kLikelihood)}%</p>
        </div>
      </div>
      <HitLikelihoodBar value={hitter.hitLikelihood} label="Hit likelihood" />
      <div className="grid grid-cols-3 gap-x-2 text-xs text-zinc-500">
        <span>AVG: <span className="text-zinc-300">{hitter.bavg.toFixed(3)}</span></span>
        <span>OPS: <span className="text-zinc-300">{hitter.ops.toFixed(3)}</span></span>
        <span>K%: <span className="text-zinc-300">{(hitter.kPct * 100).toFixed(1)}%</span></span>
      </div>
    </div>
  );
};

export default HitterMatchupCard;
