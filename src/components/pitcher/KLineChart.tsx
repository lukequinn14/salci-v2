'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { SalciScore } from '@/types/salci';

interface KLineChartProps {
  salci: SalciScore;
  bookLine: number;
}

const KLineChart = ({ salci, bookLine }: KLineChartProps) => {
  const data = [
    { label: 'Floor', value: salci.floor, fill: '#52525b' },
    { label: 'Expected', value: Math.round(salci.expectedKs * 10) / 10, fill: '#34d399' },
    { label: 'Ceiling', value: salci.ceiling, fill: '#6ee7b7' },
  ];

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">K Projection</p>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#71717a' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, Math.max(salci.ceiling + 2, bookLine + 3)]}
            tick={{ fontSize: 10, fill: '#71717a' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#a1a1aa' }}
            itemStyle={{ color: '#34d399' }}
            cursor={{ fill: '#ffffff08' }}
          />
          <ReferenceLine
            y={bookLine}
            stroke="#f59e0b"
            strokeDasharray="4 3"
            label={{ value: `Line ${bookLine}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default KLineChart;
