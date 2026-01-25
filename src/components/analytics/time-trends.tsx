'use client';

import { useMemo } from 'react';
import type { FacebookAdResult } from '@/lib/facebook-api';

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

  const maxMonthlyAds = Math.max(...analysis.monthlyData.map(m => m.adsLaunched), 1);
  const maxWeeklyAds = Math.max(...analysis.weeklyData.map(w => w.count), 1);

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* Monthly Chart */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-[var(--text-secondary)]">Monthly Ad Launches</h4>
          <div className="text-xs text-[var(--text-muted)]">
            Total: <span className="font-medium text-[var(--text-primary)]">{analysis.monthlyData.reduce((sum, m) => sum + m.adsLaunched, 0)} ads</span>
          </div>
        </div>
        <div className="relative">
          {/* SVG Line Chart Overlay */}
          <svg
            className="absolute inset-0 w-full h-32 pointer-events-none"
            preserveAspectRatio="none"
            style={{ zIndex: 10 }}
          >
            <polyline
              fill="none"
              stroke="var(--accent-yellow)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={analysis.monthlyData.map((month, index) => {
                const x = ((index + 0.5) / analysis.monthlyData.length) * 100;
                const y = 100 - (month.adsLaunched / maxMonthlyAds) * 85 - 8;
                return `${x}%,${y}%`;
              }).join(' ')}
            />
            {/* Dots at each data point */}
            {analysis.monthlyData.map((month, index) => {
              const x = ((index + 0.5) / analysis.monthlyData.length) * 100;
              const y = 100 - (month.adsLaunched / maxMonthlyAds) * 85 - 8;
              return (
                <circle
                  key={month.month}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="4"
                  fill="var(--accent-yellow)"
                  stroke="var(--bg-primary)"
                  strokeWidth="2"
                />
              );
            })}
          </svg>

          {/* Bar Chart */}
          <div className="flex items-end gap-1 h-32">
            {analysis.monthlyData.map((month, index) => {
              const height = (month.adsLaunched / maxMonthlyAds) * 85;
              const isRecent = index >= analysis.monthlyData.length - 3;
              return (
                <div key={month.month} className="flex-1 flex flex-col items-center gap-1 relative">
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs font-medium text-[var(--accent-yellow)] tabular-nums bg-[var(--bg-primary)]/80 px-1 rounded">
                    {month.adsLaunched}
                  </div>
                  <div
                    className={`w-full rounded-t transition-all duration-500 ${
                      isRecent ? 'bg-[var(--accent-green)]' : 'bg-[var(--accent-green)]/40'
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${month.label}: ${month.adsLaunched} ads, ${formatNumber(month.totalReach)} reach`}
                  />
                  <div className="text-xs text-[var(--text-muted)] -rotate-45 origin-center whitespace-nowrap">
                    {month.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weekly Sparkline (Recent) */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Last 8 Weeks</h4>
        <div className="flex items-end gap-2 h-16">
          {analysis.weeklyData.map((week, index) => {
            const height = maxWeeklyAds > 0 ? (week.count / maxWeeklyAds) * 100 : 0;
            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-blue-500/60 transition-all duration-300"
                  style={{ height: `${Math.max(height, 4)}%` }}
                  title={`${week.week}: ${week.count} ads`}
                />
                <div className="text-xs text-[var(--text-muted)] truncate w-full text-center">
                  {week.count}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
          <span>{analysis.weeklyData[0]?.week}</span>
          <span>This week</span>
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
