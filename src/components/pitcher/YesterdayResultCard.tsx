'use client';

import { CheckCircle2, XCircle, MinusCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { GRADE_COLORS, GRADE_LABEL } from '@/lib/salci/grades';
import { getTeamLogoUrl } from '@/lib/mlb-api/logos';
import type { YesterdayResult } from '@/types/results';

interface YesterdayResultCardProps {
  result: YesterdayResult;
}

const ResultBadge = ({ result, recommendOver }: { result: YesterdayResult['result']; recommendOver: boolean }) => {
  if (!recommendOver) {
    return <span className="text-xs text-zinc-600">No bet</span>;
  }
  const configs = {
    win: { icon: CheckCircle2, color: 'text-emerald-400', label: 'OVER HIT' },
    loss: { icon: XCircle, color: 'text-red-400', label: 'MISSED' },
    push: { icon: MinusCircle, color: 'text-yellow-400', label: 'PUSH' },
    pending: { icon: Clock, color: 'text-zinc-500', label: 'Pending' },
  };
  const { icon: Icon, color, label } = configs[result];
  return (
    <span className={clsx('flex items-center gap-1 text-xs font-semibold', color)}>
      <Icon size={13} />
      {label}
    </span>
  );
};

const YesterdayResultCard = ({ result }: YesterdayResultCardProps) => {
  const hasActual = result.actualKs !== null;
  const overHit = hasActual && result.actualKs! > result.bookLine;
  const underHit = hasActual && result.actualKs! < result.bookLine;

  // Track bar: how actual Ks fall within projected floor-ceiling range
  const rangeSpan = Math.max(result.predictedCeiling - result.predictedFloor, 1);
  const maxK = result.predictedCeiling + 2;
  const actualPct = hasActual ? Math.min((result.actualKs! / maxK) * 100, 100) : null;
  const floorPct = (result.predictedFloor / maxK) * 100;
  const ceilPct = (result.predictedCeiling / maxK) * 100;
  const linePct = (result.bookLine / maxK) * 100;

  return (
    <div
      className={clsx(
        'flex flex-col gap-3 rounded-xl border bg-zinc-900 p-4',
        result.result === 'win' ? 'border-emerald-500/30' :
        result.result === 'loss' ? 'border-red-500/20' :
        'border-zinc-800'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center bg-white rounded-full w-8 h-8 shadow-sm shrink-0">
            <img
              src={getTeamLogoUrl(result.teamAbbr)}
              alt={result.teamAbbr}
              className="w-6 h-6 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div>
            <p className="font-semibold text-zinc-100 text-sm">{result.pitcherName}</p>
            <p className="text-xs text-zinc-500">
              {result.teamAbbr} {result.isHome ? 'vs' : '@'} {result.opponentAbbr}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ResultBadge result={result.result} recommendOver={result.recommendOver} />
          <span className={clsx('text-xs font-semibold', GRADE_COLORS[result.salciGrade])}>
            {result.salciGrade} · {Math.round(result.salciTotal)}
          </span>
        </div>
      </div>

      {/* K bar visualization */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>K Projection vs Actual</span>
          <span>
            {result.predictedFloor}–{result.predictedCeiling} projected
          </span>
        </div>
        <div className="relative h-5 rounded-full bg-zinc-800 overflow-hidden">
          {/* Projected range band */}
          <div
            className="absolute top-0 bottom-0 bg-zinc-700/60 rounded"
            style={{ left: `${floorPct}%`, width: `${ceilPct - floorPct}%` }}
          />
          {/* Book line marker */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
            style={{ left: `${linePct}%` }}
          />
          {/* Actual Ks marker */}
          {hasActual && actualPct !== null && (
            <div
              className={clsx(
                'absolute top-0.5 bottom-0.5 w-1.5 rounded-full',
                overHit ? 'bg-emerald-400' : underHit ? 'bg-red-400' : 'bg-yellow-400'
              )}
              style={{ left: `${actualPct - 0.75}%` }}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-600">
            Line: <span className="text-amber-400 font-medium">{result.bookLine}</span>
          </span>
          <span className={clsx(
            'font-semibold',
            !hasActual ? 'text-zinc-600' :
            overHit ? 'text-emerald-400' :
            underHit ? 'text-red-400' :
            'text-yellow-400'
          )}>
            {hasActual ? `Actual: ${result.actualKs} Ks` : 'Result pending'}
          </span>
        </div>
      </div>

      {/* Grade label */}
      <p className={clsx('text-xs', GRADE_COLORS[result.salciGrade])}>
        {GRADE_LABEL[result.salciGrade]} · Expected {(Math.round(result.expectedKs * 10) / 10).toFixed(1)} Ks
        {result.recommendOver && (
          <span className="ml-2 text-zinc-500">
            (OVER rec. floor {result.predictedFloor} ≥ {result.bookLine + 2})
          </span>
        )}
      </p>
    </div>
  );
};

export default YesterdayResultCard;
