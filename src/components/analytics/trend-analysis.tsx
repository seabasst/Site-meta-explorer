'use client';

import { useState, useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { FacebookAdResult } from '@/lib/facebook-api';
import {
  groupAdsByPeriod,
  computeCountryReachTrends,
  computeMediaMixTrends,
  computeCreativeVelocity,
  computeReachTrajectory,
  detectTrend,
  formatReach,
  type PeriodMode,
} from '@/lib/trend-utils';

// ── Colors ──────────────────────────────────────────────────────────────

const COUNTRY_COLORS = [
  'var(--accent-green-light)',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
];

const MEDIA_COLORS = {
  video: '#c084fc',   // purple-400
  image: '#60a5fa',   // blue-400
  carousel: '#fbbf24', // amber-400
};

// ── Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 shadow-md">
      <div className="font-medium text-[var(--text-primary)] mb-1 text-sm">{label}</div>
      {payload.map((entry) => (
        <div key={String(entry.name)} className="flex items-center gap-2 text-xs">
          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: String(entry.color) }} />
          <span className="text-[var(--text-secondary)]">
            {entry.name}: {typeof entry.value === 'number' && entry.value >= 1000 ? formatReach(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function MediaTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 shadow-md">
      <div className="font-medium text-[var(--text-primary)] mb-1 text-sm">{label}</div>
      {payload.map((entry) => (
        <div key={String(entry.name)} className="flex items-center gap-2 text-xs">
          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: String(entry.color) }} />
          <span className="text-[var(--text-secondary)] capitalize">
            {entry.name}: {entry.value}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Tab types ────────────────────────────────────────────────────────────

type TabId = 'country' | 'velocity' | 'mediamix' | 'reach';

const TABS: { id: TabId; label: string }[] = [
  { id: 'country', label: 'Country Reach' },
  { id: 'velocity', label: 'Creative Velocity' },
  { id: 'mediamix', label: 'Media Mix' },
  { id: 'reach', label: 'Reach Trajectory' },
];

// ── Shared chart props ──────────────────────────────────────────────────

const AXIS_TICK = { fill: '#888', fontSize: 11 } as const;
const GRID_PROPS = { vertical: false, strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' } as const;
const CHART_MARGIN = { left: 0, right: 12, top: 20, bottom: 5 } as const;

// ── Main component ──────────────────────────────────────────────────────

interface TrendAnalysisProps {
  ads: FacebookAdResult[];
}

export function TrendAnalysis({ ads }: TrendAnalysisProps) {
  const [activeTab, setActiveTab] = useState<TabId>('velocity');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('monthly');

  // Group once, derive all datasets
  const groups = useMemo(() => groupAdsByPeriod(ads, periodMode), [ads, periodMode]);
  const trendInfo = useMemo(() => detectTrend(groups), [groups]);
  const countryData = useMemo(() => computeCountryReachTrends(groups), [groups]);
  const mediaMix = useMemo(() => computeMediaMixTrends(groups), [groups]);
  const velocity = useMemo(() => computeCreativeVelocity(groups), [groups]);
  const trajectory = useMemo(() => computeReachTrajectory(groups), [groups]);

  // Debug: log grouping details
  console.log('[TrendAnalysis]', {
    totalAds: ads.length,
    adsWithDates: ads.filter(a => a.startedRunning).length,
    periodMode,
    groups: groups.map(g => ({ key: g.key, label: g.label, count: g.ads.length })),
    uniqueAdIds: new Set(ads.map(a => a.adArchiveId)).size,
  });

  if (groups.length === 0) {
    return (
      <div className="text-center py-6 text-[var(--text-muted)]">
        No ads with start date information available.
      </div>
    );
  }

  const dateRange = {
    start: new Date(Math.min(...ads.filter(a => a.startedRunning).map(a => new Date(a.startedRunning!).getTime()))),
    end: new Date(Math.max(...ads.filter(a => a.startedRunning).map(a => new Date(a.startedRunning!).getTime()))),
  };
  const totalAdsWithDates = ads.filter(a => a.startedRunning).length;

  return (
    <div className="space-y-6">
      {/* Trend Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Ad Activity Trend</div>
          <div className={`text-lg font-bold flex items-center gap-2 ${
            trendInfo.trend === 'scaling' ? 'text-emerald-400' :
            trendInfo.trend === 'declining' ? 'text-red-400' : 'text-[var(--text-primary)]'
          }`}>
            {trendInfo.trend === 'scaling' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            )}
            {trendInfo.trend === 'declining' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            )}
            {trendInfo.trend === 'stable' && (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
              </svg>
            )}
            <span className="capitalize">{trendInfo.trend}</span>
            {trendInfo.trendPercent !== 0 && (
              <span className="text-sm font-normal">
                ({trendInfo.trendPercent > 0 ? '+' : ''}{trendInfo.trendPercent.toFixed(0)}%)
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">vs. previous 3 {periodMode === 'monthly' ? 'months' : 'weeks'}</div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Peak Activity</div>
          <div className="text-lg font-bold text-[var(--accent-yellow)]">
            {trendInfo.peakLabel}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {trendInfo.peakCount} ads launched
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Data Range</div>
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {dateRange.start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            {' - '}
            {dateRange.end.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {totalAdsWithDates} ads with dates
          </div>
        </div>
      </div>

      {/* Tabs + Period Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--accent-green)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-0.5 border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setPeriodMode('monthly')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              periodMode === 'monthly'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPeriodMode('weekly')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              periodMode === 'weekly'
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        {activeTab === 'country' && <CountryReachChart data={countryData.data} countries={countryData.countries} />}
        {activeTab === 'velocity' && <CreativeVelocityChart data={velocity} />}
        {activeTab === 'mediamix' && <MediaMixChart data={mediaMix} />}
        {activeTab === 'reach' && <ReachTrajectoryChart data={trajectory} />}
      </div>
    </div>
  );
}

// ── Country Reach Chart ─────────────────────────────────────────────────

function CountryReachChart({ data, countries }: { data: ReturnType<typeof computeCountryReachTrends>['data']; countries: string[] }) {
  if (countries.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--text-muted)] text-sm">
        No demographic data available for country trends.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[var(--text-secondary)]">Reach by Top Countries</h4>
        <div className="text-xs text-[var(--text-muted)]">Estimated reach per period</div>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} width={45} tickFormatter={(v: number) => formatReach(v)} />
            <Tooltip content={(props) => <ChartTooltip {...props} />} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            {countries.map((country, i) => (
              <Line
                key={country}
                dataKey={country}
                name={country}
                type="monotone"
                stroke={COUNTRY_COLORS[i % COUNTRY_COLORS.length]}
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

// ── Creative Velocity Chart ─────────────────────────────────────────────

function CreativeVelocityChart({ data }: { data: ReturnType<typeof computeCreativeVelocity> }) {
  const totalAds = data.reduce((s, d) => s + d.adsLaunched, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[var(--text-secondary)]">Ads Launched Per Period</h4>
        <div className="text-xs text-[var(--text-muted)]">
          Total: <span className="font-medium text-[var(--text-primary)]">{totalAds} ads</span>
        </div>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} width={30} allowDecimals={false} />
            <Tooltip content={(props) => <ChartTooltip {...props} />} />
            <Line
              dataKey="adsLaunched"
              name="Ads launched"
              type="monotone"
              stroke="#a3e635"
              strokeWidth={2.5}
              dot={{ fill: '#a3e635', stroke: '#1c1c0d', strokeWidth: 2, r: 5 }}
              activeDot={{ r: 7, fill: '#a3e635', stroke: '#1c1c0d', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Media Mix Chart ─────────────────────────────────────────────────────

function MediaMixChart({ data }: { data: ReturnType<typeof computeMediaMixTrends> }) {
  const hasAnyData = data.some(d => d.video > 0 || d.image > 0 || d.carousel > 0);
  if (!hasAnyData) {
    return (
      <div className="text-center py-10 text-[var(--text-muted)] text-sm">
        No media type data available.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[var(--text-secondary)]">Media Format Mix</h4>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MEDIA_COLORS.video }} />Video</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MEDIA_COLORS.image }} />Image</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MEDIA_COLORS.carousel }} />Carousel</span>
        </div>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} width={35} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip content={(props) => <MediaTooltip {...props} />} />
            <Bar dataKey="video" name="video" stackId="mix" fill={MEDIA_COLORS.video} radius={[0, 0, 0, 0]} />
            <Bar dataKey="image" name="image" stackId="mix" fill={MEDIA_COLORS.image} radius={[0, 0, 0, 0]} />
            <Bar dataKey="carousel" name="carousel" stackId="mix" fill={MEDIA_COLORS.carousel} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Reach Trajectory Chart ──────────────────────────────────────────────

function ReachTrajectoryChart({ data }: { data: ReturnType<typeof computeReachTrajectory> }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[var(--text-secondary)]">Total Reach Over Time</h4>
        <div className="text-xs text-[var(--text-muted)]">EU estimated reach per period</div>
      </div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={AXIS_TICK} width={45} tickFormatter={(v: number) => formatReach(v)} />
            <Tooltip content={(props) => <ChartTooltip {...props} />} />
            <Line
              dataKey="totalReach"
              name="Total reach"
              type="monotone"
              stroke="var(--accent-green-light)"
              strokeWidth={2.5}
              dot={{ fill: 'var(--accent-green-light)', stroke: 'var(--bg-primary)', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: 'var(--accent-green-light)', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
