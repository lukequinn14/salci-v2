export interface SalciScore {
  stuff: number;
  location: number;
  matchup: number;
  workload: number;
  total: number;
  grade: 'S' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
  floor: number;
  ceiling: number;
  expectedKs: number;
  buffer: number;
  recommendOver: boolean;
}

export interface SalciInputs {
  stuffPlus: number;
  locationPlus: number;
  matchupScore: number;   // pre-computed by calculateMatchupScore()
  workloadScore: number;  // pre-computed by calculateWorkloadScore()
  projectedIP: number;
  bookLine: number;
}

export interface WorkloadInputs {
  pPerIP: number;
  avgIP: number;
  avgPitchCount: number;
}

export interface MatchupInputs {
  oppKPct: number;
  oppZoneContact: number;
  sameSidePct: number;
}
