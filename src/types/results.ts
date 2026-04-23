import type { SalciScore } from './salci';

export interface YesterdayResult {
  pitcherId: number;
  pitcherName: string;
  team: string;
  teamAbbr: string;
  opponent: string;
  opponentAbbr: string;
  isHome: boolean;
  salciTotal: number;
  salciGrade: SalciScore['grade'];
  predictedFloor: number;
  predictedCeiling: number;
  expectedKs: number;
  bookLine: number;
  actualKs: number | null;
  recommendOver: boolean;
  result: 'win' | 'loss' | 'push' | 'pending';
}

export interface TeamPitchingStats {
  teamId: number;
  team: string;
  abbr: string;
  era: number;
  fip: number;
  kPct: number;
  whip: number;
  bbPct: number;
  inningsPitched: number;
  strikeOuts: number;
  gamesPlayed: number;
}

export type PitchingMetric = 'era' | 'fip' | 'kPct' | 'whip' | 'bbPct';
export type DateRange = 'season' | '30d' | '14d' | '7d';
