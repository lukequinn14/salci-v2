'use client';

import { getTeamLogoUrl } from '@/lib/mlb-api/logos';

interface TeamLogoProps {
  abbr: string;
  size?: number;
  darkBg?: boolean;
  className?: string;
}

const TeamLogo = ({ abbr, size = 24, darkBg = true, className = '' }: TeamLogoProps) => (
  <img
    src={getTeamLogoUrl(abbr, darkBg)}
    alt={abbr}
    width={size}
    height={size}
    className={`object-contain ${className}`}
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />
);

export default TeamLogo;
