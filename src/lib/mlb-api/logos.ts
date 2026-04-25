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
  // Diamondbacks
  AZ: 'ARI',
  // White Sox
  CHW: 'CWS',
  // Royals
  KCA: 'KC',
  // Rays
  TBR: 'TB',
  // Nationals — stats API uses WAS or WSN
  WAS: 'WSH',
  WSN: 'WSH',
  // Padres
  SDP: 'SD',
  // Giants
  SFG: 'SF',
  // Guardians
  CLG: 'CLE',
  // Athletics
  ATH: 'OAK',
  LVA: 'OAK',
  // Cardinals
  SLN: 'STL',
  // Cubs
  CHN: 'CHC',
  // Mets
  NYN: 'NYM',
  // Yankees
  NYA: 'NYY',
  // Marlins — stats API sometimes uses FLA
  FLA: 'MIA',
  // Brewers — stats API sometimes uses MIL (fine) or BRE
  // Blue Jays — stats API sometimes uses TOR (fine)
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
