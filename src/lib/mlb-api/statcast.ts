import type { StatcastRow, PitchArsenal } from '@/types/pitcher';

const SAVANT_CSV = 'https://baseballsavant.mlb.com/statcast_search/csv';

const WHIFF_DESCRIPTIONS = new Set([
  'swinging_strike',
  'swinging_strike_blocked',
  'foul_tip',
]);

const STRIKE_DESCRIPTIONS = new Set([
  'called_strike',
  'swinging_strike',
  'swinging_strike_blocked',
  'foul_tip',
]);

const CONTACT_DESCRIPTIONS = new Set(['foul', 'hit_into_play', 'hit_into_play_no_out', 'hit_into_play_score']);

// Baseline Stuff+ by pitch type (league average = 100)
const STUFF_PLUS_SPEED_BASELINE: Record<string, number> = {
  FF: 93.5, SI: 93.0, FC: 88.5, SL: 83.5, ST: 81.0,
  SV: 82.0, CU: 77.5, KC: 76.0, CH: 84.5, FS: 85.0,
};

const STUFF_PLUS_BREAK_BASELINE: Record<string, { vBreak: number; hBreak: number }> = {
  FF: { vBreak: 15, hBreak: 8 },  SI: { vBreak: 10, hBreak: 14 },
  FC: { vBreak: 8, hBreak: 5 },   SL: { vBreak: -2, hBreak: 7 },
  ST: { vBreak: 0, hBreak: 14 },  SV: { vBreak: -8, hBreak: 4 },
  CU: { vBreak: -12, hBreak: 6 }, KC: { vBreak: -10, hBreak: 7 },
  CH: { vBreak: 6, hBreak: 12 },  FS: { vBreak: 4, hBreak: 8 },
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const fetchStatcastCSV = async (
  playerId: number,
  startDate: string,
  endDate: string,
  timeoutMs = 8000,
  pitcherName?: string
): Promise<StatcastRow[]> => {
  const params = new URLSearchParams({
    player_type: 'pitcher',
    player_id: String(playerId),
    game_date_gt: startDate,
    game_date_lt: endDate,
    type: 'details',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SAVANT_CSV}?${params}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://baseballsavant.mlb.com/',
      },
      next: { revalidate: 3600 },
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[Statcast] ${pitcherName ?? `Player ${playerId}`}: HTTP ${res.status} ${res.statusText}`);
      return [];
    }
    const text = await res.text();
    return parseCSV(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Statcast] ${pitcherName ?? `Player ${playerId}`}: ${message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
};

const parseCSV = (csv: string): StatcastRow[] => {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const idx = (name: string) => headers.indexOf(name);

  const iSpeed = idx('release_speed');
  const iSpin = idx('release_spin_rate');
  const iExt = idx('release_extension');
  const iPfxZ = idx('pfx_z');
  const iPfxX = idx('pfx_x');
  const iDesc = idx('description');
  const iPitch = idx('pitch_type');
  const iZone = idx('zone');
  const iBalls = idx('balls');
  const iStrikes = idx('strikes');

  const rows: StatcastRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;
    rows.push({
      release_speed: parseFloat(cols[iSpeed]) || 0,
      release_spin_rate: parseFloat(cols[iSpin]) || 0,
      release_extension: parseFloat(cols[iExt]) || 0,
      pfx_z: parseFloat(cols[iPfxZ]) || 0,
      pfx_x: parseFloat(cols[iPfxX]) || 0,
      description: cols[iDesc]?.trim() ?? '',
      pitch_type: cols[iPitch]?.trim() ?? '',
      zone: parseInt(cols[iZone]) || 0,
      balls: parseInt(cols[iBalls]) || 0,
      strikes: parseInt(cols[iStrikes]) || 0,
    });
  }
  return rows;
};

export const computeArsenal = (rows: StatcastRow[]): PitchArsenal => {
  const byType: Record<string, StatcastRow[]> = {};
  for (const row of rows) {
    if (!row.pitch_type) continue;
    (byType[row.pitch_type] ??= []).push(row);
  }

  const total = rows.length;
  const arsenal: PitchArsenal = {};

  for (const [pitchType, pitchRows] of Object.entries(byType)) {
    const usage = pitchRows.length / total;
    const swings = pitchRows.filter(
      (r) => WHIFF_DESCRIPTIONS.has(r.description) || CONTACT_DESCRIPTIONS.has(r.description)
    ).length;
    const whiffs = pitchRows.filter((r) => WHIFF_DESCRIPTIONS.has(r.description)).length;

    const avgSpeed = pitchRows.reduce((s, r) => s + r.release_speed, 0) / pitchRows.length;
    const avgSpin = pitchRows.reduce((s, r) => s + r.release_spin_rate, 0) / pitchRows.length;
    const avgVBreak = (pitchRows.reduce((s, r) => s + r.pfx_z, 0) / pitchRows.length) * 12;
    const avgHBreak = Math.abs((pitchRows.reduce((s, r) => s + r.pfx_x, 0) / pitchRows.length) * 12);
    const whiffRate = swings > 0 ? whiffs / swings : 0;

    const speedBaseline = STUFF_PLUS_SPEED_BASELINE[pitchType] ?? 88;
    const breakBaseline = STUFF_PLUS_BREAK_BASELINE[pitchType] ?? { vBreak: 5, hBreak: 6 };
    const speedComponent = ((avgSpeed - speedBaseline) / speedBaseline) * 100;
    const breakComponent = Math.sqrt(
      Math.pow(avgVBreak - breakBaseline.vBreak, 2) +
      Math.pow(avgHBreak - breakBaseline.hBreak, 2)
    );
    const whiffBonus = (whiffRate - 0.22) * 80;
    const rawStuffPlus = 100 + speedComponent * 1.8 + breakComponent * 0.9 + whiffBonus;

    arsenal[pitchType] = {
      usage,
      stuffPlus: clamp(rawStuffPlus, 60, 155),
      avgSpeed,
      avgSpin,
      avgVBreak,
      avgHBreak,
      whiffRate,
    };
  }

  return arsenal;
};

export const computeStuffPlusFromArsenal = (
  arsenal: PitchArsenal,
  cswPct: number
): number => {
  let weightedStuff = 0;
  let totalUsage = 0;
  let depthBonus = 0;

  for (const [, entry] of Object.entries(arsenal)) {
    weightedStuff += entry.stuffPlus * entry.usage;
    totalUsage += entry.usage;
    if (entry.stuffPlus >= 105) depthBonus += 2.5;
  }

  const baseStuff = totalUsage > 0 ? weightedStuff / totalUsage : 100;
  const cswBonus = (cswPct - 0.29) * 100;
  return clamp(baseStuff + depthBonus + cswBonus, 60, 155);
};

export const computeLocationPlus = (rows: StatcastRow[]): number => {
  if (rows.length === 0) return 100;

  const inZone = rows.filter((r) => r.zone >= 1 && r.zone <= 9).length;
  const zonePct = inZone / rows.length;

  const chaseZone = rows.filter((r) => r.zone >= 11 && r.zone <= 14);
  const chaseSwings = chaseZone.filter(
    (r) => WHIFF_DESCRIPTIONS.has(r.description) || CONTACT_DESCRIPTIONS.has(r.description)
  ).length;
  const chaseRate = chaseZone.length > 0 ? chaseSwings / rows.length : 0;

  const strikes = rows.filter((r) => STRIKE_DESCRIPTIONS.has(r.description)).length;
  const cswPct = strikes / rows.length;

  const firstPitch = rows.filter((r) => r.balls === 0 && r.strikes === 0);
  const fpStrikes = firstPitch.filter((r) => STRIKE_DESCRIPTIONS.has(r.description)).length;
  const fpStrikePct = firstPitch.length > 0 ? fpStrikes / firstPitch.length : 0;

  // Zone% optimal is 44-48%; edge penalty for too high or too low
  const zoneScore = 100 - Math.abs(zonePct - 0.46) * 200;
  const chaseScore = 100 + (chaseRate - 0.28) * 200;
  const cswScore = 100 + (cswPct - 0.29) * 300;
  const fpScore = 100 + (fpStrikePct - 0.60) * 150;

  const raw = zoneScore * 0.30 + chaseScore * 0.25 + cswScore * 0.25 + fpScore * 0.20;
  return clamp(raw, 60, 145);
};

export const computeCswPct = (rows: StatcastRow[]): number => {
  if (rows.length === 0) return 0.29;
  const strikes = rows.filter((r) => STRIKE_DESCRIPTIONS.has(r.description)).length;
  return strikes / rows.length;
};
