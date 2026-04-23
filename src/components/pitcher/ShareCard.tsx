'use client';

import { useRef, useState } from 'react';
import { Share2, Download, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { GRADE_LABEL } from '@/lib/salci/grades';
import type { Pitcher } from '@/types/pitcher';

interface ShareCardProps {
  pitcher: Pitcher;
  bookLine: number;
}

const ShareCard = ({ pitcher, bookLine }: ShareCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const gradeColor = {
    S: '#6ee7b7', A: '#34d399', 'B+': '#38bdf8',
    B: '#60a5fa', C: '#facc15', D: '#fb923c', F: '#f87171',
  }[pitcher.salci.grade];

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
        useCORS: false,
        allowTaint: false,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `salci-${pitcher.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Card preview (this gets captured) */}
      <div
        ref={cardRef}
        className="rounded-xl border border-zinc-800 bg-zinc-950 p-5"
        style={{ width: 360, fontFamily: 'system-ui, sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-emerald-400 font-black text-lg tracking-tight">SALCI</p>
            <p style={{ color: '#71717a', fontSize: 11 }}>Strikeout Analytics</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: gradeColor, fontSize: 32, fontWeight: 800, lineHeight: 1 }}>
              {Math.round(pitcher.salci.total)}
            </p>
            <p style={{ color: gradeColor, fontSize: 12, fontWeight: 600 }}>
              {pitcher.salci.grade} · {GRADE_LABEL[pitcher.salci.grade]}
            </p>
          </div>
        </div>

        {/* Pitcher info */}
        <p style={{ color: '#f4f4f5', fontWeight: 700, fontSize: 16 }}>{pitcher.name}</p>
        <p style={{ color: '#71717a', fontSize: 12, marginBottom: 16 }}>
          {pitcher.team} {pitcher.isHome ? 'vs' : '@'} {pitcher.opponent}
        </p>

        {/* K projection */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            background: '#18181b',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 12,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#71717a', fontSize: 10 }}>FLOOR</p>
            <p style={{ color: '#f4f4f5', fontWeight: 700, fontSize: 20 }}>{pitcher.salci.floor}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#71717a', fontSize: 10 }}>EXPECTED</p>
            <p style={{ color: gradeColor, fontWeight: 700, fontSize: 20 }}>
              {(Math.round(pitcher.salci.expectedKs * 10) / 10).toFixed(1)}
            </p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#71717a', fontSize: 10 }}>CEILING</p>
            <p style={{ color: '#f4f4f5', fontWeight: 700, fontSize: 20 }}>{pitcher.salci.ceiling}</p>
          </div>
        </div>

        {/* Recommendation */}
        {pitcher.salci.recommendOver && (
          <div
            style={{
              background: 'rgba(52,211,153,0.1)',
              border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: 8,
              padding: '8px 12px',
              color: '#34d399',
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            ✓ OVER {bookLine} Strikeouts (floor ≥ line + 2)
          </div>
        )}

        {/* Footer */}
        <p style={{ color: '#3f3f46', fontSize: 10, textAlign: 'center' }}>
          @SALCI · #SALCI · salci.app
        </p>
      </div>

      {/* Download button */}
      <button
        onClick={handleDownload}
        disabled={generating}
        className={clsx(
          'flex items-center justify-center gap-2 rounded-lg border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400 disabled:opacity-50',
        )}
      >
        {generating ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Download size={15} />
        )}
        {generating ? 'Generating…' : 'Download card'}
        <Share2 size={13} className="ml-1 opacity-60" />
      </button>
    </div>
  );
};

export default ShareCard;
