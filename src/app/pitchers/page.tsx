'use client';

import { useEffect, useState } from 'react';
import PitcherCard from '@/components/pitcher/PitcherCard';
import Spinner from '@/components/ui/Spinner';
import type { Pitcher } from '@/types/pitcher';

interface PitchersResponse {
  pitchers: Pitcher[];
  gameDate: string;
}

export default function PitchersPage() {
  const [data, setData] = useState<PitchersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pitchers')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load pitchers');
        return r.json() as Promise<PitchersResponse>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Starting Pitchers
        </h1>
        <p className="text-sm text-zinc-500">
          Ranked by SALCI score · {data?.gameDate ?? 'Loading…'}
        </p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {data && data.pitchers.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20 text-center">
          <p className="font-medium text-zinc-400">No starters scheduled today</p>
          <p className="text-sm text-zinc-600">Check back when games are on the board</p>
        </div>
      )}

      {data && data.pitchers.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.pitchers.map((pitcher) => (
            <PitcherCard key={pitcher.id} pitcher={pitcher} bookLine={5.5} />
          ))}
        </div>
      )}
    </div>
  );
}
