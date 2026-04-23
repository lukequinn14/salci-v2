const ESPN_SLUG: Record<string, string> = {
  ARI: 'ari', ATL: 'atl', BAL: 'bal', BOS: 'bos', CHC: 'chc',
  CWS: 'chw', CIN: 'cin', CLE: 'cle', COL: 'col', DET: 'det',
  HOU: 'hou', KC: 'kc',   LAA: 'laa', LAD: 'lad', MIA: 'mia',
  MIL: 'mil', MIN: 'min', NYM: 'nym', NYY: 'nyy', OAK: 'oak',
  PHI: 'phi', PIT: 'pit', SD: 'sd',   SF: 'sf',   SEA: 'sea',
  STL: 'stl', TB: 'tb',   TEX: 'tex', TOR: 'tor', WSH: 'wsh',
};

// Teams whose logos need the dark-bg variant on dark chart backgrounds
const DARK_BG_TEAMS = new Set(['COL', 'SD', 'NYY', 'MIN', 'KC', 'PIT', 'MIL', 'CWS', 'SF']);

export const getTeamLogoUrl = (abbr: string, darkBg = false): string => {
  const slug = ESPN_SLUG[abbr.toUpperCase()] ?? abbr.toLowerCase();
  const variant = darkBg && DARK_BG_TEAMS.has(abbr.toUpperCase()) ? '500-dark' : '500/scoreboard';
  return `https://a.espncdn.com/i/teamlogos/mlb/${variant}/${slug}.png`;
};
