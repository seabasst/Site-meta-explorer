'use client';

import { useState, useEffect } from 'react';
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
import type { TooltipContentProps } from 'recharts/types/component/Tooltip';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

// ── Types ──────────────────────────────────────────────────────────────────

interface DemographicTrendChartProps {
  trackedBrandId: string;
}

interface AgeTrendPoint {
  timestamp: number;
  date: string;
  snapshotId: string;
  '13-17': number;
  '18-24': number;
  '25-34': number;
  '35-44': number;
  '45-54': number;
  '55-64': number;
  '65+': number;
}

interface GenderTrendPoint {
  timestamp: number;
  date: string;
  snapshotId: string;
  male: number;
  female: number;
  unknown: number;
}

interface CountryTrendPoint {
  timestamp: number;
  date: string;
  snapshotId: string;
  [countryCode: string]: number | string;
}

interface TrendsData {
  ageTrend: AgeTrendPoint[];
  genderTrend: GenderTrendPoint[];
  countryTrend: CountryTrendPoint[];
  snapshotCount: number;
}

type TabId = 'age' | 'gender' | 'country';

// ── Colors ─────────────────────────────────────────────────────────────────

const AGE_COLORS: Record<string, string> = {
  '13-17': '#94a3b8', // slate-400
  '18-24': '#a3e635', // lime-400
  '25-34': '#22c55e', // green-500
  '35-44': '#14b8a6', // teal-500
  '45-54': '#06b6d4', // cyan-500
  '55-64': '#8b5cf6', // violet-500
  '65+': '#f59e0b',   // amber-500
};

const GENDER_COLORS: Record<string, string> = {
  male: '#3b82f6',    // blue-500
  female: '#ec4899',  // pink-500
  unknown: '#6b7280', // gray-500
};

const COUNTRY_COLORS = [
  'var(--accent-green-light)',
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

// ── Shared chart config ────────────────────────────────────────────────────

const AXIS_TICK = { fill: 'var(--text-muted)', fontSize: 11 } as const;
const GRID_PROPS = { vertical: false, strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' } as const;
const CHART_MARGIN = { left: 0, right: 12, top: 20, bottom: 5 } as const;

// Date formatter for XAxis
const tickFormatter = (ts: number) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(new Date(ts));

// ── Tooltip ────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null;

  // Format the timestamp label
  const formattedLabel = typeof label === 'number'
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(label))
    : label;

  return (
    <div className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 shadow-md">
      <div className="font-medium text-[var(--text-primary)] mb-1 text-sm">{formattedLabel}</div>
      {payload.map((entry) => (
        <div key={String(entry.name)} className="flex items-center gap-2 text-xs">
          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: String(entry.color) }} />
          <span className="text-[var(--text-secondary)]">
            {entry.name}: {typeof entry.value === 'number' ? `${Math.round(entry.value)}%` : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function DemographicTrendChart({ trackedBrandId }: DemographicTrendChartProps) {
  const [activeTab, setActiveTab] = useState<TabId>('age');
  const [loading, setLoading] = useState(true);
  const [trendData, setTrendData] = useState<TrendsData | null>(null);

  useEffect(() => {
    async function fetchTrends() {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/trends?trackedBrandId=${trackedBrandId}`);
        if (res.ok) {
          const data = await res.json();
          setTrendData(data);
        }
      } catch {
        // Silently fail - trends are non-critical
      } finally {
        setLoading(false);
      }
    }

    if (trackedBrandId) {
      fetchTrends();
    }
  }, [trackedBrandId]);

  // Loading state
  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="h-4 w-40 bg-[var(--bg-tertiary)] rounded animate-pulse mb-4" />
        <div className="h-[300px] bg-[var(--bg-tertiary)] rounded animate-pulse" />
      </div>
    );
  }

  // Empty state: need at least 3 snapshots
  if (!trendData || trendData.snapshotCount < 3) {
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <p className="text-[var(--text-muted)] text-sm mb-2">
          Need at least 3 snapshots to show trends
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Re-analyze this brand over time to track demographic changes
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header with tab selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Demographic Trends</h3>
        <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 border border-[var(--border-subtle)]">
          {(['age', 'gender', 'country'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-[var(--accent-green)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab === 'age' ? 'Age' : tab === 'gender' ? 'Gender' : 'Country'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area */}
      <div className="h-[300px]">
        {activeTab === 'age' && <AgeTrendLineChart data={trendData.ageTrend} />}
        {activeTab === 'gender' && <GenderTrendLineChart data={trendData.genderTrend} />}
        {activeTab === 'country' && <CountryTrendLineChart data={trendData.countryTrend} />}
      </div>
    </div>
  );
}

// ── Age Trend Chart ────────────────────────────────────────────────────────

function AgeTrendLineChart({ data }: { data: AgeTrendPoint[] }) {
  const ageBrackets = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="timestamp"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={tickFormatter}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={35}
        />
        <Tooltip content={(props) => <ChartTooltip {...props} />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {ageBrackets.map((age) => (
          <Line
            key={age}
            dataKey={age}
            name={age}
            type="monotone"
            stroke={AGE_COLORS[age]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Gender Trend Chart ─────────────────────────────────────────────────────

function GenderTrendLineChart({ data }: { data: GenderTrendPoint[] }) {
  const genders = ['male', 'female', 'unknown'] as const;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="timestamp"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={tickFormatter}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={35}
        />
        <Tooltip content={(props) => <ChartTooltip {...props} />} />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        {genders.map((gender) => (
          <Line
            key={gender}
            dataKey={gender}
            name={gender.charAt(0).toUpperCase() + gender.slice(1)}
            type="monotone"
            stroke={GENDER_COLORS[gender]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Country Trend Chart ────────────────────────────────────────────────────

function CountryTrendLineChart({ data }: { data: CountryTrendPoint[] }) {
  // Extract country codes (exclude metadata keys)
  const excludeKeys = new Set(['timestamp', 'date', 'snapshotId']);
  const countries: string[] = [];

  if (data.length > 0) {
    for (const key of Object.keys(data[0])) {
      if (!excludeKeys.has(key)) {
        countries.push(key);
      }
    }
  }

  if (countries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
        No country data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="timestamp"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={tickFormatter}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={35}
        />
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
  );
}
