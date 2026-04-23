export interface Hitter {
  id: number;
  name: string;
  team: string;
  handedness: 'L' | 'R' | 'S';
  battingOrder: number;
  kPct: number;
  zoneContactPct: number;
  chaseRate: number;
  hitLikelihood: number;
}

export interface HitterMatchup {
  hitter: Hitter;
  pitcherId: number;
  platoonAdvantage: boolean;
  kLikelihood: number;
}
