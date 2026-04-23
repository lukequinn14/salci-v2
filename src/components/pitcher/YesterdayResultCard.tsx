'use client';

import { clsx } from 'clsx';
import TeamLogo from '@/components/ui/TeamLogo';
import type { YesterdayResult } from '@/types/results';

interface YesterdayResultCardProps {
  result: YesterdayResult;
}

const YesterdayResultCard = ({ result }: YesterdayResultCardProps) => {
  const hasActual = result.actualKs !== null;
  const overHit = hasActual && result.actualKs! > result.bookLine;
  const underHit = hasActual && result.actualKs! < result.bookLine;

  const maxK = result.predictedCeiling + 2;
  const toP = (v: number) => `${Math.max(0, Math.min(100, (v / maxK) * 100))}%`;

  const actualLabel = !hasActual
    ? 'Pending'
    : overHit
    ? `${result.actualKs} Ks — Over`
    : underHit
    ? `${result.actualKs} Ks — Under`
    : `${result.actualKs} Ks — Push`;

  const actualColor = !hasActual
    ? 'text-zinc-600'
    : overHit
    ? 'text-emerald-400'
    : underHit
    ? 'text-red-400'
    : 'text-yellow-400';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <TeamLogo abbr={result.teamAbbr} size={28} />
          <div>
            <p className="font-semibold text-zinc-100 text-sm">{result.pitcherName}</p>
            <p className="text-xs text-zinc-500">
              {result.teamAbbr} {result.isHome ? 'vs' : '@'} {result.opponentAbbr}
            </p>
          </div>
        </div>
        <span className={clsx('text-sm font-bold', actualColor)}>{actualLabel}</span>
      </div>

      {/* Range bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Projected {result.predictedFloor}–{result.predictedCeiling} Ks</span>
          <span>Line {result.bookLine}</span>
        </div>
        <div className="relative h-4 rounded-full bg-zinc-800 overflow-hidden">
          {/* Projected range band */}
          <div
            className="absolute top-0 bottom-0 bg-zinc-700/60 rounded"
            style={{ left: toP(result.predictedFloor), width: `calc(${toP(result.predictedCeiling)} - ${toP(result.predictedFloor)})` }}
          />
          {/* Book line marker */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400" style={{ left: toP(result.bookLine) }} />
          {/* Actual Ks marker */}
          {hasActual && (
            <div
              className={clsx('absolute top-0.5 bottom-0.5 w-1.5 rounded-full', overHit ? 'bg-emerald-400' : underHit ? 'bg-red-400' : 'bg-yellow-400')}
              style={{ left: `calc(${toP(result.actualKs!)} - 3px)` }}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-600">
          <span>Exp {(Math.round(result.expectedKs * 10) / 10).toFixed(1)} Ks</span>
          <span className={actualColor}>{hasActual ? `Actual: ${result.actualKs}` : 'Result pending'}</span>
        </div>
      </div>
    </div>
  );
};

export default YesterdayResultCard;
