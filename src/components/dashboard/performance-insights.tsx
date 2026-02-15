'use client';

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { DashboardCard } from './dashboard-card';
import { TrendingUp, Clock, Target } from 'lucide-react';
import type { TrackedBrand } from '@/hooks/use-tracked-brands';

interface PerformanceInsightsProps {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
}

export function PerformanceInsights({ ownBrand, competitors }: PerformanceInsightsProps) {
  const data = useMemo(() => {
    const brands: { name: string; avgAdAge: number; avgReachPerAd: number; isOwn: boolean }[] = [];

    if (ownBrand?.snapshots[0]) {
      brands.push({
        name: ownBrand.pageName.length > 15 ? ownBrand.pageName.slice(0, 15) + '...' : ownBrand.pageName,
        avgAdAge: ownBrand.snapshots[0].avgAdAgeDays,
        avgReachPerAd: ownBrand.snapshots[0].avgReachPerAd,
        isOwn: true,
      });
    }

    for (const comp of competitors) {
      if (comp.snapshots[0]) {
        brands.push({
          name: comp.pageName.length > 15 ? comp.pageName.slice(0, 15) + '...' : comp.pageName,
          avgAdAge: comp.snapshots[0].avgAdAgeDays,
          avgReachPerAd: comp.snapshots[0].avgReachPerAd,
          isOwn: false,
        });
      }
    }

    // Sort by avgAdAge descending (longer running = likely better performing)
    const sortedByAge = [...brands].sort((a, b) => b.avgAdAge - a.avgAdAge);
    const sortedByEfficiency = [...brands].sort((a, b) => b.avgReachPerAd - a.avgReachPerAd);

    // Calculate averages
    const avgAge = brands.length > 0 ? brands.reduce((sum, b) => sum + b.avgAdAge, 0) / brands.length : 0;
    const avgEfficiency = brands.length > 0 ? brands.reduce((sum, b) => sum + b.avgReachPerAd, 0) / brands.length : 0;

    return {
      brands,
      sortedByAge: sortedByAge.slice(0, 5),
      sortedByEfficiency: sortedByEfficiency.slice(0, 5),
      avgAge: Math.round(avgAge),
      avgEfficiency,
      topPerformer: sortedByAge[0],
      mostEfficient: sortedByEfficiency[0],
    };
  }, [ownBrand, competitors]);

  if (data.brands.length === 0) {
    return null;
  }

  const formatReach = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(0);
  };

  return (
    <DashboardCard
      title="Performance Signals"
      tooltip="Longer-running ads likely perform better. Higher reach per ad indicates creative efficiency."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ad Longevity Chart */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-[var(--chart-navy)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Ad Longevity</span>
            <span className="text-xs text-[var(--text-muted)]">(avg days running)</span>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sortedByAge} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value) => [`${Math.round(Number(value) || 0)} days`, 'Avg Ad Age']}
                />
                <Bar dataKey="avgAdAge" radius={[0, 4, 4, 0]}>
                  {data.sortedByAge.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isOwn ? 'var(--accent-green)' : 'var(--chart-blue)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            <strong>{data.topPerformer?.name}</strong> has the longest-running ads ({Math.round(data.topPerformer?.avgAdAge || 0)} days avg).
            Study their creatives for potential winners.
          </p>
        </div>

        {/* Reach Efficiency Chart */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-[var(--chart-blue)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">Reach Efficiency</span>
            <span className="text-xs text-[var(--text-muted)]">(avg reach per ad)</span>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sortedByEfficiency} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatReach}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  }}
                  formatter={(value) => [formatReach(Number(value) || 0), 'Avg Reach/Ad']}
                />
                <Bar dataKey="avgReachPerAd" radius={[0, 4, 4, 0]}>
                  {data.sortedByEfficiency.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isOwn ? 'var(--accent-green)' : 'var(--chart-navy)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            <strong>{data.mostEfficient?.name}</strong> achieves {formatReach(data.mostEfficient?.avgReachPerAd || 0)} reach per ad.
            This indicates strong creative-audience fit.
          </p>
        </div>
      </div>

      {/* Key Insights Summary */}
      <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--chart-navy)]15 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[var(--chart-navy)]" />
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)]">Industry Avg Ad Age</div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{data.avgAge} days</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--chart-blue)]15 flex items-center justify-center">
            <Target className="w-5 h-5 text-[var(--chart-blue)]" />
          </div>
          <div>
            <div className="text-xs text-[var(--text-muted)]">Avg Reach Per Ad</div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">{formatReach(data.avgEfficiency)}</div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
