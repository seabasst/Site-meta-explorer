'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { MediaTypeBreakdown } from '@/lib/facebook-api';

function MediaTypeTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 shadow-md">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: data.color }} />
        <span className="font-medium text-[var(--text-primary)]">{data.name}</span>
      </div>
      <div className="text-sm text-[var(--text-secondary)]">
        {data.count} ads ({data.percentage.toFixed(1)}%)
      </div>
    </div>
  );
}

interface MediaTypeChartProps {
  data: MediaTypeBreakdown;
}

export function MediaTypeChart({ data }: MediaTypeChartProps) {
  if (!data || (data.video === 0 && data.image === 0)) {
    return (
      <div className="w-full h-[200px] flex items-center justify-center">
        <p className="text-[var(--text-muted)]">No media type data available</p>
      </div>
    );
  }

  const chartData = [
    {
      name: 'Video',
      count: data.video,
      percentage: data.videoPercentage,
      color: '#8b5cf6' // purple
    },
    {
      name: 'Image',
      count: data.image,
      percentage: data.imagePercentage,
      color: '#3b82f6' // blue
    },
  ];

  // Only add unknown if there are any
  if (data.unknown > 0) {
    chartData.push({
      name: 'Unknown',
      count: data.unknown,
      percentage: (data.unknown / (data.video + data.image + data.unknown)) * 100,
      color: '#6b7280' // gray
    });
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Video Ads</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">{data.video}</span>
            <span className="text-sm text-[var(--text-muted)]">({data.videoPercentage.toFixed(1)}%)</span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Image Ads</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[var(--text-primary)]">{data.image}</span>
            <span className="text-sm text-[var(--text-muted)]">({data.imagePercentage.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="w-full h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={60} />
            <Tooltip content={(props) => <MediaTypeTooltip {...props} />} />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
