import type { SalciInputs, SalciScore } from '@/types/salci';
import { computeGrade } from './grades';

const sigmoid = (z: number, sharpness: number): number =>
  1 / (1 + Math.exp(-sharpness * z));

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const zToScore = (
  z: number,
  center: number,
  scale: number,
  min: number,
  max: number,
  sharpness = 1.8
): number => {
  const stretched = (sigmoid(z, sharpness) - 0.5) * 2;
  const score = center + stretched * scale;
  return clamp(score, min, max);
};

export const computeStuffScore = (stuffPlus: number): number => {
  const stuffZ = (stuffPlus - 100) / 8.0;
  return zToScore(stuffZ, 50, 36, 6, 97, 1.8);
};

export const computeLocationScore = (locationPlus: number): number => {
  const locationZ = (locationPlus - 100) / 10.0;
  // Cap upside of great command — extreme precision hurts K prediction
  const locationZAdj = Math.min(locationZ, 0.5);
  return zToScore(locationZAdj, 50, 10, 35, 65);
};

export const computeMatchupScore = (
  oppKPct: number,
  oppZoneContact: number,
  sameSidePct: number
): number => {
  const kZ = (oppKPct - 0.22) / 0.025;
  const contactZ = -(oppZoneContact - 0.82) / 0.035;
  const platoonZ = (sameSidePct - 0.5) / 0.15;
  const rawMatchup = kZ * 0.7 + contactZ * 0.3 + platoonZ * 0.08;
  return zToScore(rawMatchup, 50, 22, 15, 90);
};

export const computeWorkloadScore = (
  pPerIP: number,
  projectedBF: number,
  managerLeash: number,
  tttKDrop: number
): number => {
  const efficiencyScore = clamp((20 - pPerIP) * 10 + 50, 0, 100);
  const bfScore = clamp(((projectedBF - 15) / 12) * 100, 0, 100);
  const leashScore = clamp(managerLeash, 0, 100);
  const tttPenalty = clamp(100 - tttKDrop * 15, 0, 100);

  const raw =
    efficiencyScore * 0.25 +
    bfScore * 0.3 +
    leashScore * 0.25 +
    tttPenalty * 0.2;

  return clamp(raw, 20, 85);
};

export const computeVolatilityBuffer = (stuffPlus: number, locationPlus: number): number => {
  const gap = stuffPlus - locationPlus;
  if (gap > 22) return 2.1;
  if (gap > 15) return 1.75;
  if (gap > 8) return 1.4;
  if (gap < -15) return 0.8;
  if (gap < -8) return 0.95;
  return 1.15;
};

export const computeSalci = (inputs: SalciInputs): SalciScore => {
  const stuffNorm = computeStuffScore(inputs.stuffPlus);
  const locationNorm = computeLocationScore(inputs.locationPlus);
  const matchupScore = computeMatchupScore(
    inputs.oppKPct,
    inputs.oppZoneContact,
    inputs.sameSidePct
  );
  const workloadScore = computeWorkloadScore(
    inputs.pPerIP,
    inputs.projectedBF,
    inputs.managerLeash,
    inputs.tttKDrop
  );

  const total = clamp(
    stuffNorm * 0.52 +
      locationNorm * 0.08 +
      clamp(matchupScore, 15, 92) * 0.3 +
      clamp(workloadScore, 20, 85) * 0.1,
    10,
    95
  );

  const buffer = computeVolatilityBuffer(inputs.stuffPlus, inputs.locationPlus);
  const expectedKs = 1.5 + (total / 95) * 9.5;
  const stdDev = Math.sqrt(expectedKs);
  const floor = Math.max(0, Math.round(expectedKs - buffer * stdDev));
  const ceiling = Math.round(expectedKs + buffer * stdDev);
  const recommendOver = floor >= inputs.bookLine + 2;

  return {
    stuff: stuffNorm,
    location: locationNorm,
    matchup: matchupScore,
    workload: workloadScore,
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
