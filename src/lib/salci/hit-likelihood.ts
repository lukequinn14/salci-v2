export interface HitLikelihoodInputs {
  // Hitter stats
  hitterBavg: number;
  hitterOPS: number;
  hitterKPct: number;
  hitterContactPct: number;
  // Pitcher stats
  pitcherStuffPlus: number;
  pitcherLocationPlus: number;
  pitcherKPct: number;
  pitcherERA: number;
  pitcherWHIP: number;
  // Matchup context
  pitcherHand: 'L' | 'R';
  hitterHand: 'L' | 'R' | 'S';
  isHome: boolean;
}

export interface HitLikelihoodResult {
  probability: number;
  grade: 'HOT' | 'WARM' | 'NEUTRAL' | 'COLD' | 'ICE';
  factors: {
    hitterQuality: number;
    pitcherDifficulty: number;
    platoonEdge: number;
    contactProfile: number;
    parkFactor: number;
  };
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const sigmoid = (z: number, sharpness = 1.2): number =>
  1 / (1 + Math.exp(-sharpness * z));

const hitGrade = (p: number): HitLikelihoodResult['grade'] => {
  if (p >= 0.33) return 'HOT';
  if (p >= 0.28) return 'WARM';
  if (p >= 0.23) return 'NEUTRAL';
  if (p >= 0.18) return 'COLD';
  return 'ICE';
};

export const calculateHitLikelihood = (inputs: HitLikelihoodInputs): HitLikelihoodResult => {
  // Step 1: Hitter quality (0-1)
  const bavgZ = (inputs.hitterBavg - 0.248) / 0.030;
  const opsZ = (inputs.hitterOPS - 0.710) / 0.080;
  const hitterQuality = sigmoid(bavgZ * 0.60 + opsZ * 0.40, 1.2);

  // Step 2: Pitcher difficulty (0-1, higher = harder to hit)
  const kPctZ = (inputs.pitcherKPct - 0.22) / 0.04;
  const whipZ = -(inputs.pitcherWHIP - 1.30) / 0.15;
  const stuffZ = (inputs.pitcherStuffPlus - 100) / 12;
  const pitcherDifficulty = sigmoid(kPctZ * 0.40 + whipZ * 0.35 + stuffZ * 0.25, 1.2);

  // Step 3: Platoon edge
  const sameSide =
    (inputs.pitcherHand === 'R' && inputs.hitterHand === 'R') ||
    (inputs.pitcherHand === 'L' && inputs.hitterHand === 'L');
  const platoonEdge = inputs.hitterHand === 'S' ? 0.50 : sameSide ? 0.42 : 0.58;

  // Step 4: Contact profile
  const contactZ = -(inputs.hitterKPct - 0.22) / 0.04;
  const contactProfile = sigmoid(contactZ, 1.0);

  // Step 5: Park factor (placeholder)
  const parkFactor = 1.0;

  // Combine and calibrate to realistic hit probability range [0.15..0.40]
  const rawProb =
    hitterQuality * 0.35 +
    (1 - pitcherDifficulty) * 0.35 +
    platoonEdge * 0.15 +
    contactProfile * 0.15;

  const probability = clamp(0.15 + rawProb * 0.25, 0.15, 0.40);

  return {
    probability,
    grade: hitGrade(probability),
    factors: {
      hitterQuality,
      pitcherDifficulty,
      platoonEdge,
      contactProfile,
      parkFactor,
    },
  };
};
