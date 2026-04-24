'use client';

import { useState } from 'react';
import { getTeamLogoUrl } from '@/lib/mlb-api/logos';

interface TeamLogoProps {
  abbr: string;
  size?: number;
  darkBg?: boolean;
  className?: string;
}

const TeamLogo = ({ abbr, size = 24, darkBg = true, className = '' }: TeamLogoProps) => {
  const [failed, setFailed] = useState(false);

  if (failed || !abbr) {
    return (
      <span
        style={{ width: size, height: size, fontSize: Math.max(6, Math.floor(size * 0.42)) }}
        className={`inline-flex items-center justify-center rounded-sm bg-zinc-700 text-zinc-300 font-bold shrink-0 leading-none ${className}`}
      >
        {abbr?.slice(0, 2) ?? '?'}
      </span>
    );
  }

  return (
    <img
      src={getTeamLogoUrl(abbr, darkBg)}
      alt={abbr}
      width={size}
      height={size}
      className={`object-contain ${className}`}
      onError={() => setFailed(true)}
    />
  );
};

export default TeamLogo;
