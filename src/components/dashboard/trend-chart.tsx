'use client';

import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TrackedBrand, TrendSnapshot } from '@/hooks/use-tracked-brands';

interface TrendChartProps {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
  trendSnapshots: TrendSnapshot[];
}

const COLORS = [
  'var(--accent-green-light)',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#6366f1',
  '#84cc16',
];

type MetricKey = 'totalReach' | 'activeAdsCount' | 'estimatedSpendUsd';

const METRIC_OPTIONS: { key: MetricKey; label: string; format: (v: number) => string }[] = [
  { key: 'totalReach', label: 'Total Reach', format: (v) => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v.toString() },
  { key: 'activeAdsCount', label: 'Active Ads', format: (v) => v.toLocaleString() },
  { key: 'estimatedSpendUsd', label: 'Est. Spend ($)', format: (v) => `$${Math.round(v).toLocaleString()}` },
];

export function TrendChart({ ownBrand, competitors, trendSnapshots }: TrendChartProps) {
  const [metric, setMetric] = useState<MetricKey>('totalReach');

  const allBrands = useMemo(() => {
    const brands: { id: string; name: string }[] = [];
    if (ownBrand) brands.push({ id: ownBrand.id, name: ownBrand.pageName });
    competitors.forEach(c => brands.push({ id: c.id, name: c.pageName }));
    return brands;
  }, [ownBrand, competitors]);

  const chartData = useMemo(() => {
    // Group snapshots by date
    const dateMap = new Map<string, Record<string, number>>();

    for (const snap of trendSnapshots) {
      const dateKey = new Date(snap.snapshotDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: 0 } as unknown as Record<string, number>);
      }
      const entry = dateMap.get(dateKey)!;
      const brand = allBrands.find(b => b.id === snap.trackedBrandId);
      if (brand) {
        entry[brand.name] = snap[metric];
      }
    }

    return Array.from(dateMap.entries()).map(([date, values]) => ({
      date,
      ...values,
    }));
  }, [trendSnapshots, allBrands, metric]);

  if (trendSnapshots.length === 0) {
    return null;
  }

  const currentMetric = METRIC_OPTIONS.find(m => m.key === metric)!;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Trends Over Time</h3>
        <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 border border-[var(--border-subtle)]">
          {METRIC_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setMetric(opt.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                metric === opt.key
                  ? 'bg-[var(--accent-green)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              stroke="var(--border-subtle)"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              stroke="var(--border-subtle)"
              tickFormatter={currentMetric.format}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => [currentMetric.format(Number(value)), '']}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {allBrands.map((brand, i) => (
              <Line
                key={brand.id}
                type="monotone"
                dataKey={brand.name}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
