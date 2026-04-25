import type { SalciInputs, SalciScore, WorkloadInputs, MatchupInputs } from '@/types/salci';
import { computeGrade } from './grades';

// ─── core math ───────────────────────────────────────────────────────────────

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

const sigmoid = (z: number, sharpness = 1.4): number =>
  1 / (1 + Math.exp(-sharpness * z));

const zToScore = (
  z: number,
  center = 50,
  scale = 20,
  hardMin = 10,
  hardMax = 95,
  sharpness = 1.6
): number => {
  const stretched = (sigmoid(z, sharpness) - 0.5) * 2;
  const score = center + stretched * scale;
  return Math.max(hardMin, Math.min(hardMax, score));
};

// ─── sub-scores ───────────────────────────────────────────────────────────────

export const normalizeStuff = (stuffPlus: number): number => {
  const stuffZ = (stuffPlus - 100) / 8.0;
  return zToScore(stuffZ, 50, 36, 6, 97, 1.8);
};

export const normalizeLocation = (locationPlus: number): number => {
  const locationZ = (locationPlus - 100) / 10.0;
  const locationZAdj = Math.min(locationZ, 0.5); // cap upside — high command = pitching to contact
  return zToScore(locationZAdj, 50, 10, 35, 65);
};

export const calculateMatchupScore = (inputs: MatchupInputs): number => {
  const kZ = clamp((inputs.oppKPct - 0.22) / 0.025, -3, 3);
  const contactZ = clamp(-(inputs.oppZoneContact - 0.82) / 0.035, -3, 3);
  const platoonZ = clamp((inputs.sameSidePct - 0.50) / 0.15, -1.5, 1.5);
  const rawMatchup = kZ * 0.70 + contactZ * 0.30 + platoonZ * 0.08;
  return zToScore(rawMatchup, 50, 22, 15, 90);
};

export const calculateWorkloadScore = (inputs: WorkloadInputs): number => {
  const pIPZ = clamp(-(inputs.pPerIP - 15.5) / 2.0, -2.5, 2.5);
  const bpi = 3 + (inputs.pPerIP / 15);
  const projectedBF = inputs.avgIP * bpi;
  const bfZ = clamp((projectedBF - 24) / 4, -2.5, 2.5);
  const leashZ = clamp((inputs.avgPitchCount - 88) / 10, -2.5, 2.5);
  const tttZ = -1.0; // league average TTT penalty
  const rawWorkload = pIPZ * 0.25 + bfZ * 0.30 + leashZ * 0.25 + tttZ * 0.20;
  return zToScore(rawWorkload, 50, 22, 20, 85);
};

// ─── volatility & K projection ───────────────────────────────────────────────

export const calculateVolatilityBuffer = (stuffPlus: number, locationPlus: number): number => {
  const gap = stuffPlus - locationPlus;
  if (gap > 22) return 2.1;
  if (gap > 15) return 1.75;
  if (gap > 8)  return 1.40;
  if (gap < -15) return 0.80;
  if (gap < -8)  return 0.95;
  return 1.15;
};

export const calculateExpectedKs = (salciTotal: number, projectedIP = 5.5): number => {
  const kPerIP = clamp((salciTotal / 47.0) * 1.0, 0.40, 2.40);
  return kPerIP * projectedIP;
};

export const calculateFloor = (expectedKs: number, volatilityBuffer: number): number => {
  const rawFloor = expectedKs - volatilityBuffer * Math.sqrt(expectedKs);
  const minFloor = Math.max(0, expectedKs - 3);
  return Math.round(Math.max(minFloor, rawFloor));
};

export const calculateCeiling = (expectedKs: number, volatilityBuffer: number): number => {
  const rawCeiling = expectedKs + volatilityBuffer * Math.sqrt(expectedKs) * 1.2;
  const maxCeiling = expectedKs + 4;
  return Math.min(Math.round(maxCeiling), Math.round(rawCeiling));
};

// ─── main entry point ─────────────────────────────────────────────────────────

export const computeSalci = (inputs: SalciInputs): SalciScore => {
  const stuffNorm = normalizeStuff(inputs.stuffPlus);
  const locationNorm = normalizeLocation(inputs.locationPlus);
  const matchupClamped = clamp(inputs.matchupScore, 15, 92);
  const workloadClamped = clamp(inputs.workloadScore, 20, 85);

  const total = clamp(
    stuffNorm * 0.52 +
    locationNorm * 0.08 +
    matchupClamped * 0.30 +
    workloadClamped * 0.10,
    10,
    95
  );

  const buffer = calculateVolatilityBuffer(inputs.stuffPlus, inputs.locationPlus);
  const expectedKs = calculateExpectedKs(total, inputs.projectedIP);
  const floor = calculateFloor(expectedKs, buffer);
  const ceiling = calculateCeiling(expectedKs, buffer);
  const recommendOver = floor >= inputs.bookLine + 2;

  return {
    stuff: stuffNorm,
    location: locationNorm,
    matchup: inputs.matchupScore,
    workload: inputs.workloadScore,
    total,
    grade: computeGrade(total),
    floor,
    ceiling,
    expectedKs,
    buffer,
    recommendOver,
  };
};

export const SALCI_WEIGHTS = {
  stuff: 0.52,
  matchup: 0.30,
  workload: 0.10,
  location: 0.08,
} as const;
