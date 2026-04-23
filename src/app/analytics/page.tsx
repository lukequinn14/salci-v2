import { BarChart2 } from 'lucide-react';

export const metadata = {
  title: 'Analytics — SALCI',
  description: 'Interactive MLB analytics explorer with team and player comparison tools.',
};

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Analytics Explorer
        </h1>
        <p className="text-sm text-zinc-500">
          Interactive charts, team trends, and historical SALCI data
        </p>
      </div>

      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20">
        <BarChart2 className="text-zinc-700" size={40} />
        <div className="text-center">
          <p className="font-medium text-zinc-400">Analytics explorer coming in Phase 3</p>
          <p className="mt-1 text-sm text-zinc-600">
            Team comparison, K-rate trends, and SALCI performance history
          </p>
        </div>
      </div>
    </div>
  );
}
