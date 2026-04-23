import { Users } from 'lucide-react';

export const metadata = {
  title: 'Hitters — SALCI',
  description: 'Hitter matchup analysis and hit likelihood against today\'s starters.',
};

export default function HittersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Hitter Matchups
        </h1>
        <p className="text-sm text-zinc-500">Hit likelihood vs. today&apos;s starters</p>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20">
        <Users className="text-zinc-700" size={40} />
        <div className="text-center">
          <p className="font-medium text-zinc-400">Hitter matchups coming in Phase 3</p>
          <p className="mt-1 text-sm text-zinc-600">
            Heat maps, hit likelihood bars, and lineup vs. pitcher breakdowns
          </p>
        </div>
      </div>
    </div>
  );
}
