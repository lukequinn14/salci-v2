const ODDS_CACHE: Map<string, { data: unknown; expiresAt: number }> = new Map();
const CACHE_TTL_MS = 3600 * 1000;

interface OddsApiGame {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    markets: Array<{
      key: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
}

export interface StrikeoutLine {
  pitcherName: string;
  team: string;
  line: number;
  overOdds: number;
  underOdds: number;
  bookmaker: string;
}

const getCached = <T>(key: string): T | null => {
  const entry = ODDS_CACHE.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  ODDS_CACHE.delete(key);
  return null;
};

const setCache = (key: string, data: unknown): void => {
  ODDS_CACHE.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

const fetchFromOddsApi = async (): Promise<OddsApiGame[]> => {
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) return [];

  const cacheKey = 'odds_api_mlb';
  const cached = getCached<OddsApiGame[]>(cacheKey);
  if (cached) return cached;

  const markets = process.env.ODDS_MARKETS ?? 'h2h';
  const regions = process.env.ODDS_REGIONS ?? 'us';
  const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds?apiKey=${key}&regions=${regions}&markets=${markets}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data = (await res.json()) as OddsApiGame[];
  setCache(cacheKey, data);
  return data;
};

const fetchFromBallDontLie = async (): Promise<StrikeoutLine[]> => {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) return [];

  const cacheKey = 'balldontlie_props';
  const cached = getCached<StrikeoutLine[]>(cacheKey);
  if (cached) return cached;

  const res = await fetch('https://api.balldontlie.io/v1/stats?per_page=25', {
    headers: { Authorization: key },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  // BallDontLie doesn't provide K props natively — fallback returns empty
  setCache(cacheKey, []);
  return [];
};

export const getStrikeoutLines = async (): Promise<StrikeoutLine[]> => {
  const cacheKey = 'strikeout_lines';
  const cached = getCached<StrikeoutLine[]>(cacheKey);
  if (cached) return cached;

  // Primary: The Odds API (player props endpoint)
  const propsUrl = `https://api.the-odds-api.com/v4/sports/baseball_mlb/events`;
  const key = process.env.THE_ODDS_API_KEY;

  if (key) {
    try {
      const eventsRes = await fetch(`${propsUrl}?apiKey=${key}`, { next: { revalidate: 3600 } });
      if (eventsRes.ok) {
        const events = (await eventsRes.json()) as Array<{ id: string }>;
        const lines: StrikeoutLine[] = [];

        // Fetch props for first 3 games (quota preservation)
        for (const event of events.slice(0, 3)) {
          const propRes = await fetch(
            `https://api.the-odds-api.com/v4/sports/baseball_mlb/events/${event.id}/odds?apiKey=${key}&markets=pitcher_strikeouts&regions=us`,
            { next: { revalidate: 3600 } }
          );
          if (!propRes.ok) continue;
          const propData = (await propRes.json()) as OddsApiGame;

          for (const bookmaker of propData.bookmakers ?? []) {
            for (const market of bookmaker.markets ?? []) {
              if (market.key !== 'pitcher_strikeouts') continue;
              const over = market.outcomes.find((o) => o.name === 'Over');
              const under = market.outcomes.find((o) => o.name === 'Under');
              if (over?.point) {
                lines.push({
                  pitcherName: '',
                  team: '',
                  line: over.point,
                  overOdds: over.price,
                  underOdds: under?.price ?? -110,
                  bookmaker: bookmaker.key,
                });
              }
            }
          }
        }

        if (lines.length > 0) {
          setCache(cacheKey, lines);
          return lines;
        }
      }
    } catch {
      // fall through to next source
    }
  }

  // Fallback 1: BallDontLie
  const bdl = await fetchFromBallDontLie();
  if (bdl.length > 0) {
    setCache(cacheKey, bdl);
    return bdl;
  }

  // Fallback 2: API-Sports
  const apiSportsKey = process.env.APISPORTS_KEY;
  if (apiSportsKey) {
    try {
      const res = await fetch('https://v1.baseball.api-sports.io/games?league=1&season=2026', {
        headers: { 'x-apisports-key': apiSportsKey },
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        setCache(cacheKey, []);
      }
    } catch {
      // all sources exhausted
    }
  }

  return [];
};

// Convenience: look up the book line for a specific pitcher
export const getBookLineForPitcher = async (pitcherName: string): Promise<number> => {
  const lines = await getStrikeoutLines();
  const match = lines.find((l) =>
    l.pitcherName.toLowerCase().includes(pitcherName.split(' ').pop()?.toLowerCase() ?? '')
  );
  return match?.line ?? 5.5;
};
