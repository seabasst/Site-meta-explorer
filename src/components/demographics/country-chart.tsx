'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

const COLORS = ['#1a3933', '#2d5a4f', '#3d7a6f', '#4d9a8f', '#5dbaa0', '#6ddab0'];

interface CountryChartProps {
  data: { region: string; percentage: number }[];
}

export function CountryChart({ data }: CountryChartProps) {
  // Guard against empty data
  if (!data?.length) {
    return (
      <div style={{ width: '100%', height: 300 }} className="flex items-center justify-center">
        <p className="text-[var(--text-muted)]">No geographic data available</p>
      </div>
    );
  }

  // Take top 5 countries, group rest as "Other"
  const sortedData = [...data].sort((a, b) => b.percentage - a.percentage);
  const topCountries = sortedData.slice(0, 5);
  const otherPercentage = sortedData.slice(5).reduce((sum, c) => sum + c.percentage, 0);

  const chartData = [
    ...topCountries.map(c => ({ name: c.region, value: c.percentage })),
    ...(otherPercentage > 0 ? [{ name: 'Other', value: otherPercentage }] : [])
  ];

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
          >
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
