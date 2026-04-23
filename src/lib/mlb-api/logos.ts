const ESPN_SLUG: Record<string, string> = {
  ARI: 'ari', ATL: 'atl', BAL: 'bal', BOS: 'bos', CHC: 'chc',
  CWS: 'chw', CIN: 'cin', CLE: 'cle', COL: 'col', DET: 'det',
  HOU: 'hou', KC: 'kc',   LAA: 'laa', LAD: 'lad', MIA: 'mia',
  MIL: 'mil', MIN: 'min', NYM: 'nym', NYY: 'nyy', OAK: 'oak',
  PHI: 'phi', PIT: 'pit', SD: 'sd',   SF: 'sf',   SEA: 'sea',
  STL: 'stl', TB: 'tb',   TEX: 'tex', TOR: 'tor', WSH: 'wsh',
};

const DARK_BG_TEAMS = new Set(['COL', 'SD', 'NYY', 'MIN', 'KC', 'PIT', 'MIL', 'CWS', 'SF']);

// Explicit URL overrides for teams where the standard scoreboard path is unreliable
const URL_OVERRIDES: Record<string, { standard: string; dark: string }> = {
  ARI: {
    standard: 'https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/ari.png',
    dark: 'https://a.espncdn.com/i/teamlogos/mlb/500-dark/ari.png',
  },
};

export const getTeamLogoUrl = (abbr: string, darkBg = false): string => {
  const upper = abbr.toUpperCase();
  const override = URL_OVERRIDES[upper];
  if (override) return darkBg ? override.dark : override.standard;

  const slug = ESPN_SLUG[upper] ?? abbr.toLowerCase();
  const variant = darkBg && DARK_BG_TEAMS.has(upper) ? '500-dark' : '500/scoreboard';
  return `https://a.espncdn.com/i/teamlogos/mlb/${variant}/${slug}.png`;
};
