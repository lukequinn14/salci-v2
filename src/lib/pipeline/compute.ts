import { getTodayStarters, type ScheduledStart } from '@/lib/mlb-api/statsapi';
import {
  fetchStatcastCSV,
  computeArsenal,
  computeStuffPlusFromArsenal,
  computeLocationPlus,
  computeCswPct,
} from '@/lib/mlb-api/statcast';
import { computeSalci } from '@/lib/salci/scoring';
import { getBookLineForPitcher } from '@/lib/odds/fetcher';
import { createServiceClient } from '@/lib/supabase/service';

export interface PipelineResult {
  computed: number;
  failed: number;
  date: string;
  computedAt: string;
}

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const computeAndStore = async (
  start: ScheduledStart,
  gameDate: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<boolean> => {
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

  const computedAt = new Date().toISOString();

  const [pitcherUpsert, scoreUpsert] = await Promise.all([
    supabase.from('pitchers').upsert(
      {
        id: start.pitcher.id,
        name: start.pitcher.fullName,
        team: start.teamAbbr,
        handedness: 'R',
        stuff_plus: stuffPlus,
        location_plus: locationPlus,
        csw_pct: cswPct,
        updated_at: computedAt,
      },
      { onConflict: 'id' }
    ),
    supabase.from('daily_salci_scores').upsert(
      {
        pitcher_id: start.pitcher.id,
        game_date: gameDate,
        salci_total: salci.total,
        stuff_score: salci.stuff,
        location_score: salci.location,
        matchup_score: salci.matchup,
        workload_score: salci.workload,
        grade: salci.grade,
        floor_ks: salci.floor,
        ceiling_ks: salci.ceiling,
        expected_ks: salci.expectedKs,
        buffer: salci.buffer,
        recommend_over: salci.recommendOver,
        book_line: bookLine,
        opponent: start.opponentAbbr,
        is_home: start.isHome,
        computed_at: computedAt,
      },
      { onConflict: 'pitcher_id,game_date' }
    ),
  ]);

  return !pitcherUpsert.error && !scoreUpsert.error;
};

export const runSalciPipeline = async (gameDate: string): Promise<PipelineResult> => {
  const supabase = createServiceClient();
  const starters = await getTodayStarters(gameDate);

  let computed = 0;
  let failed = 0;

  const BATCH_SIZE = 3;
  for (let i = 0; i < starters.length; i += BATCH_SIZE) {
    const batch = starters.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((start) => computeAndStore(start, gameDate, supabase))
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) computed++;
      else failed++;
    }
  }

  const computedAt = new Date().toISOString();
  const status = failed === 0 ? 'success' : computed === 0 ? 'failed' : 'partial';

  await supabase.from('pipeline_runs').insert({
    run_date: gameDate,
    computed_at: computedAt,
    pitchers_computed: computed,
    pitchers_failed: failed,
    status,
  });

  return { computed, failed, date: gameDate, computedAt };
};
