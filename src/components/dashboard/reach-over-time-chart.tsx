'use client';

import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { DashboardCard } from './dashboard-card';
import type { TrackedBrand, TrendSnapshot } from '@/hooks/use-tracked-brands';

interface ReachOverTimeChartProps {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
  trendSnapshots: TrendSnapshot[];
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'ownBrand', label: 'Own Brand' },
  { key: 'competitors', label: 'Competitors' },
];

export function ReachOverTimeChart({
  ownBrand,
  competitors,
  trendSnapshots,
}: ReachOverTimeChartProps) {
  const [filter, setFilter] = useState('all');

  const chartData = useMemo(() => {
    // Get snapshots for the last 12 months
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Filter snapshots based on selected filter
    let filteredSnapshots = trendSnapshots;
    if (filter === 'ownBrand' && ownBrand) {
      filteredSnapshots = trendSnapshots.filter(s => s.trackedBrandId === ownBrand.id);
    } else if (filter === 'competitors') {
      const competitorIds = new Set(competitors.map(c => c.id));
      filteredSnapshots = trendSnapshots.filter(s => competitorIds.has(s.trackedBrandId));
    }

    // Group snapshots by month
    const monthMap = new Map<string, { reach: number; newReach: number }>();

    // Initialize all 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthMap.set(monthKey, { reach: 0, newReach: 0 });
    }

    // Aggregate reach by month
    let prevMonthReach = 0;
    for (const snap of filteredSnapshots) {
      const date = new Date(snap.snapshotDate);
      if (date < twelveMonthsAgo) continue;

      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const entry = monthMap.get(monthKey);
      if (entry) {
        entry.reach += snap.totalReach;
      }
    }

    // Calculate new reach (difference from previous month)
    const entries = Array.from(monthMap.entries());
    return entries.map(([month, data], index) => {
      const prevReach = index > 0 ? entries[index - 1][1].reach : 0;
      const newReach = Math.max(0, data.reach - prevReach);
      return {
        month,
        totalReach: data.reach,
        newReach: newReach,
        existingReach: Math.max(0, data.reach - newReach),
      };
    });
  }, [trendSnapshots, ownBrand, competitors, filter]);

  if (trendSnapshots.length === 0) {
    return null;
  }

  const formatReach = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <DashboardCard
      title="Reach Over Time"
      tooltip="Total audience reach aggregated by month over the last 12 months"
      filterTabs={FILTER_TABS}
      defaultTab="all"
      onTabChange={setFilter}
      rightContent={
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--chart-blue-light)' }} />
            <span className="text-[var(--text-muted)]">Cumulative Reach</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--chart-navy)' }} />
            <span className="text-[var(--text-muted)]">New Reach</span>
          </div>
        </div>
      }
    >
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={0}>
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatReach}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value, name) => [
                formatReach(Number(value) || 0),
                name === 'newReach' ? 'New Reach' : 'Existing Reach',
              ]}
              labelStyle={{ fontWeight: 600, marginBottom: 4 }}
            />
            <Bar
              dataKey="existingReach"
              stackId="reach"
              fill="var(--chart-blue-light)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="newReach"
              stackId="reach"
              fill="var(--chart-navy)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
