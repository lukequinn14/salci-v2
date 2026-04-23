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
  cswPct: number;
  oppKPct: number;
  oppZoneContact: number;
  sameSidePct: number;
  pPerIP: number;
  projectedBF: number;
  managerLeash: number;
  tttKDrop: number;
  bookLine: number;
}
