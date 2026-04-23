'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import PitcherCard from '@/components/pitcher/PitcherCard';
import YesterdayResultCard from '@/components/pitcher/YesterdayResultCard';
import Spinner from '@/components/ui/Spinner';
import type { Pitcher } from '@/types/pitcher';
import type { YesterdayResult } from '@/types/results';

type Tab = 'today' | 'yesterday';

interface PitchersResponse { pitchers: Pitcher[]; gameDate: string }
interface YesterdayResponse { results: YesterdayResult[]; gameDate: string }

const EmptyState = ({ message, sub }: { message: string; sub: string }) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20 text-center">
    <p className="font-medium text-zinc-400">{message}</p>
    <p className="text-sm text-zinc-600">{sub}</p>
  </div>
);

export default function PitchersPage() {
  const [tab, setTab] = useState<Tab>('today');

  const [todayData, setTodayData] = useState<PitchersResponse | null>(null);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState<string | null>(null);

  const [yesterdayData, setYesterdayData] = useState<YesterdayResponse | null>(null);
  const [yesterdayLoading, setYesterdayLoading] = useState(false);
  const [yesterdayError, setYesterdayError] = useState<string | null>(null);
  const [yesterdayFetched, setYesterdayFetched] = useState(false);

  useEffect(() => {
    fetch('/api/pitchers')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load pitchers');
        return r.json() as Promise<PitchersResponse>;
      })
      .then(setTodayData)
      .catch((e: unknown) => setTodayError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setTodayLoading(false));
  }, []);

  const handleYesterdayTab = () => {
    setTab('yesterday');
    if (yesterdayFetched) return;
    setYesterdayLoading(true);
    fetch('/api/yesterday')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load yesterday results');
        return r.json() as Promise<YesterdayResponse>;
      })
      .then(setYesterdayData)
      .catch((e: unknown) => setYesterdayError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => {
        setYesterdayLoading(false);
        setYesterdayFetched(true);
      });
  };

  const winsToday = yesterdayData?.results.filter((r) => r.result === 'win').length ?? 0;
  const betsToday = yesterdayData?.results.filter((r) => r.recommendOver).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
          Starting Pitchers
        </h1>
        <p className="text-sm text-zinc-500">
          {tab === 'today'
            ? `Ranked by SALCI score · ${todayData?.gameDate ?? '…'}`
            : `Yesterday's predictions vs results · ${yesterdayData?.gameDate ?? '…'}`}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1 w-fit">
        <button
          onClick={() => setTab('today')}
          className={clsx(
            'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
            tab === 'today'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Today
        </button>
        <button
          onClick={handleYesterdayTab}
          className={clsx(
            'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
            tab === 'yesterday'
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Yesterday
          {yesterdayData && betsToday > 0 && (
            <span className="ml-1.5 text-xs text-zinc-500">
              {winsToday}/{betsToday}
            </span>
          )}
        </button>
      </div>

      {/* Today tab */}
      {tab === 'today' && (
        <>
          {todayLoading && (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          )}
          {todayError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {todayError}
            </div>
          )}
          {todayData?.pitchers.length === 0 && (
            <EmptyState
              message="No starters scheduled today"
              sub="Check back when games are on the board"
            />
          )}
          {todayData && todayData.pitchers.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {todayData.pitchers.map((pitcher) => (
                <PitcherCard key={pitcher.id} pitcher={pitcher} bookLine={5.5} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Yesterday tab */}
      {tab === 'yesterday' && (
        <>
          {yesterdayLoading && (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          )}
          {yesterdayError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {yesterdayError}
            </div>
          )}

          {yesterdayData && yesterdayData.results.length === 0 && (
            <EmptyState
              message="No results from yesterday"
              sub="No games were scheduled or data isn't available yet"
            />
          )}

          {yesterdayData && yesterdayData.results.length > 0 && (
            <>
              {/* Summary row */}
              {betsToday > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-400">{winsToday}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Over hits</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">
                      {yesterdayData.results.filter((r) => r.result === 'loss').length}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">Misses</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-center">
                    <p className="text-2xl font-bold text-zinc-300">
                      {betsToday > 0 ? `${Math.round((winsToday / betsToday) * 100)}%` : '—'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">Hit rate</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {yesterdayData.results.map((result) => (
                  <YesterdayResultCard key={result.pitcherId} result={result} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
