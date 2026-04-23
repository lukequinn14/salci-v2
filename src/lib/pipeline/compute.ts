import { getTodayStarters, getPitcherSeasonStats, getPitcherLastNGames, type ScheduledStart } from '@/lib/mlb-api/statsapi';
import { computeSalci } from '@/lib/salci/scoring';
import { getBookLineForPitcher } from '@/lib/odds/fetcher';
import { createServiceClient } from '@/lib/supabase/service';

export interface PipelineResult {
  computed: number;
  failed: number;
  date: string;
  computedAt: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const deriveStuffPlus = (k9: number): number =>
  clamp(100 + ((k9 - 8.5) / 0.8) * 10, 70, 140);

const deriveLocationPlus = (whip: number): number =>
  clamp(100 + (1 - whip / 1.3) * 20, 75, 125);

const deriveCswPct = (strikeOuts: number, battersFaced: number): number =>
  battersFaced > 0
    ? clamp((strikeOuts / battersFaced) / 0.29, 0.20, 0.38)
    : 0.29;

const computeAndStore = async (
  start: ScheduledStart,
  gameDate: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<boolean> => {
  const [seasonStats, recentLog, bookLine] = await Promise.all([
    getPitcherSeasonStats(start.pitcher.id),
    getPitcherLastNGames(start.pitcher.id, 5),
    getBookLineForPitcher(start.pitcher.fullName),
  ]);

  // Proxy inputs derived from MLB Stats API — no Statcast needed
  const k9 = seasonStats?.k9 ?? recentLog.avgK9;
  const whip = seasonStats?.whip ?? 1.3;
  const strikeOuts = seasonStats?.strikeOuts ?? 0;
  const battersFaced = seasonStats?.battersFaced ?? 1;

  const stuffPlus = deriveStuffPlus(k9);
  const locationPlus = deriveLocationPlus(whip);
  const cswPct = deriveCswPct(strikeOuts, battersFaced);

  // Use recent game log for workload inputs
  const pPerIP = recentLog.avgPitchesPerIP > 0 ? recentLog.avgPitchesPerIP : 16;
  const projectedIP = recentLog.avgIP > 0 ? recentLog.avgIP : 5.5;
  const projectedBF = Math.round(projectedIP * 4.0);

  const salci = computeSalci({
    stuffPlus,
    locationPlus,
    cswPct,
    oppKPct: 0.22,
    oppZoneContact: 0.82,
    sameSidePct: 0.5,
    pPerIP,
    projectedBF,
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
        era: seasonStats?.era ?? null,
        whip: seasonStats?.whip ?? null,
        k_per_9: k9,
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

  if (pitcherUpsert.error) {
    console.error(`[Pipeline] ${start.pitcher.fullName}: pitcher upsert failed —`, pitcherUpsert.error.message);
  }
  if (scoreUpsert.error) {
    console.error(`[Pipeline] ${start.pitcher.fullName}: score upsert failed —`, scoreUpsert.error.message);
  }

  return !pitcherUpsert.error && !scoreUpsert.error;
};

export const runSalciPipeline = async (gameDate: string): Promise<PipelineResult> => {
  const supabase = createServiceClient();
  const starters = await getTodayStarters(gameDate);

  let computed = 0;
  let failed = 0;

  // MLB Stats API is fast — can safely run 6 at a time
  const BATCH_SIZE = 6;
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
