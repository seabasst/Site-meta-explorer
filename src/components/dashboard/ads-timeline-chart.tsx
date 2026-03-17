'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { V2Card } from '@/app/dashboard/v2/v2-shell';
import { useV2 } from '@/app/dashboard/v2/v2-context';

interface AdsTimelineChartProps {
  data: { date: string; count: number; activeCount: number }[];
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AdsTimelineChart({ data }: AdsTimelineChartProps) {
  const { darkMode } = useV2();

  return (
    <V2Card className="p-6">
      <h3 className="text-base font-bold mb-4">Ad Activity Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={darkMode ? '#1e293b' : '#e2e8f0'}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            stroke={darkMode ? '#64748b' : '#94a3b8'}
            fontSize={12}
          />
          <YAxis
            stroke={darkMode ? '#64748b' : '#94a3b8'}
            fontSize={12}
          />
          <Tooltip
            labelFormatter={formatDateLabel}
            contentStyle={{
              backgroundColor: darkMode ? '#1e293b' : '#fff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 8,
              color: darkMode ? '#e2e8f0' : '#1e293b',
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Total Ads"
            stroke="#1235e2"
            fill="#1235e2"
            fillOpacity={0.1}
          />
          <Area
            type="monotone"
            dataKey="activeCount"
            name="Active Ads"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </V2Card>
  );
}
