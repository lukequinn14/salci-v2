import { NextResponse } from 'next/server';
import { getTodayStarters, getStarterKsForGame } from '@/lib/mlb-api/statsapi';
import { fetchStatcastCSV, computeArsenal, computeStuffPlusFromArsenal, computeLocationPlus, computeCswPct } from '@/lib/mlb-api/statcast';
import { computeSalci } from '@/lib/salci/scoring';
import { getBookLineForPitcher } from '@/lib/odds/fetcher';
import { createClient } from '@/lib/supabase/server';
import type { YesterdayResult } from '@/types/results';

const dateOffset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const determineResult = (
  actualKs: number | null,
  bookLine: number,
  recommendOver: boolean
): YesterdayResult['result'] => {
  if (actualKs === null) return 'pending';
  if (!recommendOver) return 'pending';
  if (actualKs > bookLine) return 'win';
  if (actualKs < bookLine) return 'loss';
  return 'push';
};

export const GET = async (): Promise<NextResponse> => {
  const yesterday = dateOffset(-1);
  const twoDaysAgo = dateOffset(-31);

  const starters = await getTodayStarters(yesterday);
  if (starters.length === 0) {
    return NextResponse.json({ results: [], gameDate: yesterday });
  }

  const supabase = await createClient();
  const results: YesterdayResult[] = [];

  for (const start of starters) {
    // Get actual Ks from box score
    const boxScore = await getStarterKsForGame(start.gamePk);
    const starterBox = start.isHome ? boxScore.home : boxScore.away;
    const actualKs = starterBox?.pitcherId === start.pitcher.id ? (starterBox.strikeOuts ?? null) : null;

    // Check Supabase for pre-computed prediction
    const { data: cached } = await supabase
      .from('daily_salci_scores')
      .select('salci_total, grade, floor_ks, ceiling_ks, expected_ks, recommend_over, book_line')
      .eq('pitcher_id', start.pitcher.id)
      .eq('game_date', yesterday)
      .single();

    let salciTotal: number;
    let grade: YesterdayResult['salciGrade'];
    let predictedFloor: number;
    let predictedCeiling: number;
    let expectedKs: number;
    let recommendOver: boolean;
    let bookLine: number;

    if (cached) {
      salciTotal = cached.salci_total;
      grade = cached.grade as YesterdayResult['salciGrade'];
      predictedFloor = cached.floor_ks;
      predictedCeiling = cached.ceiling_ks;
      expectedKs = cached.expected_ks;
      recommendOver = cached.recommend_over;
      bookLine = cached.book_line ?? 5.5;
    } else {
      // Compute from Statcast
      const rows = await fetchStatcastCSV(start.pitcher.id, twoDaysAgo, yesterday, 8000, start.pitcher.fullName);
      bookLine = await getBookLineForPitcher(start.pitcher.fullName);

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
        matchupScore: 50,
        workloadScore: 50,
        projectedIP: 5.5,
        bookLine,
      });

      salciTotal = salci.total;
      grade = salci.grade;
      predictedFloor = salci.floor;
      predictedCeiling = salci.ceiling;
      expectedKs = salci.expectedKs;
      recommendOver = salci.recommendOver;
    }

    results.push({
      pitcherId: start.pitcher.id,
      pitcherName: start.pitcher.fullName,
      team: start.team,
      teamAbbr: start.teamAbbr,
      opponent: start.opponent,
      opponentAbbr: start.opponentAbbr,
      isHome: start.isHome,
      salciTotal,
      salciGrade: grade,
      predictedFloor,
      predictedCeiling,
      expectedKs,
      bookLine,
      actualKs,
      recommendOver,
      result: determineResult(actualKs, bookLine, recommendOver),
    });
  }

  // Sort: completed results first, then by SALCI score
  results.sort((a, b) => {
    if (a.actualKs !== null && b.actualKs === null) return -1;
    if (a.actualKs === null && b.actualKs !== null) return 1;
    return b.salciTotal - a.salciTotal;
  });

  return NextResponse.json({ results, gameDate: yesterday });
};
