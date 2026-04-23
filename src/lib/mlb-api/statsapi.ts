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
  opponent: string;
  opponentAbbr: string;
  isHome: boolean;
}

export const getTodayStarters = async (date?: string): Promise<ScheduledStart[]> => {
  const gameDate = date ?? new Date().toISOString().slice(0, 10);
  const url = `${BASE}/schedule?sportId=1&date=${gameDate}&hydrate=probablePitcher`;

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

    if (awayPitcher) {
      starts.push({
        gamePk: game.gamePk,
        gameDate,
        pitcher: awayPitcher,
        team: game.teams.away.team.name,
        teamAbbr: game.teams.away.team.abbreviation,
        opponent: game.teams.home.team.name,
        opponentAbbr: game.teams.home.team.abbreviation,
        isHome: false,
      });
    }
    if (homePitcher) {
      starts.push({
        gamePk: game.gamePk,
        gameDate,
        pitcher: homePitcher,
        team: game.teams.home.team.name,
        teamAbbr: game.teams.home.team.abbreviation,
        opponent: game.teams.away.team.name,
        opponentAbbr: game.teams.away.team.abbreviation,
        isHome: true,
      });
    }
  }

  return starts;
};

export const getTeamRoster = async (teamId: number): Promise<Array<{ id: number; fullName: string; primaryPosition: string }>> => {
  const url = `${BASE}/teams/${teamId}/roster?rosterType=active`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = await res.json() as { roster: Array<{ person: { id: number; fullName: string }; position: { abbreviation: string } }> };
  return data.roster.map((r) => ({
    id: r.person.id,
    fullName: r.person.fullName,
    primaryPosition: r.position.abbreviation,
  }));
};

export const getLineup = async (gamePk: number): Promise<Array<{ id: number; battingOrder: number; handedness: string }>> => {
  const url = `${BASE}/game/${gamePk}/boxscore`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];

  const data = await res.json() as {
    teams: {
      away: { batters: number[]; players: Record<string, { person: { id: number }; battingOrder?: string; batSide?: { code: string } }> };
      home: { batters: number[]; players: Record<string, { person: { id: number }; battingOrder?: string; batSide?: { code: string } }> };
    };
  };

  const lineups: Array<{ id: number; battingOrder: number; handedness: string }> = [];

  for (const side of [data.teams.away, data.teams.home] as const) {
    for (const [, player] of Object.entries(side.players)) {
      if (player.battingOrder) {
        lineups.push({
          id: player.person.id,
          battingOrder: Math.floor(Number(player.battingOrder) / 100),
          handedness: player.batSide?.code ?? 'R',
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
    const { id, name, abbreviation } = split.team;
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
