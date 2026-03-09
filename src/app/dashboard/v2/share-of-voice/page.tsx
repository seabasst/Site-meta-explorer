'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  BarChart3,
  Layers,
  ChevronRight,
  ArrowLeft,
  PieChart,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

interface Category {
  slug: string;
  label: string;
  brandCount: number;
  totalActiveAds: number;
}

interface SovData {
  category: string;
  metric: string;
  weeks: number;
  brands: string[];
  timeline: Record<string, string | number>[];
  timelinePercentage: Record<string, string | number>[];
  latestTotal: number;
}

type Metric = 'activeAds' | 'totalReach' | 'estSpend' | 'newAds';
type ViewMode = 'absolute' | 'percentage';

const METRIC_LABELS: Record<Metric, string> = {
  activeAds: 'Active Ads',
  totalReach: 'Total Reach',
  estSpend: 'Est. Spend',
  newAds: 'New Ads/Week',
};

const BRAND_COLORS = [
  '#1235e2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
];

export default function ShareOfVoicePage() {
  const { darkMode } = useV2();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sovData, setSovData] = useState<SovData | null>(null);
  const [sovLoading, setSovLoading] = useState(false);
  const [metric, setMetric] = useState<Metric>('activeAds');
  const [viewMode, setViewMode] = useState<ViewMode>('percentage');
  const [weeksRange, setWeeksRange] = useState(12);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchSov = useCallback(async (category: string, m: Metric, weeks: number) => {
    setSovLoading(true);
    try {
      const res = await fetch(`/api/sov/${category}?metric=${m}&weeks=${weeks}`);
      if (res.ok) {
        const data = await res.json();
        setSovData(data);
      }
    } catch (err) {
      console.error('Failed to fetch SoV:', err);
    }
    setSovLoading(false);
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      fetchSov(selectedCategory, metric, weeksRange);
    }
  }, [selectedCategory, metric, weeksRange, fetchSov]);

  const selectCategory = (slug: string) => {
    setSelectedCategory(slug);
  };

  // Format week labels
  const formatWeek = (week: string) => {
    const d = new Date(week);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const textColor = darkMode ? '#94a3b8' : '#64748b';
  const gridColor = darkMode ? 'rgba(18, 53, 226, 0.1)' : 'rgba(0, 0, 0, 0.06)';

  // Latest week breakdown for the donut-like summary
  const latestWeek = sovData
    ? viewMode === 'percentage'
      ? sovData.timelinePercentage[sovData.timelinePercentage.length - 1]
      : sovData.timeline[sovData.timeline.length - 1]
    : null;

  return (
    <V2Shell title="Share of Voice">
      {!selectedCategory ? (
        <>
          {/* Category selection */}
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-[#1235e2]/10 flex items-center justify-center mx-auto mb-4">
              <PieChart className="w-7 h-7 text-[#1235e2]" />
            </div>
            <h2 className="text-2xl font-black mb-2">Share of Voice</h2>
            <p className={`max-w-lg mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Track how brands compete for attention over time. See who&apos;s growing, who&apos;s declining, and spot market shifts early.
            </p>
          </div>

          {loading ? (
            <V2Skeleton rows={2} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <button key={cat.slug} onClick={() => selectCategory(cat.slug)} className="text-left">
                  <V2Card className="p-5 hover:shadow-lg transition-all group cursor-pointer h-full">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold mb-1">{cat.label}</h3>
                        <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {cat.brandCount} brands &middot; {formatNumber(cat.totalActiveAds)} active ads
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${
                        darkMode ? 'text-slate-600' : 'text-slate-300'
                      }`} />
                    </div>
                  </V2Card>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Back button */}
          <button
            onClick={() => { setSelectedCategory(''); setSovData(null); }}
            className={`inline-flex items-center gap-1.5 text-sm mb-6 transition-colors ${
              darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            All Categories
          </button>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-8">
            {/* Metric selector */}
            <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
              {(Object.entries(METRIC_LABELS) as [Metric, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setMetric(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    metric === key
                      ? darkMode
                        ? 'bg-[#1235e2] text-white shadow-sm font-semibold'
                        : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                      : darkMode
                        ? 'text-slate-400'
                        : 'text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* View mode */}
            <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
              {([
                { key: 'percentage' as ViewMode, label: '% Share' },
                { key: 'absolute' as ViewMode, label: 'Absolute' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    viewMode === key
                      ? darkMode
                        ? 'bg-[#1235e2] text-white shadow-sm font-semibold'
                        : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                      : darkMode
                        ? 'text-slate-400'
                        : 'text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Weeks range */}
            <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
              {[4, 12, 26, 52].map((w) => (
                <button
                  key={w}
                  onClick={() => setWeeksRange(w)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    weeksRange === w
                      ? darkMode
                        ? 'bg-[#1235e2] text-white shadow-sm font-semibold'
                        : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                      : darkMode
                        ? 'text-slate-400'
                        : 'text-slate-500'
                  }`}
                >
                  {w}w
                </button>
              ))}
            </div>
          </div>

          {sovLoading ? (
            <V2Skeleton rows={3} />
          ) : !sovData || sovData.timeline.length === 0 ? (
            <V2Card className="p-12 text-center">
              <TrendingUp className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
              <h3 className="text-lg font-bold mb-2">No timeline data yet</h3>
              <p className={`mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Run the snapshot script to start tracking share of voice over time.
              </p>
              <code className={`text-xs px-3 py-1.5 rounded-lg ${darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}>
                npx tsx scripts/snapshot-sov.ts --backfill
              </code>
            </V2Card>
          ) : (
            <>
              {/* Stacked Area Chart */}
              <section className="mb-10">
                <V2SectionTitle icon={<TrendingUp className="w-5 h-5 text-[#1235e2]" />}>
                  {viewMode === 'percentage' ? 'Share of Voice Over Time' : `${METRIC_LABELS[metric]} Over Time`}
                </V2SectionTitle>

                <V2Card className="p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart
                      data={viewMode === 'percentage' ? sovData.timelinePercentage : sovData.timeline}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis
                        dataKey="week"
                        tickFormatter={formatWeek}
                        tick={{ fill: textColor, fontSize: 11 }}
                        stroke={gridColor}
                      />
                      <YAxis
                        tick={{ fill: textColor, fontSize: 11 }}
                        stroke={gridColor}
                        tickFormatter={(v) =>
                          viewMode === 'percentage'
                            ? `${v}%`
                            : metric === 'estSpend'
                              ? `$${v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v}`
                              : v >= 1000
                                ? `${(v / 1000).toFixed(0)}K`
                                : String(v)
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                          border: darkMode ? '1px solid rgba(18, 53, 226, 0.2)' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelFormatter={formatWeek}
                        formatter={(value: number | undefined) =>
                          viewMode === 'percentage'
                            ? [`${value ?? 0}%`, '']
                            : [formatNumber(value ?? 0), '']
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      {sovData.brands.map((brand, i) => (
                        <Area
                          key={brand}
                          type="monotone"
                          dataKey={brand}
                          stackId={viewMode === 'percentage' ? '1' : undefined}
                          stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                          fill={BRAND_COLORS[i % BRAND_COLORS.length]}
                          fillOpacity={viewMode === 'percentage' ? 0.8 : 0.3}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </V2Card>
              </section>

              {/* Current week bar chart */}
              {latestWeek && (
                <section className="mb-10">
                  <V2SectionTitle icon={<BarChart3 className="w-5 h-5 text-[#1235e2]" />}>
                    Current Week Breakdown
                  </V2SectionTitle>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Bar chart */}
                    <V2Card className="p-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={sovData.brands.map((brand, i) => ({
                            name: brand,
                            value: Number(latestWeek[brand]) || 0,
                            fill: BRAND_COLORS[i % BRAND_COLORS.length],
                          }))}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                          <XAxis
                            type="number"
                            tick={{ fill: textColor, fontSize: 11 }}
                            stroke={gridColor}
                            tickFormatter={(v) =>
                              viewMode === 'percentage' ? `${v}%` : formatNumber(v)
                            }
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fill: textColor, fontSize: 11 }}
                            stroke={gridColor}
                            width={120}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: darkMode ? '#1e293b' : '#ffffff',
                              border: darkMode ? '1px solid rgba(18, 53, 226, 0.2)' : '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number | undefined) => [
                              viewMode === 'percentage' ? `${value ?? 0}%` : formatNumber(value ?? 0),
                              METRIC_LABELS[metric],
                            ]}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {sovData.brands.map((_, i) => (
                              <rect key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </V2Card>

                    {/* Ranking table */}
                    <V2Card className="p-6">
                      <h4 className={`text-xs uppercase font-bold tracking-wider mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Rankings — {METRIC_LABELS[metric]}
                      </h4>
                      <div className="space-y-3">
                        {sovData.brands
                          .map((brand, i) => ({
                            brand,
                            value: Number(latestWeek[brand]) || 0,
                            pct: Number(
                              sovData.timelinePercentage[sovData.timelinePercentage.length - 1]?.[brand]
                            ) || 0,
                            color: BRAND_COLORS[i % BRAND_COLORS.length],
                          }))
                          .sort((a, b) => b.value - a.value)
                          .map((item, rank) => (
                            <div key={item.brand} className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                rank === 0
                                  ? 'bg-yellow-500/20 text-yellow-500'
                                  : rank === 1
                                    ? 'bg-slate-300/20 text-slate-400'
                                    : rank === 2
                                      ? 'bg-amber-700/20 text-amber-600'
                                      : darkMode
                                        ? 'bg-slate-800 text-slate-500'
                                        : 'bg-slate-100 text-slate-400'
                              }`}>
                                {rank + 1}
                              </span>
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="flex-1 text-sm font-medium truncate">{item.brand}</span>
                              <span className="text-sm font-bold">
                                {viewMode === 'percentage' ? `${item.pct}%` : formatNumber(item.value)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </V2Card>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}
    </V2Shell>
  );
}
