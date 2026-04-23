import { NextResponse } from 'next/server';
import { getAllTeamPitchingStats } from '@/lib/mlb-api/statsapi';
import type { TeamPitchingStats, DateRange } from '@/types/results';

export const revalidate = 3600;

const FIP_CONSTANT = 3.10;

const computeFip = (strikeOuts: number, baseOnBalls: number, homeRuns: number, ip: number): number => {
  if (ip === 0) return 0;
  return ((13 * homeRuns) + (3 * baseOnBalls) - (2 * strikeOuts)) / ip + FIP_CONSTANT;
};

export const GET = async (request: Request): Promise<NextResponse> => {
  const { searchParams } = new URL(request.url);
  const range = (searchParams.get('range') ?? 'season') as DateRange;

  const rawStats = await getAllTeamPitchingStats(range);

  if (rawStats.length === 0) {
    return NextResponse.json({ teams: [], range, updatedAt: new Date().toISOString() });
  }

  const teams: TeamPitchingStats[] = rawStats.map((t) => ({
    teamId: t.teamId,
    team: t.teamName,
    abbr: t.abbr,
    era: Math.round(t.era * 100) / 100,
    fip: Math.round(computeFip(t.strikeOuts, t.baseOnBalls, t.homeRuns, t.inningsPitched) * 100) / 100,
    kPct: t.battersFaced > 0 ? Math.round((t.strikeOuts / t.battersFaced) * 1000) / 10 : 0,
    whip: Math.round(t.whip * 100) / 100,
    bbPct: t.battersFaced > 0 ? Math.round((t.baseOnBalls / t.battersFaced) * 1000) / 10 : 0,
    inningsPitched: Math.round(t.inningsPitched * 3) / 3,
    strikeOuts: t.strikeOuts,
    gamesPlayed: t.gamesPlayed,
  }));

  // Sort by ERA ascending (best first) as default
  teams.sort((a, b) => a.era - b.era);

  return NextResponse.json({ teams, range, updatedAt: new Date().toISOString() });
};
