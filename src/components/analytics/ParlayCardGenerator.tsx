'use client';

import { useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { GRADE_LABEL, GRADE_COLORS } from '@/lib/salci/grades';
import { clsx } from 'clsx';
import type { Pitcher } from '@/types/pitcher';

interface ParlayCardGeneratorProps {
  pitchers: Pitcher[];
  bookLines: Record<number, number>;
}

const GRADE_HEX: Record<string, string> = {
  S: '#6ee7b7', A: '#34d399', 'B+': '#38bdf8',
  B: '#60a5fa', C: '#facc15', D: '#fb923c', F: '#f87171',
};

const ParlayCardGenerator = ({ pitchers, bookLines }: ParlayCardGeneratorProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
        useCORS: false,
        allowTaint: true,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `salci-parlay-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Card preview */}
      <div
        ref={cardRef}
        style={{
          background: '#09090b',
          border: '1px solid #27272a',
          borderRadius: 16,
          padding: 24,
          width: 380,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <p style={{ color: '#34d399', fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px' }}>
              SALCI
            </p>
            <p style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>Parlay Picks</p>
          </div>
          <p style={{ color: '#52525b', fontSize: 11 }}>
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {/* Pitcher rows */}
        {pitchers.map((pitcher, i) => {
          const bookLine = bookLines[pitcher.id] ?? 5.5;
          const edge = pitcher.salci.floor - bookLine;
          const gradeHex = GRADE_HEX[pitcher.salci.grade] ?? '#a1a1aa';

          return (
            <div
              key={pitcher.id}
              style={{
                borderTop: i === 0 ? '1px solid #27272a' : 'none',
                borderBottom: '1px solid #27272a',
                padding: '12px 0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <p style={{ color: '#f4f4f5', fontWeight: 600, fontSize: 14 }}>{pitcher.name}</p>
                  <p style={{ color: '#71717a', fontSize: 11 }}>
                    {pitcher.team} {pitcher.isHome ? 'vs' : '@'} {pitcher.opponent}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: gradeHex, fontWeight: 700, fontSize: 18, lineHeight: 1 }}>
                    {pitcher.salci.grade}
                  </p>
                  <p style={{ color: '#71717a', fontSize: 10, marginTop: 2 }}>
                    SALCI {Math.round(pitcher.salci.total)}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                <span style={{ color: '#71717a' }}>
                  Floor <span style={{ color: '#f4f4f5', fontWeight: 600 }}>{pitcher.salci.floor}</span>
                </span>
                <span style={{ color: '#71717a' }}>
                  Exp <span style={{ color: gradeHex, fontWeight: 600 }}>
                    {(Math.round(pitcher.salci.expectedKs * 10) / 10).toFixed(1)}
                  </span>
                </span>
                <span style={{ color: '#71717a' }}>
                  Line <span style={{ color: '#f59e0b', fontWeight: 600 }}>{bookLine}</span>
                </span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>
                  +{edge >= 0 ? edge.toFixed(1) : edge.toFixed(1)} edge
                </span>
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <p style={{ color: '#3f3f46', fontSize: 10, textAlign: 'center', marginTop: 14 }}>
          @SALCI · #SALCI · For entertainment purposes only
        </p>
      </div>

      <button
        onClick={handleDownload}
        disabled={generating}
        className="flex items-center justify-center gap-2 rounded-lg border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 disabled:opacity-50"
      >
        {generating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        {generating ? 'Generating…' : 'Download Parlay Card'}
      </button>
    </div>
  );
};

export default ParlayCardGenerator;
