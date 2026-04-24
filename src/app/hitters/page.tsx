'use client';

import { useEffect, useState } from 'react';
import Spinner from '@/components/ui/Spinner';
import HitterMatchupCard from '@/components/hitter/HitterMatchupCard';
import TeamLogo from '@/components/ui/TeamLogo';
import type { HitterMatchup } from '@/types/hitter';

interface HittersResponse {
  matchups: HitterMatchup[];
  gameDate: string;
}

export default function HittersPage() {
  const [data, setData] = useState<HittersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/hitters')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load hitter matchups');
        return r.json() as Promise<HittersResponse>;
      })
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  // Group by pitcher
  const byPitcher = data
    ? Array.from(
        data.matchups.reduce((map, m) => {
          const key = m.pitcherId;
          if (!map.has(key)) map.set(key, { name: m.pitcherName, team: m.pitcherTeam, matchups: [] });
          map.get(key)!.matchups.push(m);
          return map;
        }, new Map<number, { name: string; team: string; matchups: HitterMatchup[] }>())
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Hitter Matchups
        </h1>
        <p className="text-sm text-zinc-500">
          Hit likelihood vs. today&apos;s starters · {data?.gameDate ?? '…'}
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

      {data && data.matchups.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20 text-center">
          <p className="font-medium text-zinc-400">No lineup data available yet</p>
          <p className="text-sm text-zinc-600">Lineups are typically posted 2–3 hours before first pitch</p>
        </div>
      )}

      {byPitcher.length > 0 && byPitcher.map(([pitcherId, group]) => (
        <div key={pitcherId} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <TeamLogo abbr={group.team} size={24} />
            <div>
              <p className="text-sm font-semibold text-zinc-200">{group.name}</p>
              <p className="text-xs text-zinc-500">{group.team} — opposing batters</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.matchups.map((m) => (
              <HitterMatchupCard key={`${m.pitcherId}-${m.hitter.id}`} matchup={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
