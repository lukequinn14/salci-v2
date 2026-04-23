import type { SalciScore } from './salci';

export interface Pitcher {
  id: number;
  name: string;
  team: string;
  opponent: string;
  isHome: boolean;
  handedness: 'L' | 'R';
  gameDate: string;
  era: number;
  whip: number;
  kPer9: number;
  stuffPlus: number;
  locationPlus: number;
  cswPct: number;
  salci: SalciScore;
}

export interface PitchArsenalEntry {
  usage: number;
  stuffPlus: number;
  avgSpeed: number;
  avgSpin: number;
  avgVBreak: number;
  avgHBreak: number;
  whiffRate: number;
}

export type PitchArsenal = Record<string, PitchArsenalEntry>;

export interface StatcastRow {
  release_speed: number;
  release_spin_rate: number;
  release_extension: number;
  pfx_z: number;
  pfx_x: number;
  description: string;
  pitch_type: string;
  zone: number;
  balls: number;
  strikes: number;
}
