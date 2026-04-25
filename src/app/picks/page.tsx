'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Check, Copy, Download, Loader2, ChevronDown, X } from 'lucide-react';
import TeamLogo from '@/components/ui/TeamLogo';
import Spinner from '@/components/ui/Spinner';
import { GRADE_COLORS, GRADE_BG_COLORS } from '@/lib/salci/grades';
import type { Pitcher } from '@/types/pitcher';

const BOOK_LINE = 5.5;
const TODAY_ISO = new Date().toISOString().slice(0, 10);
const TODAY_LABEL = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── helpers ────────────────────────────────────────────────────────────────────

const confidencePill = (buffer: number) => {
  if (buffer <= 1.15) return { label: 'HIGH CONFIDENCE', cls: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30' };
  if (buffer <= 1.75) return { label: 'MODERATE', cls: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30' };
  return { label: 'BOOM/BUST', cls: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30' };
};

type Verdict = 'strong' | 'marginal' | 'fade';

const getVerdict = (pitcher: Pitcher, userLine: number, direction: 'over' | 'under'): Verdict => {
  if (direction === 'over') {
    if (pitcher.salci.floor >= userLine + 2) return 'strong';
    if (pitcher.salci.floor >= userLine) return 'marginal';
    return 'fade';
  }
  if (pitcher.salci.ceiling < userLine - 1) return 'strong';
  if (pitcher.salci.ceiling <= userLine) return 'marginal';
  return 'fade';
};

interface ValidatedBet {
  id: number;
  pitcher: Pitcher;
  userLine: number;
  direction: 'over' | 'under';
  verdict: Verdict;
}

// ── Range bar ──────────────────────────────────────────────────────────────────

const RangeBar = ({
  floor, expected, ceiling, bookLine, theirLine,
}: { floor: number; expected: number; ceiling: number; bookLine: number; theirLine?: number }) => {
  const max = Math.max(ceiling + 2, 12);
  const pct = (v: number) => Math.min(99, (v / max) * 100);
  return (
    <div className="relative mt-4 mb-3" style={{ height: 28 }}>
      <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 rounded-full bg-zinc-800" />
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-emerald-500/25"
        style={{ left: `${pct(floor)}%`, width: `${pct(ceiling) - pct(floor)}%` }}
      />
      {/* Floor */}
      <div className="absolute top-0 bottom-0 w-px bg-emerald-500" style={{ left: `${pct(floor)}%` }}>
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-emerald-500 whitespace-nowrap">{floor}</span>
      </div>
      {/* Expected dot */}
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/30"
        style={{ left: `${pct(expected)}%` }}
      />
      {/* Ceiling */}
      <div className="absolute top-0 bottom-0 w-px bg-zinc-600" style={{ left: `${pct(ceiling)}%` }}>
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-zinc-600 whitespace-nowrap">{ceiling}</span>
      </div>
      {/* Book line */}
      <div className="absolute top-0 bottom-0 w-px bg-amber-400/60" style={{ left: `${pct(bookLine)}%` }}>
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] text-amber-500 whitespace-nowrap">{bookLine}</span>
      </div>
      {/* Their line (validator) */}
      {theirLine !== undefined && theirLine !== bookLine && (
        <div className="absolute top-0 bottom-0 w-px bg-sky-400/60" style={{ left: `${pct(theirLine)}%` }}>
          <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-sky-400 whitespace-nowrap">{theirLine}</span>
        </div>
      )}
    </div>
  );
};

// ── Tier 1 card ────────────────────────────────────────────────────────────────

const Tier1Card = ({
  pitcher, selected, onToggle,
}: { pitcher: Pitcher; selected: boolean; onToggle: () => void }) => {
  const router = useRouter();
  const edge = (pitcher.salci.floor - BOOK_LINE).toFixed(1);
  const conf = confidencePill(pitcher.salci.buffer);
  return (
    <div
      className={clsx(
        'rounded-xl border bg-zinc-900 p-4 flex flex-col gap-3 transition-all',
        selected
          ? 'border-emerald-500/60 shadow-[0_0_20px_-4px_rgba(52,211,153,0.2)]'
          : 'border-zinc-700 hover:border-zinc-600'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeamLogo abbr={pitcher.team} size={32} darkBg={false} />
          <div>
            <button
              onClick={() => router.push(`/pitcher/${pitcher.id}`)}
              className="font-semibold text-zinc-100 hover:text-emerald-400 transition-colors text-left leading-tight"
            >
              {pitcher.name}
            </button>
            <p className="text-xs text-zinc-500">
              {pitcher.team} {pitcher.isHome ? 'vs' : '@'} {pitcher.opponent}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={clsx('text-xs font-bold px-1.5 py-0.5 rounded ring-1', GRADE_BG_COLORS[pitcher.salci.grade], GRADE_COLORS[pitcher.salci.grade])}>
            {pitcher.salci.grade}
          </span>
          <span className="text-sm font-bold text-zinc-300">{Math.round(pitcher.salci.total)}</span>
        </div>
      </div>

      <RangeBar
        floor={pitcher.salci.floor}
        expected={pitcher.salci.expectedKs}
        ceiling={pitcher.salci.ceiling}
        bookLine={BOOK_LINE}
      />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-bold text-emerald-400">+{edge} EDGE</span>
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', conf.cls)}>{conf.label}</span>
      </div>

      <button
        onClick={onToggle}
        className={clsx(
          'flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-colors',
          selected
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'
        )}
      >
        <div className={clsx(
          'w-4 h-4 rounded border flex items-center justify-center shrink-0',
          selected ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
        )}>
          {selected && <Check size={10} className="text-zinc-950" />}
        </div>
        {selected ? 'Added to Parlay' : 'Add to Parlay'}
      </button>
    </div>
  );
};

// ── Tier 2 card ────────────────────────────────────────────────────────────────

const Tier2Card = ({
  pitcher, selected, onToggle,
}: { pitcher: Pitcher; selected: boolean; onToggle: () => void }) => {
  const router = useRouter();
  const edge = (pitcher.salci.floor - BOOK_LINE).toFixed(1);
  const conf = confidencePill(pitcher.salci.buffer);
  return (
    <div
      className={clsx(
        'rounded-xl border bg-zinc-900/60 p-3 flex items-center gap-3 transition-colors',
        selected ? 'border-zinc-600' : 'border-zinc-800 hover:border-zinc-700'
      )}
    >
      <button
        onClick={onToggle}
        className={clsx(
          'shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors',
          selected ? 'bg-zinc-500 border-zinc-500' : 'border-zinc-700'
        )}
      >
        {selected && <Check size={9} className="text-zinc-950" />}
      </button>
      <TeamLogo abbr={pitcher.team} size={20} darkBg={false} />
      <div className="flex-1 min-w-0">
        <button
          onClick={() => router.push(`/pitcher/${pitcher.id}`)}
          className="text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-colors truncate block text-left"
        >
          {pitcher.name}
        </button>
        <p className="text-[10px] text-zinc-600">
          {pitcher.team} {pitcher.isHome ? 'vs' : '@'} {pitcher.opponent}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-zinc-500 tabular-nums">
          {pitcher.salci.floor}–{pitcher.salci.ceiling} Ks
        </span>
        <span className="text-xs font-semibold text-zinc-400">+{edge}</span>
        <span className={clsx('text-[9px] font-bold px-1.5 py-0.5 rounded-full', conf.cls)}>{conf.label}</span>
        <span className={clsx('text-[10px] font-bold', GRADE_COLORS[pitcher.salci.grade])}>{pitcher.salci.grade}</span>
      </div>
    </div>
  );
};

// ── Validation result card ─────────────────────────────────────────────────────

const VerdictCard = ({ bet, onRemove }: { bet: ValidatedBet; onRemove: () => void }) => {
  const isOver = bet.direction === 'over';
  const edge = isOver
    ? bet.pitcher.salci.floor - bet.userLine
    : bet.userLine - bet.pitcher.salci.ceiling;

  const verdictConfig = {
    strong: {
      border: 'border-emerald-500/40',
      icon: <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-lg">+</div>,
      title: isOver ? 'SALCI AGREES — Strong Over' : 'SALCI AGREES — Strong Under',
      body: isOver
        ? `Our floor of ${bet.pitcher.salci.floor} exceeds your line by ${edge.toFixed(1)}. High confidence this pitcher hits ${bet.pitcher.salci.floor}+ Ks.`
        : `Our ceiling of ${bet.pitcher.salci.ceiling} sits ${edge.toFixed(1)} below your line. Strong under signal.`,
      titleColor: 'text-emerald-400',
    },
    marginal: {
      border: 'border-yellow-500/30',
      icon: <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/15 text-yellow-400 font-bold text-lg">~</div>,
      title: 'SALCI IS MARGINAL',
      body: isOver
        ? `Floor ${bet.pitcher.salci.floor} is close to your line ${bet.userLine}. Playable but not our strongest signal.`
        : `Ceiling ${bet.pitcher.salci.ceiling} is close to your line ${bet.userLine}. Marginal under signal.`,
      titleColor: 'text-yellow-400',
    },
    fade: {
      border: 'border-red-500/30',
      icon: <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/15 text-red-400 font-bold text-lg">X</div>,
      title: 'SALCI SAYS FADE',
      body: isOver
        ? `Our floor of ${bet.pitcher.salci.floor} does not support the ${bet.userLine} line. Model projects ${bet.pitcher.salci.expectedKs.toFixed(1)} Ks expected.`
        : `Our ceiling of ${bet.pitcher.salci.ceiling} does not support the under at ${bet.userLine}.`,
      titleColor: 'text-red-400',
    },
  }[bet.verdict];

  return (
    <div className={clsx('rounded-xl border bg-zinc-900 p-4 space-y-3', verdictConfig.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {verdictConfig.icon}
          <div>
            <p className={clsx('text-sm font-bold', verdictConfig.titleColor)}>{verdictConfig.title}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed max-w-xs">{verdictConfig.body}</p>
          </div>
        </div>
        <button onClick={onRemove} className="text-zinc-600 hover:text-zinc-400 shrink-0">
          <X size={14} />
        </button>
      </div>
      <div className="text-xs text-zinc-500">
        <span className="font-medium text-zinc-300">{bet.pitcher.name}</span>
        {' — '}
        {bet.direction.toUpperCase()} {bet.userLine} · Floor {bet.pitcher.salci.floor} · Exp {bet.pitcher.salci.expectedKs.toFixed(1)} · Ceiling {bet.pitcher.salci.ceiling}
      </div>
      <RangeBar
        floor={bet.pitcher.salci.floor}
        expected={bet.pitcher.salci.expectedKs}
        ceiling={bet.pitcher.salci.ceiling}
        bookLine={BOOK_LINE}
        theirLine={bet.userLine}
      />
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PicksPage() {
  const [mode, setMode] = useState<'picks' | 'validator'>('picks');
  const [pitchers, setPitchers] = useState<Pitcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [copyDone, setCopyDone] = useState(false);
  const [shareGenerating, setShareGenerating] = useState(false);

  // Validator state
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPitcher, setSelectedPitcher] = useState<Pitcher | null>(null);
  const [userLine, setUserLine] = useState('5.5');
  const [direction, setDirection] = useState<'over' | 'under'>('over');
  const [validatedBets, setValidatedBets] = useState<ValidatedBet[]>([]);

  const shareCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/pitchers')
      .then((r) => r.json() as Promise<{ pitchers: Pitcher[] }>)
      .then(({ pitchers: p }) => setPitchers(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tier1 = useMemo(() => pitchers.filter((p) => p.salci.recommendOver), [pitchers]);
  const tier2 = useMemo(
    () => pitchers.filter((p) => !p.salci.recommendOver && p.salci.floor >= BOOK_LINE),
    [pitchers]
  );
  const selectedPitchers = useMemo(
    () => [...tier1, ...tier2].filter((p) => selectedIds.has(p.id)),
    [tier1, tier2, selectedIds]
  );

  const toggleId = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyText = async () => {
    const lines = selectedPitchers.map(
      (p) => `${p.name} OVER ${BOOK_LINE} | Floor ${p.salci.floor} | Edge +${(p.salci.floor - BOOK_LINE).toFixed(1)}`
    );
    const text = `SALCI Picks ${TODAY_ISO}\n${lines.join('\n')}\n#SALCI #MLB`;
    await navigator.clipboard.writeText(text);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  };

  const generateShareCard = async () => {
    if (!shareCardRef.current) return;
    setShareGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(shareCardRef.current, { backgroundColor: '#09090b', scale: 2 });
      const link = document.createElement('a');
      link.download = `salci-picks-${TODAY_ISO}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setShareGenerating(false);
    }
  };

  // Validator helpers
  const filteredPitchers = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return pitchers;
    return pitchers.filter((p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q));
  }, [pitchers, search]);

  const validate = () => {
    if (!selectedPitcher) return;
    const line = parseFloat(userLine);
    if (isNaN(line)) return;
    const verdict = getVerdict(selectedPitcher, line, direction);
    setValidatedBets((prev) => [
      { id: Date.now(), pitcher: selectedPitcher, userLine: line, direction, verdict },
      ...prev,
    ]);
    setSelectedPitcher(null);
    setSearch('');
    setUserLine('5.5');
  };

  return (
    <div className="flex flex-col gap-6 pb-40">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">Picks</h1>
        <p className="text-sm text-zinc-500 mt-0.5">{TODAY_LABEL} · SALCI strikeout recommendations</p>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-zinc-900 border border-zinc-800 p-1 w-fit">
        {(['picks', 'validator'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={clsx(
              'rounded-md px-4 py-1.5 text-sm font-semibold transition-colors capitalize',
              mode === m ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {m === 'picks' ? "Today's Picks" : 'Bet Validator'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" /></div>
      ) : mode === 'picks' ? (
        <>
          {/* Tier 1 */}
          {tier1.length > 0 && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide">
                  Strong Plays — {tier1.length}
                </h2>
                <p className="text-xs text-zinc-600 mt-0.5">Floor exceeds book line by 2+ strikeouts</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {tier1.map((p) => (
                  <Tier1Card key={p.id} pitcher={p} selected={selectedIds.has(p.id)} onToggle={() => toggleId(p.id)} />
                ))}
              </div>
            </section>
          )}

          {/* Tier 2 */}
          {tier2.length > 0 && (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                  On The Radar — {tier2.length}
                </h2>
                <p className="text-xs text-zinc-600 mt-0.5">Floor at or above book line — watch, not yet a strong bet</p>
              </div>
              <div className="flex flex-col gap-2">
                {tier2.map((p) => (
                  <Tier2Card key={p.id} pitcher={p} selected={selectedIds.has(p.id)} onToggle={() => toggleId(p.id)} />
                ))}
              </div>
            </section>
          )}

          {tier1.length === 0 && tier2.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 py-20 text-center">
              <p className="font-medium text-zinc-400">No picks available today</p>
              <p className="text-sm text-zinc-600">Run the pipeline or check back when games are scheduled</p>
            </div>
          )}
        </>
      ) : (
        /* ── Validator mode ── */
        <div className="flex flex-col gap-5 max-w-xl">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-300">Enter your bet to validate</h2>

            {/* Pitcher search */}
            <div className="relative">
              <label className="text-xs text-zinc-500 mb-1 block">Pitcher</label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedPitcher ? selectedPitcher.name : search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedPitcher(null); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder="Search pitcher name or team..."
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-emerald-500/50"
                />
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
              </div>
              {showDropdown && filteredPitchers.length > 0 && !selectedPitcher && (
                <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl">
                  {filteredPitchers.slice(0, 20).map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={() => { setSelectedPitcher(p); setSearch(''); setShowDropdown(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700 text-left transition-colors"
                    >
                      <TeamLogo abbr={p.team} size={16} darkBg={false} />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-zinc-500">{p.team}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Line input */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Your line at the book</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={userLine}
                onChange={(e) => setUserLine(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Over / Under toggle */}
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Direction</label>
              <div className="flex gap-2">
                {(['over', 'under'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={clsx(
                      'flex-1 rounded-lg border py-2 text-sm font-semibold uppercase transition-colors',
                      direction === d
                        ? d === 'over'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                          : 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={validate}
              disabled={!selectedPitcher}
              className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Validate
            </button>
          </div>

          {/* Result stack */}
          {validatedBets.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Your card — {validatedBets.length} bet{validatedBets.length > 1 ? 's' : ''}</h3>
              {validatedBets.map((bet) => (
                <VerdictCard
                  key={bet.id}
                  bet={bet}
                  onRemove={() => setValidatedBets((prev) => prev.filter((b) => b.id !== bet.id))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Parlay bar (fixed bottom, picks mode, 2+ selected) ── */}
      {mode === 'picks' && selectedPitchers.length >= 2 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 md:bottom-0 px-4 pb-3 pt-2 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500 shrink-0">{selectedPitchers.length} picks:</span>
              {selectedPitchers.map((p) => (
                <span key={p.id} className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                  {p.name.split(' ').pop()}
                  <button onClick={() => toggleId(p.id)} className="hover:text-emerald-300">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={generateShareCard}
                disabled={shareGenerating}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50"
              >
                {shareGenerating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                Share Card
              </button>
              <button
                onClick={copyText}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
              >
                {copyDone ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                {copyDone ? 'Copied' : 'Copy Text'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hidden share card (off-screen for html2canvas) ── */}
      <div
        ref={shareCardRef}
        style={{ position: 'absolute', left: '-9999px', top: 0, width: 600 }}
        className="bg-zinc-950 p-8 font-sans"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-2xl font-bold text-emerald-400">SALCI</span>
            <span className="ml-2 text-sm text-zinc-500">Picks · {TODAY_ISO}</span>
          </div>
          <span className="text-xs text-zinc-600">#SALCI #MLB</span>
        </div>
        <div className="space-y-3">
          {selectedPitchers.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-zinc-900 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-zinc-100">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.team} {p.isHome ? 'vs' : '@'} {p.opponent}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-400">OVER {BOOK_LINE}</p>
                <p className="text-xs text-zinc-500">
                  Floor {p.salci.floor} · Edge +{(p.salci.floor - BOOK_LINE).toFixed(1)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[10px] text-zinc-700 text-center">
          Powered by SALCI v4 · salci-v2.vercel.app · Not financial advice
        </p>
      </div>
    </div>
  );
}
