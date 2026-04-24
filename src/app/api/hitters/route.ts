import { NextResponse } from 'next/server';
import { getTodayStarters, getHitterSeasonStats, getLineup, getTeamRoster } from '@/lib/mlb-api/statsapi';
import { calculateHitLikelihood } from '@/lib/salci/hit-likelihood';
import { createClient } from '@/lib/supabase/server';
import type { HitterMatchup } from '@/types/hitter';

const today = () => new Date().toISOString().slice(0, 10);

interface PitcherCache {
  id: number;
  name: string;
  team: string;
  teamAbbr: string;
  hand: string;
  stuffPlus: number;
  locationPlus: number;
  kPct: number;
  era: number;
  whip: number;
  salciTotal: number;
}

interface HitterEntry {
  id: number;
  fullName: string;
  battingOrder: number;
  handedness: string;
  lineupStatus: 'confirmed' | 'probable';
}

export const GET = async (): Promise<NextResponse> => {
  const gameDate = today();
  const supabase = await createClient();

  const starters = await getTodayStarters(gameDate);
  if (starters.length === 0) {
    return NextResponse.json({ matchups: [], gameDate });
  }

  const { data: pitcherRows } = await supabase
    .from('daily_salci_scores')
    .select('pitcher_id, salci_total, pitchers(name, team, handedness, stuff_plus, location_plus, era, whip, k_per_9)')
    .eq('game_date', gameDate);

  const pitcherMap = new Map<number, PitcherCache>();
  for (const row of (pitcherRows ?? []) as unknown as Array<{
    pitcher_id: number;
    salci_total: number;
    pitchers: { name: string; team: string; handedness: string; stuff_plus: number; location_plus: number; k_per_9: number; era: number; whip: number } | null;
  }>) {
    const p = row.pitchers;
    if (!p) continue;
    pitcherMap.set(row.pitcher_id, {
      id: row.pitcher_id,
      name: p.name ?? '',
      team: p.team ?? '',
      teamAbbr: '',
      hand: p.handedness ?? 'R',
      stuffPlus: p.stuff_plus ?? 100,
      locationPlus: p.location_plus ?? 100,
      kPct: (p.k_per_9 ?? 8.5) / 27,
      era: p.era ?? 4.0,
      whip: p.whip ?? 1.3,
      salciTotal: row.salci_total ?? 0,
    });
  }

  const matchups: HitterMatchup[] = [];
  const processedGames = new Set<number>();

  for (const start of starters) {
    if (processedGames.has(start.gamePk)) continue;
    processedGames.add(start.gamePk);

    const gamePitchers = starters.filter((s) => s.gamePk === start.gamePk);
    const homePitcherStart = gamePitchers.find((p) => p.isHome);
    const awayPitcherStart = gamePitchers.find((p) => !p.isHome);

    const homeTeamId = homePitcherStart?.teamId ?? awayPitcherStart?.opponentId;
    const awayTeamId = awayPitcherStart?.teamId ?? homePitcherStart?.opponentId;
    const homeTeamAbbr = homePitcherStart?.teamAbbr ?? awayPitcherStart?.opponentAbbr ?? '';
    const awayTeamAbbr = awayPitcherStart?.teamAbbr ?? homePitcherStart?.opponentAbbr ?? '';

    const lineupEntries = await getLineup(start.gamePk);
    const hasConfirmedLineup = lineupEntries.length > 0;

    // Resolve hitter lists per team side
    const getHitterList = async (
      side: 'away' | 'home',
      teamId: number | undefined,
    ): Promise<HitterEntry[]> => {
      const confirmed = lineupEntries.filter((h) => h.side === side);
      if (hasConfirmedLineup && confirmed.length > 0) {
        return confirmed.map((h) => ({ ...h, fullName: '', lineupStatus: 'confirmed' as const }));
      }
      if (!teamId) return [];
      const roster = await getTeamRoster(teamId);
      return roster
        .filter((p) => p.primaryPosition !== 'P')
        .map((p) => ({
          id: p.id,
          fullName: p.fullName,
          battingOrder: 0,
          handedness: p.handedness,
          lineupStatus: 'probable' as const,
        }));
    };

    const [awayHitters, homeHitters] = await Promise.all([
      getHitterList('away', awayTeamId),
      getHitterList('home', homeTeamId),
    ]);

    // Process a list of hitters against a given opposing pitcher
    const processHitters = async (
      hitterEntries: HitterEntry[],
      facingPitcherId: number | undefined,
      facingPitcherFullName: string,
      hitterTeamAbbr: string,
    ) => {
      const pitcher = facingPitcherId ? pitcherMap.get(facingPitcherId) : null;

      await Promise.allSettled(
        hitterEntries.map(async (hitterEntry) => {
          const hitterStats = await getHitterSeasonStats(hitterEntry.id, hitterEntry.fullName || `Player ${hitterEntry.id}`);

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
            pitcherSalciTotal: pitcher?.salciTotal ?? 0,
            pitcherHand: (pitcher?.hand ?? 'R') as 'L' | 'R',
            hitterHand: hitterEntry.handedness as 'L' | 'R' | 'S',
            isHome: hitterTeamAbbr === homeTeamAbbr,
          });

          matchups.push({
            hitter: {
              id: hitterEntry.id,
              name: hitterStats?.fullName ?? (hitterEntry.fullName || `Player ${hitterEntry.id}`),
              team: hitterTeamAbbr,
              handedness: hitterEntry.handedness as 'L' | 'R' | 'S',
              battingOrder: hitterEntry.battingOrder,
              lineupStatus: hitterEntry.lineupStatus,
              bavg,
              ops,
              kPct,
              zoneContactPct: 0.82,
              chaseRate: 0.28,
              hitLikelihood: Math.round(result.probability * 100),
              hitGrade: result.grade,
            },
            pitcherId: facingPitcherId ?? 0,
            pitcherName: pitcher?.name ?? facingPitcherFullName,
            pitcherTeam: pitcher?.team ?? (facingPitcherId ? `ID${facingPitcherId}` : '—'),
            pitcherSalciTotal: pitcher?.salciTotal ?? 0,
            platoonAdvantage:
              (pitcher?.hand === 'L' && hitterEntry.handedness === 'R') ||
              (pitcher?.hand === 'R' && hitterEntry.handedness === 'L'),
            kLikelihood: Math.round(result.factors.pitcherDifficulty * 100),
          });
        }),
      );
    };

    await Promise.all([
      // Away hitters face the home pitcher
      homePitcherStart
        ? processHitters(awayHitters, homePitcherStart.pitcher.id, homePitcherStart.pitcher.fullName, awayTeamAbbr)
        : Promise.resolve(),
      // Home hitters face the away pitcher
      awayPitcherStart
        ? processHitters(homeHitters, awayPitcherStart.pitcher.id, awayPitcherStart.pitcher.fullName, homeTeamAbbr)
        : Promise.resolve(),
    ]);
  }

  matchups.sort((a, b) => b.hitter.hitLikelihood - a.hitter.hitLikelihood);
  return NextResponse.json({ matchups, gameDate });
};
