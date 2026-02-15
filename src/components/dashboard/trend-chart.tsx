'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DashboardCard } from './dashboard-card';
import type { TrackedBrand, TrendSnapshot } from '@/hooks/use-tracked-brands';

interface TrendChartProps {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
  trendSnapshots: TrendSnapshot[];
}

export function TrendChart({ ownBrand, competitors, trendSnapshots }: TrendChartProps) {
  const chartData = useMemo(() => {
    // Group snapshots by month - only months that have data
    const monthMap = new Map<string, {
      month: string;
      timestamp: number;
      totalReach: number;
      activeAds: number;
      snapshotCount: number;
    }>();

    for (const snap of trendSnapshots) {
      const snapDate = new Date(snap.snapshotDate);
      const monthKey = `${snapDate.getFullYear()}-${String(snapDate.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = snapDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthLabel,
          timestamp: snapDate.getTime(),
          totalReach: 0,
          activeAds: 0,
          snapshotCount: 0,
        });
      }

      const entry = monthMap.get(monthKey)!;
      entry.totalReach += snap.totalReach;
      entry.activeAds += snap.activeAdsCount;
      entry.snapshotCount += 1;
    }

    // Convert to array, sort by date, take last 6 months with data
    return Array.from(monthMap.values())
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-6)
      .map(({ month, totalReach, activeAds, snapshotCount }) => ({
        month,
        totalReach,
        activeAds: snapshotCount > 0 ? Math.round(activeAds / snapshotCount) : 0,
      }));
  }, [trendSnapshots]);

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
      title="Trends Over Time"
      tooltip="Monthly reach and active ads across all tracked brands (last 6 months)"
      rightContent={
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--chart-blue)' }} />
            <span className="text-[var(--text-muted)]">Total Reach</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--chart-navy)' }} />
            <span className="text-[var(--text-muted)]">Active Ads</span>
          </div>
        </div>
      }
    >
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
            />
            <YAxis
              yAxisId="reach"
              orientation="left"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatReach}
            />
            <YAxis
              yAxisId="ads"
              orientation="right"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value, name) => {
                if (name === 'totalReach') return [formatReach(Number(value)), 'Total Reach'];
                return [Number(value).toLocaleString(), 'Active Ads'];
              }}
            />
            <Bar
              yAxisId="reach"
              dataKey="totalReach"
              fill="var(--chart-blue)"
              radius={[4, 4, 0, 0]}
              name="totalReach"
            />
            <Bar
              yAxisId="ads"
              dataKey="activeAds"
              fill="var(--chart-navy)"
              radius={[4, 4, 0, 0]}
              name="activeAds"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardCard>
  );
}
