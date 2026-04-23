import type { SalciScore } from '@/types/salci';

export const computeGrade = (total: number): SalciScore['grade'] => {
  if (total >= 80) return 'S';
  if (total >= 70) return 'A';
  if (total >= 60) return 'B+';
  if (total >= 52) return 'B';
  if (total >= 44) return 'C';
  if (total >= 35) return 'D';
  return 'F';
};

export const GRADE_COLORS: Record<SalciScore['grade'], string> = {
  S: 'text-emerald-300',
  A: 'text-emerald-400',
  'B+': 'text-sky-400',
  B: 'text-blue-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

export const GRADE_BG_COLORS: Record<SalciScore['grade'], string> = {
  S: 'bg-emerald-500/15 ring-emerald-500/30',
  A: 'bg-emerald-500/10 ring-emerald-500/20',
  'B+': 'bg-sky-500/10 ring-sky-500/20',
  B: 'bg-blue-500/10 ring-blue-500/20',
  C: 'bg-yellow-500/10 ring-yellow-500/20',
  D: 'bg-orange-500/10 ring-orange-500/20',
  F: 'bg-red-500/10 ring-red-500/20',
};

export const GRADE_LABEL: Record<SalciScore['grade'], string> = {
  S: 'Elite Ace',
  A: 'Elite K Upside',
  'B+': 'Strong K Arm',
  B: 'Above-Avg K',
  C: 'Average',
  D: 'Below Average',
  F: 'Fade',
};
