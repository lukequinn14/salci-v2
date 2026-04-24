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

interface PitcherGroup {
  name: string;
  team: string;
  salciTotal: number;
  lineupConfirmed: boolean;
  matchups: HitterMatchup[];
}

const salciGradeLabel = (total: number) => {
  if (total >= 80) return { label: 'S', color: 'text-purple-400' };
  if (total >= 70) return { label: 'A', color: 'text-emerald-400' };
  if (total >= 60) return { label: 'B+', color: 'text-blue-400' };
  if (total >= 52) return { label: 'B', color: 'text-zinc-300' };
  return null;
};

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

  const byPitcher: [number, PitcherGroup][] = data
    ? Array.from(
        data.matchups.reduce((map, m) => {
          const key = m.pitcherId;
          if (!map.has(key)) {
            map.set(key, {
              name: m.pitcherName,
              team: m.pitcherTeam,
              salciTotal: m.pitcherSalciTotal,
              lineupConfirmed: false,
              matchups: [],
            });
          }
          const group = map.get(key)!;
          group.matchups.push(m);
          if (m.hitter.lineupStatus === 'confirmed') group.lineupConfirmed = true;
          return map;
        }, new Map<number, PitcherGroup>())
      )
    : [];

  const anyConfirmed = byPitcher.some(([, g]) => g.lineupConfirmed);

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

      {/* Lineup status banner */}
      {data && byPitcher.length > 0 && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          anyConfirmed
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        }`}>
          {anyConfirmed
            ? 'Official lineups are live — confirmed batting order shown in green.'
            : 'Pre-lineup view — showing full active rosters. Batting order posts 2–3 hrs before first pitch. Hit likelihood already accounts for each pitcher\'s SALCI score.'}
        </div>
      )}

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
          <p className="font-medium text-zinc-400">No games scheduled today</p>
          <p className="text-sm text-zinc-600">Check back when probable pitchers are posted</p>
        </div>
      )}

      {byPitcher.length > 0 && byPitcher.map(([pitcherId, group]) => {
        const grade = salciGradeLabel(group.salciTotal);
        return (
          <div key={pitcherId} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <TeamLogo abbr={group.team} size={24} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-200">{group.name}</p>
                  {grade && (
                    <span className={`text-xs font-bold ${grade.color}`}>
                      SALCI {grade.label}
                    </span>
                  )}
                  {group.salciTotal > 0 && (
                    <span className="text-xs text-zinc-600">({Math.round(group.salciTotal)})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-zinc-500">{group.team} — opposing batters</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    group.lineupConfirmed
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-amber-500/15 text-amber-400'
                  }`}>
                    {group.lineupConfirmed ? 'Lineup confirmed' : 'Pre-lineup roster'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-600">{group.matchups.length} batters</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.matchups.map((m) => (
                <HitterMatchupCard key={`${m.pitcherId}-${m.hitter.id}`} matchup={m} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
