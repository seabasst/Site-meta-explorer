'use client';

import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { FacebookAdResult } from '@/lib/facebook-api';

function WeeklyTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  const count = payload[0].value;

  return (
    <div className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 shadow-md">
      <div className="font-medium text-[var(--text-primary)] mb-1">{label}</div>
      <div className="flex items-center gap-2 text-sm">
        <div className="h-2.5 w-2.5 rounded-full bg-lime-400" />
        <span className="text-[var(--text-secondary)]">{count} ads launched</span>
      </div>
    </div>
  );
}

interface TimeTrendsProps {
  ads: FacebookAdResult[];
}

interface MonthData {
  month: string;
  label: string;
  adsLaunched: number;
  totalReach: number;
  avgReachPerAd: number;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function TimeTrends({ ads }: TimeTrendsProps) {
  const analysis = useMemo(() => {
    // Filter ads with start dates
    const adsWithDates = ads.filter(ad => ad.startedRunning);

    if (adsWithDates.length === 0) {
      return null;
    }

    // Group by month
    const monthMap = new Map<string, { ads: FacebookAdResult[]; reach: number }>();

    for (const ad of adsWithDates) {
      const date = new Date(ad.startedRunning!);
      const monthKey = getMonthKey(date);

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { ads: [], reach: 0 });
      }

      const monthData = monthMap.get(monthKey)!;
      monthData.ads.push(ad);
      monthData.reach += ad.euTotalReach;
    }

    // Convert to sorted array (last 12 months)
    const sortedMonths = Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12);

    const monthlyData: MonthData[] = sortedMonths.map(([month, data]) => ({
      month,
      label: getMonthLabel(month),
      adsLaunched: data.ads.length,
      totalReach: data.reach,
      avgReachPerAd: data.ads.length > 0 ? Math.round(data.reach / data.ads.length) : 0,
    }));

    // Calculate trends
    const recentMonths = monthlyData.slice(-3);
    const olderMonths = monthlyData.slice(-6, -3);

    const recentAvg = recentMonths.length > 0
      ? recentMonths.reduce((sum, m) => sum + m.adsLaunched, 0) / recentMonths.length
      : 0;
    const olderAvg = olderMonths.length > 0
      ? olderMonths.reduce((sum, m) => sum + m.adsLaunched, 0) / olderMonths.length
      : 0;

    let trend: 'scaling' | 'stable' | 'declining' = 'stable';
    let trendPercent = 0;

    if (olderAvg > 0) {
      trendPercent = ((recentAvg - olderAvg) / olderAvg) * 100;
      if (trendPercent > 20) trend = 'scaling';
      else if (trendPercent < -20) trend = 'declining';
    }

    // Find peak month
    const peakMonth = monthlyData.reduce((max, m) =>
      m.adsLaunched > max.adsLaunched ? m : max, monthlyData[0] || { month: '', label: '', adsLaunched: 0, totalReach: 0, avgReachPerAd: 0 });

    // Calculate weekly data for recent 8 weeks
    const now = new Date();
    const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

    const weeklyData: { week: string; count: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const weekStart = new Date(eightWeeksAgo.getTime() + i * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const weekAds = adsWithDates.filter(ad => {
        const adDate = new Date(ad.startedRunning!);
        return adDate >= weekStart && adDate < weekEnd;
      });

      weeklyData.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: weekAds.length,
      });
    }

    return {
      monthlyData,
      weeklyData,
      trend,
      trendPercent,
      peakMonth,
      totalAdsWithDates: adsWithDates.length,
      dateRange: {
        start: new Date(Math.min(...adsWithDates.map(a => new Date(a.startedRunning!).getTime()))),
        end: new Date(Math.max(...adsWithDates.map(a => new Date(a.startedRunning!).getTime()))),
      },
    };
  }, [ads]);

  if (!analysis) {
    return (
      <div className="text-center py-6 text-[var(--text-muted)]">
        No ads with start date information available.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Ad Activity Trend</div>
          <div className={`text-lg font-bold flex items-center gap-2 ${
            analysis.trend === 'scaling' ? 'text-emerald-400' :
            analysis.trend === 'declining' ? 'text-red-400' : 'text-[var(--text-primary)]'
          }`}>
            {analysis.trend === 'scaling' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
            {analysis.trend === 'declining' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            )}
            {analysis.trend === 'stable' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              </svg>
            )}
            <span className="capitalize">{analysis.trend}</span>
            {analysis.trendPercent !== 0 && (
              <span className="text-sm font-normal">
                ({analysis.trendPercent > 0 ? '+' : ''}{analysis.trendPercent.toFixed(0)}%)
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">vs. previous 3 months</div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Peak Activity</div>
          <div className="text-lg font-bold text-[var(--accent-yellow)]">
            {analysis.peakMonth.label}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {analysis.peakMonth.adsLaunched} ads launched
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Data Range</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {analysis.dateRange.start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            {' - '}
            {analysis.dateRange.end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {analysis.totalAdsWithDates} ads with dates
          </div>
        </div>
      </div>

      {/* Weekly Line Chart - Primary Visualization */}
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-[var(--text-secondary)]">New Ads Per Week</h4>
          <div className="text-xs text-[var(--text-muted)]">
            Last 8 weeks: <span className="font-medium text-[var(--text-primary)]">{analysis.weeklyData.reduce((sum, w) => sum + w.count, 0)} ads</span>
          </div>
        </div>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={analysis.weeklyData}
              margin={{
                left: 0,
                right: 12,
                top: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="week"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: '#888', fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: '#888', fontSize: 11 }}
                allowDecimals={false}
                width={30}
              />
              <Tooltip content={(props) => <WeeklyTooltip {...props} />} />
              <Line
                dataKey="count"
                type="monotone"
                stroke="#a3e635"
                strokeWidth={2.5}
                dot={{
                  fill: "#a3e635",
                  stroke: "#1c1c0d",
                  strokeWidth: 2,
                  r: 5,
                }}
                activeDot={{
                  r: 7,
                  fill: "#a3e635",
                  stroke: "#1c1c0d",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-2 px-2">
          <span>8 weeks ago</span>
          <span className="text-lime-400 font-medium">This week</span>
        </div>
      </div>

      {/* Monthly Details Table */}
      {analysis.monthlyData.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            View monthly breakdown
          </summary>
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-tertiary)]">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-muted)]">Month</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Ads Launched</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Total Reach</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-[var(--text-muted)]">Avg Reach/Ad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {[...analysis.monthlyData].reverse().map(month => (
                  <tr key={month.month} className="hover:bg-[var(--bg-tertiary)]">
                    <td className="px-4 py-2 text-[var(--text-primary)]">{month.label}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{month.adsLaunched}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatNumber(month.totalReach)}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-secondary)]">{formatNumber(month.avgReachPerAd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
