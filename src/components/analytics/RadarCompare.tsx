'use client';

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import type { Pitcher } from '@/types/pitcher';

const COLORS = ['#34d399', '#38bdf8', '#a78bfa', '#fb923c'];

interface RadarCompareProps {
  pitchers: Pitcher[];
}

const AXES: { key: keyof Pitcher['salci']; label: string }[] = [
  { key: 'stuff',    label: 'Stuff' },
  { key: 'matchup',  label: 'Matchup' },
  { key: 'workload', label: 'Workload' },
  { key: 'location', label: 'Location' },
];

const RadarCompare = ({ pitchers }: RadarCompareProps) => {
  const data = AXES.map(({ key, label }) => {
    const entry: Record<string, string | number> = { axis: label };
    for (const p of pitchers) {
      entry[p.name] = Math.round(p.salci[key] as number);
    }
    return entry;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#27272a" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 12, fill: '#a1a1aa', fontWeight: 500 }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
        />
        {pitchers.map((pitcher, i) => (
          <Radar
            key={pitcher.id}
            name={`${pitcher.name} (${pitcher.team})`}
            dataKey={pitcher.name}
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(value: string) => (
            <span style={{ color: '#a1a1aa' }}>{value}</span>
          )}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};

export default RadarCompare;
