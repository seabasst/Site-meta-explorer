'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { V2Card } from '@/app/dashboard/v2/v2-shell';
import { useV2 } from '@/app/dashboard/v2/v2-context';

const COLORS = ['#1235e2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function formatFormatLabel(format: string | null): string {
  if (!format) return 'Unknown';
  return format.charAt(0).toUpperCase() + format.slice(1);
}

interface FormatDistributionChartProps {
  data: { format: string; count: number }[];
}

export function FormatDistributionChart({ data }: FormatDistributionChartProps) {
  const { darkMode } = useV2();

  const chartData = data.map((d) => ({
    name: formatFormatLabel(d.format),
    value: d.count,
  }));

  return (
    <V2Card className="p-6">
      <h3 className="text-base font-bold mb-4">Format Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: darkMode ? '#1e293b' : '#fff',
              border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
              borderRadius: 8,
              color: darkMode ? '#e2e8f0' : '#1e293b',
            }}
          />
          <Legend
            wrapperStyle={{
              color: darkMode ? '#94a3b8' : '#64748b',
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </V2Card>
  );
}
