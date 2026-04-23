import { TrendingUp } from 'lucide-react';

export const metadata = {
  title: 'Pitchers — SALCI',
  description: 'Today\'s starting pitchers ranked by SALCI score with K-line projections.',
};

export default function PitchersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Starting Pitchers
        </h1>
        <p className="text-sm text-zinc-500">Ranked by SALCI score — updated daily</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20">
        <TrendingUp className="text-zinc-700" size={40} />
        <div className="text-center">
          <p className="font-medium text-zinc-400">Pitcher cards coming in Phase 3</p>
          <p className="mt-1 text-sm text-zinc-600">
            SALCI scores, K-line projections, and share cards
          </p>
        </div>
      </div>
    </div>
  );
}
