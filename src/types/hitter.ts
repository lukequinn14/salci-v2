export interface Hitter {
  id: number;
  name: string;
  team: string;
  handedness: 'L' | 'R' | 'S';
  battingOrder: number;
  bavg: number;
  ops: number;
  kPct: number;
  zoneContactPct: number;
  chaseRate: number;
  hitLikelihood: number;
  hitGrade: 'HOT' | 'WARM' | 'NEUTRAL' | 'COLD' | 'ICE';
}

export interface HitterMatchup {
  hitter: Hitter;
  pitcherId: number;
  pitcherName: string;
  pitcherTeam: string;
  platoonAdvantage: boolean;
  kLikelihood: number;
}
