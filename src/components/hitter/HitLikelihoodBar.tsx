'use client';

import { clsx } from 'clsx';

interface HitLikelihoodBarProps {
  value: number;
  label?: string;
  showValue?: boolean;
}

const HitLikelihoodBar = ({ value, label, showValue = true }: HitLikelihoodBarProps) => {
  const color =
    value >= 65
      ? 'bg-emerald-500'
      : value >= 45
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      {label && <span className="w-24 truncate text-xs text-zinc-400">{label}</span>}
      <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all', color)}
          style={{ width: `${value}%` }}
        />
      </div>
      {showValue && (
        <span className="w-9 text-right text-xs font-medium text-zinc-400">{Math.round(value)}%</span>
      )}
    </div>
  );
};

export default HitLikelihoodBar;
