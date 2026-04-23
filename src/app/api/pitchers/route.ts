import { NextResponse } from 'next/server';
import { getTodayStarters, type ScheduledStart } from '@/lib/mlb-api/statsapi';
import { fetchStatcastCSV, computeArsenal, computeStuffPlusFromArsenal, computeLocationPlus, computeCswPct } from '@/lib/mlb-api/statcast';
import { computeSalci } from '@/lib/salci/scoring';
import { getBookLineForPitcher } from '@/lib/odds/fetcher';
import { createClient } from '@/lib/supabase/server';
import type { Pitcher } from '@/types/pitcher';
import type { SupabaseClient } from '@supabase/supabase-js';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const processPitcher = async (
  start: ScheduledStart,
  gameDate: string,
  supabase: SupabaseClient
): Promise<Pitcher> => {
  // Supabase cache check first
  const { data: cached } = await supabase
    .from('daily_salci_scores')
    .select('salci_total, stuff_score, location_score, matchup_score, workload_score, grade, floor_ks, ceiling_ks, expected_ks, buffer, recommend_over, book_line')
    .eq('pitcher_id', start.pitcher.id)
    .eq('game_date', gameDate)
    .single();

  if (cached) {
    const { data: pitcherRow } = await supabase
      .from('pitchers')
      .select('handedness, stuff_plus, location_plus, csw_pct, era, whip, k_per_9')
      .eq('id', start.pitcher.id)
      .single();

    return {
      id: start.pitcher.id,
      name: start.pitcher.fullName,
      team: start.teamAbbr,
      opponent: start.opponentAbbr,
      isHome: start.isHome,
      handedness: (pitcherRow?.handedness ?? 'R') as 'L' | 'R',
      gameDate,
      era: pitcherRow?.era ?? 0,
      whip: pitcherRow?.whip ?? 0,
      kPer9: pitcherRow?.k_per_9 ?? 0,
      stuffPlus: pitcherRow?.stuff_plus ?? 100,
      locationPlus: pitcherRow?.location_plus ?? 100,
      cswPct: pitcherRow?.csw_pct ?? 0.29,
      salci: {
        total: cached.salci_total,
        stuff: cached.stuff_score,
        location: cached.location_score,
        matchup: cached.matchup_score,
        workload: cached.workload_score,
        grade: cached.grade as Pitcher['salci']['grade'],
        floor: cached.floor_ks,
        ceiling: cached.ceiling_ks,
        expectedKs: cached.expected_ks,
        buffer: cached.buffer,
        recommendOver: cached.recommend_over,
      },
    };
  }

  // On-the-fly Statcast compute — fetchStatcastCSV has its own 8s timeout
  const [rows, bookLine] = await Promise.all([
    fetchStatcastCSV(start.pitcher.id, daysAgo(30), gameDate),
    getBookLineForPitcher(start.pitcher.fullName),
  ]);

  let stuffPlus = 100;
  let locationPlus = 100;
  let cswPct = 0.29;

  if (rows.length > 0) {
    cswPct = computeCswPct(rows);
    const arsenal = computeArsenal(rows);
    stuffPlus = computeStuffPlusFromArsenal(arsenal, cswPct);
    locationPlus = computeLocationPlus(rows);
  }

  const salci = computeSalci({
    stuffPlus,
    locationPlus,
    cswPct,
    oppKPct: 0.22,
    oppZoneContact: 0.82,
    sameSidePct: 0.5,
    pPerIP: 16,
    projectedBF: 21,
    managerLeash: 70,
    tttKDrop: 1,
    bookLine,
  });

  return {
    id: start.pitcher.id,
    name: start.pitcher.fullName,
    team: start.teamAbbr,
    opponent: start.opponentAbbr,
    isHome: start.isHome,
    handedness: 'R',
    gameDate,
    era: 0,
    whip: 0,
    kPer9: 0,
    stuffPlus,
    locationPlus,
    cswPct,
    salci,
  };
};

const processBatch = async (
  batch: ScheduledStart[],
  gameDate: string,
  supabase: SupabaseClient
): Promise<Pitcher[]> => {
  const results = await Promise.allSettled(
    batch.map((start) => processPitcher(start, gameDate, supabase))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<Pitcher> => r.status === 'fulfilled')
    .map((r) => r.value);
};

export const GET = async (): Promise<NextResponse> => {
  const supabase = await createClient();
  const gameDate = today();

  const starters = await getTodayStarters(gameDate);
  if (starters.length === 0) {
    return NextResponse.json({ pitchers: [], gameDate });
  }

  // Process in batches of 4 to avoid overwhelming Statcast
  const BATCH_SIZE = 4;
  const pitchers: Pitcher[] = [];

  for (let i = 0; i < starters.length; i += BATCH_SIZE) {
    const batch = starters.slice(i, i + BATCH_SIZE);
    const batchResults = await processBatch(batch, gameDate, supabase);
    pitchers.push(...batchResults);
  }

  pitchers.sort((a, b) => b.salci.total - a.salci.total);
  return NextResponse.json({ pitchers, gameDate });
};
