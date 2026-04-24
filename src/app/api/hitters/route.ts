import { NextResponse } from 'next/server';
import { getTodayStarters, getHitterSeasonStats, getLineup } from '@/lib/mlb-api/statsapi';
import { calculateHitLikelihood } from '@/lib/salci/hit-likelihood';
import { createClient } from '@/lib/supabase/server';
import type { HitterMatchup } from '@/types/hitter';

const today = () => new Date().toISOString().slice(0, 10);

interface PitcherCache {
  id: number;
  name: string;
  team: string;
  hand: string;
  stuffPlus: number;
  locationPlus: number;
  kPct: number;
  era: number;
  whip: number;
}

export const GET = async (): Promise<NextResponse> => {
  const gameDate = today();
  const supabase = await createClient();

  // Get today's starters and their cached SALCI data
  const starters = await getTodayStarters(gameDate);
  if (starters.length === 0) {
    return NextResponse.json({ matchups: [], gameDate });
  }

  // Build pitcher lookup from Supabase cache
  const { data: pitcherRows } = await supabase
    .from('daily_salci_scores')
    .select('pitcher_id, pitchers(name, team, handedness, stuff_plus, location_plus, csw_pct, era, whip, k_per_9)')
    .eq('game_date', gameDate);

  const pitcherMap = new Map<number, PitcherCache>();
  for (const row of (pitcherRows ?? []) as unknown as Array<{
    pitcher_id: number;
    pitchers: { name: string; team: string; handedness: string; stuff_plus: number; location_plus: number; k_per_9: number; era: number; whip: number } | null;
  }>) {
    const p = row.pitchers;
    if (!p) continue;
    pitcherMap.set(row.pitcher_id, {
      id: row.pitcher_id,
      name: p.name ?? '',
      team: p.team ?? '',
      hand: p.handedness ?? 'R',
      stuffPlus: p.stuff_plus ?? 100,
      locationPlus: p.location_plus ?? 100,
      kPct: (p.k_per_9 ?? 8.5) / 27,
      era: p.era ?? 4.0,
      whip: p.whip ?? 1.3,
    });
  }

  const matchups: HitterMatchup[] = [];

  // Process each game — get lineup for each
  const processedGames = new Set<number>();

  for (const start of starters) {
    if (processedGames.has(start.gamePk)) continue;
    processedGames.add(start.gamePk);

    const lineup = await getLineup(start.gamePk);
    if (lineup.length === 0) continue;

    // Find both pitchers for this game
    const gamePitchers = starters.filter((s) => s.gamePk === start.gamePk);

    for (const hitterEntry of lineup) {
      // Determine which pitcher this hitter faces
      const facingStarter = gamePitchers.find((p) => p.teamAbbr !== start.teamAbbr) ?? gamePitchers[0];
      const pitcher = facingStarter ? pitcherMap.get(facingStarter.pitcher.id) : null;

      // Fetch hitter season stats (batch these in production with caching)
      const hitterStats = await getHitterSeasonStats(hitterEntry.id, `Player ${hitterEntry.id}`);

      const bavg = hitterStats?.avg ?? 0.248;
      const ops = hitterStats?.ops ?? 0.710;
      const kPct = hitterStats?.kPct ?? 0.22;

      const result = calculateHitLikelihood({
        hitterBavg: bavg,
        hitterOPS: ops,
        hitterKPct: kPct,
        hitterContactPct: 0.82,
        pitcherStuffPlus: pitcher?.stuffPlus ?? 100,
        pitcherLocationPlus: pitcher?.locationPlus ?? 100,
        pitcherKPct: pitcher?.kPct ?? 0.22,
        pitcherERA: pitcher?.era ?? 4.0,
        pitcherWHIP: pitcher?.whip ?? 1.3,
        pitcherHand: (pitcher?.hand ?? 'R') as 'L' | 'R',
        hitterHand: hitterEntry.handedness as 'L' | 'R' | 'S',
        isHome: start.isHome,
      });

      matchups.push({
        hitter: {
          id: hitterEntry.id,
          name: hitterStats?.fullName ?? `Player ${hitterEntry.id}`,
          team: start.isHome ? start.opponentAbbr : start.teamAbbr,
          handedness: hitterEntry.handedness as 'L' | 'R' | 'S',
          battingOrder: hitterEntry.battingOrder,
          bavg,
          ops,
          kPct,
          zoneContactPct: 0.82,
          chaseRate: 0.28,
          hitLikelihood: Math.round(result.probability * 100),
          hitGrade: result.grade,
        },
        pitcherId: facingStarter?.pitcher.id ?? 0,
        pitcherName: pitcher?.name ?? facingStarter?.pitcher.fullName ?? '—',
        pitcherTeam: pitcher?.team ?? facingStarter?.teamAbbr ?? '—',
        platoonAdvantage:
          (pitcher?.hand === 'L' && hitterEntry.handedness === 'R') ||
          (pitcher?.hand === 'R' && hitterEntry.handedness === 'L'),
        kLikelihood: Math.round(result.factors.pitcherDifficulty * 100),
      });
    }
  }

  // Sort by hit likelihood descending
  matchups.sort((a, b) => b.hitter.hitLikelihood - a.hitter.hitLikelihood);

  return NextResponse.json({ matchups: matchups.slice(0, 50), gameDate });
};
