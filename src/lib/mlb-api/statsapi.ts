const BASE = process.env.MLB_STATS_API_BASE ?? 'https://statsapi.mlb.com/api/v1';

interface ScheduleGame {
  gamePk: number;
  gameDate: string;
  teams: {
    away: { team: { id: number; name: string; abbreviation: string } };
    home: { team: { id: number; name: string; abbreviation: string } };
  };
}

interface ProbablePitcher {
  id: number;
  fullName: string;
}

export interface ScheduledStart {
  gamePk: number;
  gameDate: string;
  pitcher: ProbablePitcher;
  team: string;
  teamAbbr: string;
  teamId: number;
  opponent: string;
  opponentAbbr: string;
  opponentId: number;
  isHome: boolean;
}

export const getTodayStarters = async (date?: string): Promise<ScheduledStart[]> => {
  const gameDate = date ?? new Date().toISOString().slice(0, 10);
  const url = `${BASE}/schedule?sportId=1&date=${gameDate}&hydrate=probablePitcher,team`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    dates: Array<{ games: Array<ScheduleGame & { teams: { away: { probablePitcher?: ProbablePitcher }; home: { probablePitcher?: ProbablePitcher } } }> }>;
  };

  const starts: ScheduledStart[] = [];
  const games = data.dates?.[0]?.games ?? [];

  for (const game of games) {
    const awayPitcher = game.teams.away.probablePitcher;
    const homePitcher = game.teams.home.probablePitcher;

    const awayAbbr = game.teams.away.team.abbreviation || game.teams.away.team.name.slice(0, 3).toUpperCase();
    const homeAbbr = game.teams.home.team.abbreviation || game.teams.home.team.name.slice(0, 3).toUpperCase();
    if (awayPitcher) {
      starts.push({
        gamePk: game.gamePk,
        gameDate,
        pitcher: awayPitcher,
        team: game.teams.away.team.name,
        teamAbbr: awayAbbr,
        teamId: game.teams.away.team.id,
        opponent: game.teams.home.team.name,
        opponentAbbr: homeAbbr,
        opponentId: game.teams.home.team.id,
        isHome: false,
      });
    }
    if (homePitcher) {
      starts.push({
        gamePk: game.gamePk,
        gameDate,
        pitcher: homePitcher,
        team: game.teams.home.team.name,
        teamAbbr: homeAbbr,
        teamId: game.teams.home.team.id,
        opponent: game.teams.away.team.name,
        opponentAbbr: awayAbbr,
        opponentId: game.teams.away.team.id,
        isHome: true,
      });
    }
  }

  return starts;
};

export const getTeamRoster = async (teamId: number): Promise<Array<{ id: number; fullName: string; primaryPosition: string; handedness: string }>> => {
  const url = `${BASE}/teams/${teamId}/roster?rosterType=active&hydrate=person`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json() as {
    roster: Array<{
      person: { id: number; fullName: string; batSide?: { code: string } };
      position: { abbreviation: string };
    }>;
  };
  return data.roster.map((r) => ({
    id: r.person.id,
    fullName: r.person.fullName,
    primaryPosition: r.position.abbreviation,
    handedness: r.person.batSide?.code ?? 'R',
  }));
};

export const getLineup = async (gamePk: number): Promise<Array<{ id: number; battingOrder: number; handedness: string; side: 'away' | 'home' }>> => {
  const url = `${BASE}/game/${gamePk}/boxscore`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const data = await res.json() as {
    teams: {
      away: { batters: number[]; players: Record<string, { person: { id: number }; battingOrder?: string; batSide?: { code: string } }> };
      home: { batters: number[]; players: Record<string, { person: { id: number }; battingOrder?: string; batSide?: { code: string } }> };
    };
  };

  const lineups: Array<{ id: number; battingOrder: number; handedness: string; side: 'away' | 'home' }> = [];

  for (const [teamSide, side] of [['away', data.teams.away], ['home', data.teams.home]] as const) {
    for (const [, player] of Object.entries(side.players)) {
      if (player.battingOrder) {
        lineups.push({
          id: player.person.id,
          battingOrder: Math.floor(Number(player.battingOrder) / 100),
          handedness: player.batSide?.code ?? 'R',
          side: teamSide,
        });
      }
    }
  }

  return lineups;
};

interface BoxScorePitchingStats {
  strikeOuts?: number;
  inningsPitched?: string;
}

interface BoxScorePlayer {
  person: { id: number };
  stats?: { pitching?: BoxScorePitchingStats };
  gameStatus?: { isCurrentPitcher?: boolean };
}

interface BoxScoreTeam {
  pitchers: number[];
  players: Record<string, BoxScorePlayer>;
}

export interface StarterKs {
  pitcherId: number;
  strikeOuts: number | null;
  inningsPitched: string | null;
}

export const getStarterKsForGame = async (
  gamePk: number
): Promise<{ away: StarterKs | null; home: StarterKs | null }> => {
  const url = `${BASE}/game/${gamePk}/boxscore`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return { away: null, home: null };

  const data = (await res.json()) as { teams: { away: BoxScoreTeam; home: BoxScoreTeam } };

  const extractStarter = (team: BoxScoreTeam): StarterKs | null => {
    const starterId = team.pitchers?.[0];
    if (!starterId) return null;
    const player = team.players[`ID${starterId}`];
    return {
      pitcherId: starterId,
      strikeOuts: player?.stats?.pitching?.strikeOuts ?? null,
      inningsPitched: player?.stats?.pitching?.inningsPitched ?? null,
    };
  };

  return {
    away: extractStarter(data.teams.away),
    home: extractStarter(data.teams.home),
  };
};

interface MlbStatSplit {
  stat: {
    era?: string;
    strikeOuts?: number;
    baseOnBalls?: number;
    homeRuns?: number;
    inningsPitched?: string;
    whip?: string;
    battersFaced?: number;
    hits?: number;
    earnedRuns?: number;
    gamesPlayed?: number;
    gamesStarted?: number;
    wins?: number;
    losses?: number;
  };
  team?: { id: number; name: string; abbreviation: string };
  player?: { id: number; fullName: string };
}

export interface RawTeamStats {
  teamId: number;
  teamName: string;
  abbr: string;
  era: number;
  strikeOuts: number;
  baseOnBalls: number;
  homeRuns: number;
  inningsPitched: number;
  whip: number;
  battersFaced: number;
  hits: number;
  earnedRuns: number;
  gamesPlayed: number;
}

// Normalize MLB Stats API team abbreviations to canonical ESPN-compatible form.
// The stats endpoint uses Retrosheet-style codes that differ from the schedule endpoint.
const STATS_ABBR_ALIASES: Record<string, string> = {
  AZ: 'ARI', CHW: 'CWS', KCA: 'KC', TBR: 'TB',
  WAS: 'WSH', WSN: 'WSH', SDP: 'SD', SFG: 'SF',
  CLG: 'CLE', ATH: 'OAK', LVA: 'OAK',
  SLN: 'STL', CHN: 'CHC', NYN: 'NYM', NYA: 'NYY', FLA: 'MIA',
};
const normalizeTeamAbbr = (abbr: string): string => {
  const u = abbr.toUpperCase();
  return STATS_ABBR_ALIASES[u] ?? u;
};

const parseIP = (ip: string | undefined): number => {
  if (!ip) return 0;
  const [whole, thirds] = ip.split('.').map(Number);
  return (whole ?? 0) + ((thirds ?? 0) / 3);
};

export const getAllTeamPitchingStats = async (
  range: 'season' | '30d' | '14d' | '7d'
): Promise<RawTeamStats[]> => {
  const today = new Date().toISOString().slice(0, 10);
  let url: string;

  if (range === 'season') {
    url = `${BASE}/stats?stats=season&group=pitching&sportId=1&gameType=R&season=2026&playerPool=All&limit=500`;
  } else {
    const days = { '30d': 30, '14d': 14, '7d': 7 }[range];
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startDate = start.toISOString().slice(0, 10);
    url = `${BASE}/stats?stats=byDateRange&group=pitching&sportId=1&gameType=R&startDate=${startDate}&endDate=${today}&playerPool=All&limit=500`;
  }

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data = (await res.json()) as { stats: Array<{ splits: MlbStatSplit[] }> };
  const splits: MlbStatSplit[] = data.stats?.[0]?.splits ?? [];

  // Aggregate player-level stats by team
  const teamMap = new Map<number, RawTeamStats>();

  for (const split of splits) {
    if (!split.team) continue;
    const { id, name, abbreviation: rawAbbr } = split.team;
    const abbreviation = normalizeTeamAbbr(rawAbbr ?? '');
    const s = split.stat;
    const ip = parseIP(s.inningsPitched);
    if (ip === 0) continue;

    const existing = teamMap.get(id) ?? {
      teamId: id,
      teamName: name,
      abbr: abbreviation,
      era: 0,
      strikeOuts: 0,
      baseOnBalls: 0,
      homeRuns: 0,
      inningsPitched: 0,
      whip: 0,
      battersFaced: 0,
      hits: 0,
      earnedRuns: 0,
      gamesPlayed: 0,
    };

    existing.strikeOuts += s.strikeOuts ?? 0;
    existing.baseOnBalls += s.baseOnBalls ?? 0;
    existing.homeRuns += s.homeRuns ?? 0;
    existing.inningsPitched += ip;
    existing.battersFaced += s.battersFaced ?? 0;
    existing.hits += s.hits ?? 0;
    existing.earnedRuns += s.earnedRuns ?? 0;
    existing.gamesPlayed = Math.max(existing.gamesPlayed, s.gamesPlayed ?? 0);

    teamMap.set(id, existing);
  }

  // Compute derived stats
  return Array.from(teamMap.values()).map((t) => ({
    ...t,
    era: t.inningsPitched > 0 ? (t.earnedRuns * 9) / t.inningsPitched : 0,
    whip: t.inningsPitched > 0 ? (t.baseOnBalls + t.hits) / t.inningsPitched : 0,
  }));
};

export interface PitcherSeasonStats {
  era: number;
  whip: number;
  strikeOuts: number;
  inningsPitched: number;
  battersFaced: number;
  homeRuns: number;
  baseOnBalls: number;
  hits: number;
  gamesStarted: number;
  k9: number;
}

export const getPitcherSeasonStats = async (
  pitcherId: number
): Promise<PitcherSeasonStats | null> => {
  const url = `${BASE}/people/${pitcherId}/stats?stats=season&group=pitching&season=2026`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    stats: Array<{
      splits: Array<{
        stat: {
          era?: string;
          whip?: string;
          strikeOuts?: number;
          inningsPitched?: string;
          battersFaced?: number;
          homeRuns?: number;
          baseOnBalls?: number;
          hits?: number;
          gamesStarted?: number;
        };
      }>;
    }>;
  };

  const split = data.stats?.[0]?.splits?.[0]?.stat;
  if (!split) return null;

  const ip = parseIP(split.inningsPitched);
  const k9 = ip > 0 ? ((split.strikeOuts ?? 0) * 9) / ip : 0;

  return {
    era: parseFloat(split.era ?? '0') || 0,
    whip: parseFloat(split.whip ?? '0') || 0,
    strikeOuts: split.strikeOuts ?? 0,
    inningsPitched: ip,
    battersFaced: split.battersFaced ?? 0,
    homeRuns: split.homeRuns ?? 0,
    baseOnBalls: split.baseOnBalls ?? 0,
    hits: split.hits ?? 0,
    gamesStarted: split.gamesStarted ?? 0,
    k9,
  };
};

export interface RecentGameLog {
  avgK9: number;
  avgIP: number;
  avgPitchesPerIP: number;
  gamesBack: number;
}

export const getPitcherLastNGames = async (
  pitcherId: number,
  n: number
): Promise<RecentGameLog> => {
  const url = `${BASE}/people/${pitcherId}/stats?stats=gameLog&group=pitching&season=2026`;
  const res = await fetch(url, { next: { revalidate: 3600 } });

  const fallback: RecentGameLog = { avgK9: 8.5, avgIP: 5.5, avgPitchesPerIP: 16, gamesBack: 0 };
  if (!res.ok) return fallback;

  const data = (await res.json()) as {
    stats: Array<{
      splits: Array<{
        stat: {
          strikeOuts?: number;
          inningsPitched?: string;
          numberOfPitches?: number;
        };
      }>;
    }>;
  };

  const splits = data.stats?.[0]?.splits ?? [];
  const recent = splits.slice(-n);
  if (recent.length === 0) return fallback;

  let totalK9 = 0;
  let totalIP = 0;
  let totalPitches = 0;
  let validGames = 0;

  for (const game of recent) {
    const s = game.stat;
    const ip = parseIP(s.inningsPitched);
    if (ip === 0) continue;
    const k9 = ((s.strikeOuts ?? 0) * 9) / ip;
    const pPerIP = (s.numberOfPitches ?? 0) / ip;
    totalK9 += k9;
    totalIP += ip;
    totalPitches += pPerIP;
    validGames++;
  }

  if (validGames === 0) return fallback;

  return {
    avgK9: totalK9 / validGames,
    avgIP: totalIP / validGames,
    avgPitchesPerIP: totalPitches / validGames,
    gamesBack: validGames,
  };
};

export interface HitterSeasonStats {
  playerId: number;
  fullName: string;
  avg: number;
  ops: number;
  kPct: number;
  obp: number;
  slg: number;
  atBats: number;
  plateAppearances: number;
}

export const getHitterSeasonStats = async (
  playerId: number,
  fullName: string
): Promise<HitterSeasonStats | null> => {
  const url = `${BASE}/people/${playerId}/stats?stats=season&group=hitting&season=2026`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    stats: Array<{
      splits: Array<{
        stat: {
          avg?: string;
          ops?: string;
          obp?: string;
          slg?: string;
          strikeOuts?: number;
          atBats?: number;
          plateAppearances?: number;
        };
      }>;
    }>;
  };

  const split = data.stats?.[0]?.splits?.[0]?.stat;
  if (!split) return null;

  const pa = split.plateAppearances ?? split.atBats ?? 1;
  const kPct = pa > 0 ? (split.strikeOuts ?? 0) / pa : 0.22;

  return {
    playerId,
    fullName,
    avg: parseFloat(split.avg ?? '0') || 0,
    ops: parseFloat(split.ops ?? '0') || 0,
    obp: parseFloat(split.obp ?? '0') || 0,
    slg: parseFloat(split.slg ?? '0') || 0,
    kPct,
    atBats: split.atBats ?? 0,
    plateAppearances: pa,
  };
};

export const getTodayLineups = async (
  gameDate: string
): Promise<Array<{
  gamePk: number;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homePitcherId: number | null;
  awayPitcherId: number | null;
  hitters: Array<{ id: number; fullName: string; battingOrder: number; hand: string; teamAbbr: string }>;
}>> => {
  const starters = await getTodayStarters(gameDate);
  const games: ReturnType<typeof getTodayLineups> extends Promise<infer T> ? T : never = [];

  for (const start of starters) {
    const existing = games.find((g) => g.gamePk === start.gamePk);
    if (existing) {
      if (start.isHome) existing.homePitcherId = start.pitcher.id;
      else existing.awayPitcherId = start.pitcher.id;
      continue;
    }
    games.push({
      gamePk: start.gamePk,
      homeTeamAbbr: start.isHome ? start.teamAbbr : start.opponentAbbr,
      awayTeamAbbr: start.isHome ? start.opponentAbbr : start.teamAbbr,
      homePitcherId: start.isHome ? start.pitcher.id : null,
      awayPitcherId: start.isHome ? null : start.pitcher.id,
      hitters: [],
    });
  }

  // Fetch lineups in parallel for all games
  await Promise.allSettled(
    games.map(async (game) => {
      const lineup = await getLineup(game.gamePk);
      game.hitters = lineup.map((h) => ({
        id: h.id,
        fullName: '',
        battingOrder: h.battingOrder,
        hand: h.handedness,
        teamAbbr: h.side === 'away' ? game.awayTeamAbbr : game.homeTeamAbbr,
      }));
    })
  );

  return games;
};
