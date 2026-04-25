const ESPN_SLUG: Record<string, string> = {
  ARI: 'ari', ATL: 'atl', BAL: 'bal', BOS: 'bos', CHC: 'chc',
  CWS: 'chw', CIN: 'cin', CLE: 'cle', COL: 'col', DET: 'det',
  HOU: 'hou', KC:  'kc',  LAA: 'laa', LAD: 'lad', MIA: 'mia',
  MIL: 'mil', MIN: 'min', NYM: 'nym', NYY: 'nyy', OAK: 'oak',
  PHI: 'phi', PIT: 'pit', SD:  'sd',  SF:  'sf',  SEA: 'sea',
  STL: 'stl', TB:  'tb',  TEX: 'tex', TOR: 'tor', WSH: 'wsh',
};

const DARK_BG_TEAMS = new Set(['COL', 'SD', 'NYY', 'MIN', 'KC', 'PIT', 'MIL', 'CWS', 'SF']);

// Aliases: alternative abbreviations returned by various MLB API endpoints
// mapped to the canonical key used in ESPN_SLUG above.
const ABBREV_ALIASES: Record<string, string> = {
  // Diamondbacks — schedule API returns AZ, stats API varies
  AZ: 'ARI',
  // White Sox — stats API sometimes returns CHW instead of CWS
  CHW: 'CWS',
  // Royals — Retrosheet/stats API uses KCA
  KCA: 'KC',
  // Rays — stats API sometimes uses TBR
  TBR: 'TB',
  // Nationals — stats API sometimes uses WAS
  WAS: 'WSH',
  // Padres — stats API sometimes uses SDP
  SDP: 'SD',
  // Giants — stats API sometimes uses SFG
  SFG: 'SF',
  // Indians/Guardians — stats API may use CLE or CLG
  CLG: 'CLE',
  // Athletics — Sacramento move may produce ATH or LVA
  ATH: 'OAK',
  LVA: 'OAK',
  // Cardinals — sometimes SLN
  SLN: 'STL',
  // Cubs — sometimes CHN
  CHN: 'CHC',
  // Astros — sometimes HOU is fine, but HOU alias just in case
  // Brewers — sometimes MIL is returned as MIL, fine
  // Mets — sometimes NYN
  NYN: 'NYM',
  // Yankees — sometimes NYA
  NYA: 'NYY',
  // Blue Jays — sometimes TOR, fine
  // Tigers — sometimes DET, fine
  // Rangers — sometimes TEX, fine
};

// Explicit URL overrides for teams where the standard scoreboard path is unreliable
const URL_OVERRIDES: Record<string, { standard: string; dark: string }> = {
  ARI: {
    standard: 'https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/ari.png',
    dark: 'https://a.espncdn.com/i/teamlogos/mlb/500-dark/ari.png',
  },
};

export const getTeamLogoUrl = (abbr: string, darkBg = false): string => {
  if (!abbr) return '';
  const resolved = ABBREV_ALIASES[abbr] ?? ABBREV_ALIASES[abbr.toUpperCase()] ?? abbr;
  const upper = resolved.toUpperCase();

  if (!ESPN_SLUG[upper] && !ABBREV_ALIASES[upper]) {
    console.warn('[Logo] Unknown abbr:', abbr, '→ upper:', upper);
  }

  const override = URL_OVERRIDES[upper];
  if (override) return darkBg ? override.dark : override.standard;

  const slug = ESPN_SLUG[upper] ?? resolved.toLowerCase();
  const variant = darkBg && DARK_BG_TEAMS.has(upper) ? '500-dark' : '500/scoreboard';
  return `https://a.espncdn.com/i/teamlogos/mlb/${variant}/${slug}.png`;
};
