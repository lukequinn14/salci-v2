'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PitcherCard from '@/components/pitcher/PitcherCard';
import YesterdayResultCard from '@/components/pitcher/YesterdayResultCard';
import Spinner from '@/components/ui/Spinner';
import type { Pitcher } from '@/types/pitcher';
import type { YesterdayResult } from '@/types/results';

type Tab = 'today' | 'yesterday';

interface PitchersResponse {
  pitchers: Pitcher[];
  gameDate: string;
  lastUpdated: string | null;
  source: 'cache' | 'live';
}
interface YesterdayResponse { results: YesterdayResult[]; gameDate: string }

const isDev = process.env.NODE_ENV === 'development';

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

  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const fetchToday = () => {
    setTodayLoading(true);
    setTodayError(null);
    fetch('/api/pitchers')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load pitchers');
        return r.json() as Promise<PitchersResponse>;
      })
      .then(setTodayData)
      .catch((e: unknown) => setTodayError(e instanceof Error ? e.message : 'Unknown error'))
      .finally(() => setTodayLoading(false));
  };

  useEffect(fetchToday, []);

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

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMsg(null);
    try {
      const res = await fetch('/api/cron/trigger', { method: 'POST' });
      const data = (await res.json()) as { computed?: number; failed?: number; error?: string };
      if (data.error) {
        setRefreshMsg(`Error: ${data.error}`);
      } else {
        setRefreshMsg(`Done — ${data.computed} computed, ${data.failed} failed`);
        fetchToday();
      }
    } catch {
      setRefreshMsg('Request failed');
    } finally {
      setRefreshing(false);
    }
  };

  const winsToday = yesterdayData?.results.filter((r) => r.result === 'win').length ?? 0;
  const betsToday = yesterdayData?.results.filter((r) => r.recommendOver).length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
            Starting Pitchers
          </h1>
          <p className="text-sm text-zinc-500">
            {tab === 'today'
              ? `Ranked by SALCI score · ${todayData?.gameDate ?? '…'}${todayData?.source === 'cache' ? ' · cached' : ''}`
              : `Yesterday's predictions vs results · ${yesterdayData?.gameDate ?? '…'}`}
          </p>
        </div>

        {/* Dev-only refresh button */}
        {isDev && (
          <div className="flex flex-col items-end gap-1 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Computing…' : 'Refresh data'}
            </button>
            {refreshMsg && (
              <span className="text-xs text-zinc-500">{refreshMsg}</span>
            )}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1 w-fit">
        <button
          onClick={() => setTab('today')}
          className={clsx(
            'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
            tab === 'today' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Today
        </button>
        <button
          onClick={handleYesterdayTab}
          className={clsx(
            'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors',
            tab === 'yesterday' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          Yesterday
          {yesterdayData && betsToday > 0 && (
            <span className="ml-1.5 text-xs text-zinc-500">{winsToday}/{betsToday}</span>
          )}
        </button>
      </div>

      {/* Tab content — fade on switch */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Today tab */}
          {tab === 'today' && (
            <>
              {todayLoading && (
                <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
              )}
              {todayError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {todayError}
                </div>
              )}
              {!todayLoading && todayData?.pitchers.length === 0 && (
                <EmptyState
                  message="No starters scheduled today"
                  sub="Check back when games are on the board"
                />
              )}
              {todayData && todayData.pitchers.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {todayData.pitchers.map((pitcher, i) => (
                    <motion.div
                      key={pitcher.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                    >
                      <PitcherCard pitcher={pitcher} bookLine={5.5} />
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Yesterday tab */}
          {tab === 'yesterday' && (
            <>
              {yesterdayLoading && (
                <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
              )}
              {yesterdayError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {yesterdayError}
                </div>
              )}
              {!yesterdayLoading && yesterdayData?.results.length === 0 && (
                <EmptyState
                  message="No results from yesterday"
                  sub="No games were scheduled or data isn't available yet"
                />
              )}
              {yesterdayData && yesterdayData.results.length > 0 && (
                <>
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
                    {yesterdayData.results.map((result, i) => (
                      <motion.div
                        key={result.pitcherId}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                      >
                        <YesterdayResultCard result={result} />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
