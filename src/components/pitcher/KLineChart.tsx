'use client';

import { clsx } from 'clsx';
import type { SalciScore } from '@/types/salci';

interface KLineChartProps {
  salci: SalciScore;
  bookLine: number;
}

const KLineChart = ({ salci, bookLine }: KLineChartProps) => {
  const max = Math.max(salci.ceiling + 2, bookLine + 2, 10);
  const toP = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;

  const expectedLabel = (Math.round(salci.expectedKs * 10) / 10).toFixed(1);
  const expectedAboveBook = salci.expectedKs > bookLine;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">K Projection</p>
        {salci.recommendOver && (
          <span className="text-xs font-semibold text-emerald-400">✓ OVER</span>
        )}
      </div>

      {/* Track visualization */}
      <div className="relative mx-1" style={{ height: 44 }}>
        {/* Base track */}
        <div className="absolute h-1.5 rounded-full bg-zinc-800"
          style={{ top: 18, left: toP(salci.floor), right: `${100 - parseFloat(toP(salci.ceiling))}%` }}
        />
        {/* Red segment: floor → bookLine */}
        <div
          className="absolute h-1.5 bg-red-500/60"
          style={{
            top: 18,
            left: toP(salci.floor),
            width: `calc(${toP(Math.min(bookLine, salci.ceiling))} - ${toP(salci.floor)})`,
          }}
        />
        {/* Emerald segment: bookLine → ceiling */}
        {salci.ceiling > bookLine && (
          <div
            className="absolute h-1.5 rounded-r-full bg-emerald-500/60"
            style={{
              top: 18,
              left: toP(bookLine),
              width: `calc(${toP(salci.ceiling)} - ${toP(bookLine)})`,
            }}
          />
        )}

        {/* Book line tick */}
        <div className="absolute w-px bg-amber-400" style={{ left: toP(bookLine), top: 10, height: 16 }} />
        <span
          className="absolute text-[10px] text-amber-400 -translate-x-1/2 whitespace-nowrap"
          style={{ left: toP(bookLine), top: 28 }}
        >
          {bookLine}
        </span>

        {/* Floor label */}
        <span
          className="absolute text-[10px] text-zinc-600 -translate-x-1/2"
          style={{ left: toP(salci.floor), top: 28 }}
        >
          {salci.floor}
        </span>

        {/* Ceiling label */}
        <span
          className="absolute text-[10px] text-zinc-600 -translate-x-1/2"
          style={{ left: toP(salci.ceiling), top: 28 }}
        >
          {salci.ceiling}
        </span>

        {/* Expected Ks dot + label */}
        <div
          className={clsx(
            'absolute w-3.5 h-3.5 rounded-full border-2 border-zinc-950 -translate-x-1/2',
            expectedAboveBook ? 'bg-emerald-400' : 'bg-zinc-400'
          )}
          style={{ left: toP(salci.expectedKs), top: 15 }}
        />
        <span
          className={clsx(
            'absolute text-[10px] font-bold -translate-x-1/2 whitespace-nowrap',
            expectedAboveBook ? 'text-emerald-400' : 'text-zinc-400'
          )}
          style={{ left: toP(salci.expectedKs), top: 1 }}
        >
          {expectedLabel}
        </span>
      </div>
    </div>
  );
};

export default KLineChart;
