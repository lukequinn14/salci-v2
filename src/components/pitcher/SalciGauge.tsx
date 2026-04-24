'use client';

import { useEffect, useState } from 'react';
import { animate } from 'framer-motion';
import { GRADE_COLORS, GRADE_LABEL } from '@/lib/salci/grades';
import type { SalciScore } from '@/types/salci';

interface SalciGaugeProps {
  salci: SalciScore;
  size?: number;
}

const SalciGauge = ({ salci, size = 120 }: SalciGaugeProps) => {
  const [displayTotal, setDisplayTotal] = useState(0);

  useEffect(() => {
    const controls = animate(0, salci.total, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (v) => setDisplayTotal(v),
    });
    return controls.stop;
  }, [salci.total]);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeWidth = size * 0.09;

  const arcSpan = 240;
  const startAngle = 150;
  const fillAngle = (displayTotal / 100) * arcSpan;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (startDeg: number, endDeg: number) => {
    const start = toRad(startDeg);
    const end = toRad(endDeg);
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const gradeColor = {
    S: '#6ee7b7',
    A: '#34d399',
    'B+': '#38bdf8',
    B: '#60a5fa',
    C: '#facc15',
    D: '#fb923c',
    F: '#f87171',
  }[salci.grade];

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size * 0.75} viewBox={`0 0 ${size} ${size * 0.75}`}>
        {/* Track */}
        <path
          d={arcPath(startAngle, startAngle + arcSpan)}
          fill="none"
          stroke="#27272a"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Fill */}
        {displayTotal > 0 && (
          <path
            d={arcPath(startAngle, startAngle + fillAngle)}
            fill="none"
            stroke={gradeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${gradeColor}60)` }}
          />
        )}
        {/* Score */}
        <text
          x={cx}
          y={cy * 0.85}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.22}
          fontWeight="700"
          fill={gradeColor}
          fontFamily="var(--font-geist-sans)"
        >
          {Math.round(displayTotal)}
        </text>
        {/* Grade */}
        <text
          x={cx}
          y={cy * 1.18}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={size * 0.13}
          fontWeight="600"
          fill={gradeColor}
          fontFamily="var(--font-geist-sans)"
          opacity="0.8"
        >
          {salci.grade}
        </text>
      </svg>
      <p className={`text-xs font-medium ${GRADE_COLORS[salci.grade]}`}>
        {GRADE_LABEL[salci.grade]}
      </p>
    </div>
  );
};

export default SalciGauge;
