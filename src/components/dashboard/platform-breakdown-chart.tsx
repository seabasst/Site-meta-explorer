'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { V2Card } from '@/app/dashboard/v2/v2-shell';
import { useV2 } from '@/app/dashboard/v2/v2-context';

interface PlatformBreakdownChartProps {
  data: { platform: string; count: number }[];
}

function formatPlatformName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PlatformBreakdownChart({ data }: PlatformBreakdownChartProps) {
  const { darkMode } = useV2();

  const chartData = data.map((d) => ({
    platform: formatPlatformName(d.platform),
    count: d.count,
  }));

  return (
    <V2Card className="p-6">
      <h3 className="text-base font-bold mb-4">Platform Breakdown</h3>
      <ResponsiveContainer
        width="100%"
        height={Math.max(200, chartData.length * 40)}
      >
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={darkMode ? '#1e293b' : '#e2e8f0'}
          />
          <XAxis
            type="number"
            stroke={darkMode ? '#64748b' : '#94a3b8'}
            fontSize={12}
          />
          <YAxis
            type="category"
            dataKey="platform"
            width={120}
            stroke={darkMode ? '#64748b' : '#94a3b8'}
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: darkMode ? '#1e293b' : '#fff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 8,
              color: darkMode ? '#e2e8f0' : '#1e293b',
            }}
          />
          <Bar dataKey="count" fill="#1235e2" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </V2Card>
  );
}
