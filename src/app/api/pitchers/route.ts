import { NextResponse } from 'next/server';
import { getTodayStarters, type ScheduledStart } from '@/lib/mlb-api/statsapi';
import { fetchStatcastCSV, computeArsenal, computeStuffPlusFromArsenal, computeLocationPlus, computeCswPct } from '@/lib/mlb-api/statcast';
import { computeSalci } from '@/lib/salci/scoring';
import { getBookLineForPitcher } from '@/lib/odds/fetcher';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Pitcher } from '@/types/pitcher';

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// Row shape returned by the Supabase join query
interface ScoreRow {
  pitcher_id: number;
  salci_total: number;
  stuff_score: number;
  location_score: number;
  matchup_score: number;
  workload_score: number;
  grade: string;
  floor_ks: number;
  ceiling_ks: number;
  expected_ks: number;
  buffer: number;
  recommend_over: boolean;
  book_line: number | null;
  opponent: string | null;
  is_home: boolean | null;
  computed_at: string | null;
  pitchers: {
    name: string;
    team: string;
    handedness: string | null;
    stuff_plus: number | null;
    location_plus: number | null;
    csw_pct: number | null;
    era: number | null;
    whip: number | null;
    k_per_9: number | null;
  } | null;
}

const rowToPitcher = (row: ScoreRow, gameDate: string): Pitcher => {
  const p = row.pitchers;
  return {
    id: row.pitcher_id,
    name: p?.name ?? `Pitcher #${row.pitcher_id}`,
    team: p?.team ?? '—',
    opponent: row.opponent ?? '—',
    isHome: row.is_home ?? false,
    handedness: ((p?.handedness ?? 'R') as 'L' | 'R'),
    gameDate,
    era: p?.era ?? 0,
    whip: p?.whip ?? 0,
    kPer9: p?.k_per_9 ?? 0,
    stuffPlus: p?.stuff_plus ?? 100,
    locationPlus: p?.location_plus ?? 100,
    cswPct: p?.csw_pct ?? 0.29,
    salci: {
      total: row.salci_total,
      stuff: row.stuff_score,
      location: row.location_score,
      matchup: row.matchup_score,
      workload: row.workload_score,
      grade: row.grade as Pitcher['salci']['grade'],
      floor: row.floor_ks,
      ceiling: row.ceiling_ks,
      expectedKs: row.expected_ks,
      buffer: row.buffer,
      recommendOver: row.recommend_over,
    },
  };
};

const computeLivePitcher = async (
  start: ScheduledStart,
  gameDate: string,
  supabase: SupabaseClient
): Promise<Pitcher> => {
  // Check for a per-pitcher cache entry before hitting Statcast
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
      handedness: ((pitcherRow?.handedness ?? 'R') as 'L' | 'R'),
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

  // Live Statcast — fetchStatcastCSV has its own 8s AbortController timeout
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
    stuffPlus, locationPlus, cswPct,
    oppKPct: 0.22, oppZoneContact: 0.82, sameSidePct: 0.5,
    pPerIP: 16, projectedBF: 21, managerLeash: 70, tttKDrop: 1,
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

export const GET = async (): Promise<NextResponse> => {
  const supabase = await createClient();
  const gameDate = today();

  // ── Fast path: bulk read from pre-computed scores ──────────────────────────
  const { data: cachedScores } = await supabase
    .from('daily_salci_scores')
    .select(`
      pitcher_id, salci_total, stuff_score, location_score, matchup_score, workload_score,
      grade, floor_ks, ceiling_ks, expected_ks, buffer, recommend_over, book_line,
      opponent, is_home, computed_at,
      pitchers (name, team, handedness, stuff_plus, location_plus, csw_pct, era, whip, k_per_9)
    `)
    .eq('game_date', gameDate);

  if (cachedScores && cachedScores.length > 0) {
    const pitchers = (cachedScores as unknown as ScoreRow[])
      .map((row) => rowToPitcher(row, gameDate))
      .sort((a, b) => b.salci.total - a.salci.total);

    const lastUpdated = (cachedScores as unknown as ScoreRow[])
      .map((r) => r.computed_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return NextResponse.json({ pitchers, gameDate, lastUpdated, source: 'cache' });
  }

  // ── Slow path: live Statcast fallback ──────────────────────────────────────
  const starters = await getTodayStarters(gameDate);
  if (starters.length === 0) {
    return NextResponse.json({ pitchers: [], gameDate, lastUpdated: null, source: 'live' });
  }

  const BATCH_SIZE = 4;
  const pitchers: Pitcher[] = [];

  for (let i = 0; i < starters.length; i += BATCH_SIZE) {
    const batch = starters.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((start) => computeLivePitcher(start, gameDate, supabase))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') pitchers.push(r.value);
    }
  }

  pitchers.sort((a, b) => b.salci.total - a.salci.total);
  return NextResponse.json({ pitchers, gameDate, lastUpdated: null, source: 'live' });
};
