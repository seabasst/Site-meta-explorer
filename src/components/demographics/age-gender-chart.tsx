'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface AgeGenderChartProps {
  data: { age: string; gender: string; percentage: number }[];
}

export function AgeGenderChart({ data }: AgeGenderChartProps) {
  // Guard against empty data
  if (!data?.length) {
    return (
      <div style={{ width: '100%', height: 300 }} className="flex items-center justify-center">
        <p className="text-[var(--text-muted)]">No age/gender data available</p>
      </div>
    );
  }

  // Transform to grouped format for stacked bar chart
  const groupedData = data.reduce((acc, item) => {
    const existing = acc.find(d => d.age === item.age);
    if (existing) {
      existing[item.gender] = item.percentage;
    } else {
      acc.push({ age: item.age, [item.gender]: item.percentage });
    }
    return acc;
  }, [] as Record<string, number | string>[]);

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={groupedData}>
          <XAxis dataKey="age" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 'auto']} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
          <Legend />
          <Bar dataKey="female" fill="#ec4899" name="Female" stackId="stack" />
          <Bar dataKey="male" fill="#3b82f6" name="Male" stackId="stack" />
          <Bar dataKey="unknown" fill="#6b7280" name="Unknown" stackId="stack" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
