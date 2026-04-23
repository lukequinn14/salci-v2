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
