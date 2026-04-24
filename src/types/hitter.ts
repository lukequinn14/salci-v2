export interface Hitter {
  id: number;
  name: string;
  team: string;
  handedness: 'L' | 'R' | 'S';
  battingOrder: number; // 0 when lineup not yet confirmed
  lineupStatus: 'confirmed' | 'probable';
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
  pitcherSalciTotal: number;
  platoonAdvantage: boolean;
  kLikelihood: number;
}
