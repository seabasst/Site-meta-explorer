'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Zap,
  Play,
  Image as ImageIcon,
  Layers as LayersIcon,
  Table,
  Clock,
  DollarSign,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../../v2-shell';
import { useV2 } from '../../v2-context';

interface BrandStat {
  id: string;
  name: string;
  pageId: string;
  country: string | null;
  totalAds: number;
  activeAds: number;
  totalReach: number;
  avgReachPerAd: number;
  estSpend: number;
  videoPct: number;
  imagePct: number;
  carouselPct: number;
  avgAdAgeDays: number;
  formats: Record<string, number>;
}

interface CategoryData {
  slug: string;
  label: string;
  brandCount: number;
  totalAds: number;
  totalActiveAds: number;
  totalReach: number;
  avgReach: number;
  totalSpend: number;
  brands: BrandStat[];
}

type ChartMetric = 'reach' | 'activeAds' | 'spend' | 'totalAds';
type SortKey = 'name' | 'totalAds' | 'activeAds' | 'totalReach' | 'avgReachPerAd' | 'estSpend' | 'videoPct' | 'avgAdAgeDays';

function formatCurrency(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

export default function CategoryDetailPage() {
  const { darkMode } = useV2();
  const params = useParams();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CategoryData | null>(null);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('reach');
  const [sortKey, setSortKey] = useState<SortKey>('totalReach');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/categories/${slug}`);
      if (!res.ok) return;
      setData(await res.json());
    } catch (err) {
      console.error('Failed to fetch category:', err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <V2Shell title="Category">
        <V2Skeleton rows={4} />
      </V2Shell>
    );
  }

  if (!data || data.brands.length === 0) {
    return (
      <V2Shell title="Category">
        <V2Card className="p-12 text-center">
          <h3 className="text-lg font-bold mb-2">Category not found</h3>
          <Link href="/dashboard/v2/categories" className="text-[#1235e2] text-sm hover:underline">
            Back to categories
          </Link>
        </V2Card>
      </V2Shell>
    );
  }

  // Sort brands
  const sortedBrands = [...data.brands].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  // Chart helpers
  const chartValue = (b: BrandStat): number => {
    if (chartMetric === 'reach') return b.totalReach;
    if (chartMetric === 'activeAds') return b.activeAds;
    if (chartMetric === 'totalAds') return b.totalAds;
    return b.estSpend;
  };
  const chartLabel = (v: number): string => {
    if (chartMetric === 'spend') return formatCurrency(v);
    return formatNumber(v);
  };
  const maxChartVal = Math.max(...data.brands.map(chartValue), 1);

  // Best/worst for table highlighting
  const metricKeys: SortKey[] = [
    'totalAds', 'activeAds', 'totalReach', 'avgReachPerAd', 'estSpend', 'videoPct', 'avgAdAgeDays',
  ];
  const bestWorst: Record<string, { best: number; worst: number }> = {};
  if (data.brands.length >= 2) {
    for (const key of metricKeys) {
      const vals = data.brands.map((b) => b[key] as number);
      if (key === 'avgAdAgeDays') {
        bestWorst[key] = { best: Math.min(...vals), worst: Math.max(...vals) };
      } else {
        bestWorst[key] = { best: Math.max(...vals), worst: Math.min(...vals) };
      }
    }
  }

  function cellClass(key: string, val: number): string {
    if (!bestWorst[key] || data!.brands.length < 2) return '';
    if (val === bestWorst[key].best && bestWorst[key].best !== bestWorst[key].worst) return 'text-green-500 font-semibold';
    if (val === bestWorst[key].worst && bestWorst[key].best !== bestWorst[key].worst) return 'text-red-500';
    return '';
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>;
  }

  // Colors for brands in charts
  const BRAND_COLORS = [
    '#1235e2', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#e11d48', '#0ea5e9', '#a855f7', '#22c55e',
  ];

  return (
    <V2Shell title={data.label}>
      {/* Back link */}
      <Link
        href="/dashboard/v2/categories"
        className={`inline-flex items-center gap-1.5 text-sm mb-6 transition-colors ${
          darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <ArrowLeft className="w-4 h-4" />
        All Categories
      </Link>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Brands" value={String(data.brandCount)} darkMode={darkMode} />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Total Ads" value={formatNumber(data.totalAds)} darkMode={darkMode} />
        <StatCard icon={<Zap className="w-5 h-5" />} label="Active Ads" value={formatNumber(data.totalActiveAds)} darkMode={darkMode} />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Total Reach" value={formatNumber(data.totalReach)} darkMode={darkMode} />
      </div>

      {/* Bar chart comparison */}
      <section className="mb-10">
        <V2SectionTitle
          icon={<BarChart3 className="w-5 h-5 text-[#1235e2]" />}
          action={
            <div className={`p-1 rounded-lg flex flex-wrap gap-0.5 ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
              {([
                { key: 'reach' as ChartMetric, label: 'Reach' },
                { key: 'activeAds' as ChartMetric, label: 'Active Ads' },
                { key: 'totalAds' as ChartMetric, label: 'Total Ads' },
                { key: 'spend' as ChartMetric, label: 'Est. Spend' },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setChartMetric(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    chartMetric === tab.key
                      ? darkMode
                        ? 'bg-[#1235e2] text-white shadow-sm font-semibold'
                        : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                      : darkMode
                        ? 'text-slate-400'
                        : 'text-slate-500'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        >
          Brand Comparison
        </V2SectionTitle>

        <V2Card className="p-6">
          <div className="space-y-3">
            {[...data.brands]
              .sort((a, b) => chartValue(b) - chartValue(a))
              .map((b, i) => {
                const val = chartValue(b);
                const pct = maxChartVal > 0 ? (val / maxChartVal) * 100 : 0;
                return (
                  <div key={b.id} className="flex items-center gap-4">
                    <div className="w-36 shrink-0 text-sm font-medium truncate">{b.name}</div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className={`flex-1 h-8 rounded-lg overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div
                          className="h-full rounded-lg transition-all duration-700"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length],
                          }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-24 text-right shrink-0 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        {chartLabel(val)}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </V2Card>
      </section>

      {/* Performance scores */}
      <section className="mb-10">
        <V2SectionTitle icon={<Zap className="w-5 h-5 text-[#1235e2]" />}>
          Reach per Ad (Efficiency)
        </V2SectionTitle>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...data.brands]
            .sort((a, b) => b.avgReachPerAd - a.avgReachPerAd)
            .map((b, i) => {
              const maxAvg = Math.max(...data.brands.map((x) => x.avgReachPerAd), 1);
              const score = Math.round((b.avgReachPerAd / maxAvg) * 100);
              return (
                <V2Card key={b.id} className="p-5 text-center">
                  <div
                    className={`text-3xl font-black mb-1 ${
                      score >= 80 ? 'text-green-500' : score >= 50 ? 'text-yellow-500' : 'text-red-500'
                    }`}
                  >
                    {score}
                  </div>
                  <div className={`text-[10px] mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {formatNumber(b.avgReachPerAd)} avg reach/ad
                  </div>
                  <div className="text-sm font-medium truncate">{b.name}</div>
                </V2Card>
              );
            })}
        </div>
      </section>

      {/* Detailed table */}
      <section className="mb-10">
        <V2SectionTitle icon={<Table className="w-5 h-5 text-[#1235e2]" />}>
          Detailed Comparison
        </V2SectionTitle>

        <V2Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className={`text-left text-xs uppercase tracking-wide border-b ${
                    darkMode ? 'text-slate-400 border-[#1235e2]/10' : 'text-slate-500 border-slate-100'
                  }`}
                >
                  <th className="px-6 py-3 font-bold cursor-pointer hover:text-[#1235e2]" onClick={() => handleSort('name')}>
                    Brand{sortIndicator('name')}
                  </th>
                  <th className="px-4 py-3 font-bold text-right cursor-pointer hover:text-[#1235e2]" onClick={() => handleSort('totalAds')}>
                    Total Ads{sortIndicator('totalAds')}
                  </th>
                  <th className="px-4 py-3 font-bold text-right cursor-pointer hover:text-[#1235e2]" onClick={() => handleSort('activeAds')}>
                    Active{sortIndicator('activeAds')}
                  </th>
                  <th className="px-4 py-3 font-bold text-right cursor-pointer hover:text-[#1235e2]" onClick={() => handleSort('totalReach')}>
                    Total Reach{sortIndicator('totalReach')}
                  </th>
                  <th className="px-4 py-3 font-bold text-right cursor-pointer hover:text-[#1235e2]" onClick={() => handleSort('avgReachPerAd')}>
                    Avg/Ad{sortIndicator('avgReachPerAd')}
                  </th>
                  <th className="px-4 py-3 font-bold text-right cursor-pointer hover:text-[#1235e2]" onClick={() => handleSort('estSpend')}>
                    Est. Spend{sortIndicator('estSpend')}
                  </th>
                  <th className="px-4 py-3 font-bold text-right cursor-pointer hover:text-[#1235e2]" onClick={() => handleSort('videoPct')}>
                    Video%{sortIndicator('videoPct')}
                  </th>
                  <th className="px-4 py-3 font-bold text-right">Image%</th>
                  <th className="px-4 py-3 font-bold text-right cursor-pointer hover:text-[#1235e2]" onClick={() => handleSort('avgAdAgeDays')}>
                    Avg Age{sortIndicator('avgAdAgeDays')}
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-[#1235e2]/10' : 'divide-slate-100'}`}>
                {sortedBrands.map((b) => (
                  <tr key={b.id} className={`transition-colors ${darkMode ? 'hover:bg-[#1235e2]/10' : 'hover:bg-slate-50'}`}>
                    <td className="px-6 py-4 font-medium">
                      <Link
                        href={`/dashboard/v2/ad-library?brandPageId=${b.pageId}`}
                        className="hover:text-[#1235e2] transition-colors"
                      >
                        {b.name}
                      </Link>
                    </td>
                    <td className={`px-4 py-4 text-right ${cellClass('totalAds', b.totalAds)}`}>
                      {formatNumber(b.totalAds)}
                    </td>
                    <td className={`px-4 py-4 text-right ${cellClass('activeAds', b.activeAds)}`}>
                      {formatNumber(b.activeAds)}
                    </td>
                    <td className={`px-4 py-4 text-right ${cellClass('totalReach', b.totalReach)}`}>
                      {formatNumber(b.totalReach)}
                    </td>
                    <td className={`px-4 py-4 text-right ${cellClass('avgReachPerAd', b.avgReachPerAd)}`}>
                      {formatNumber(b.avgReachPerAd)}
                    </td>
                    <td className={`px-4 py-4 text-right ${cellClass('estSpend', b.estSpend)}`}>
                      {formatCurrency(b.estSpend)}
                    </td>
                    <td className={`px-4 py-4 text-right ${cellClass('videoPct', b.videoPct)}`}>
                      {b.videoPct}%
                    </td>
                    <td className="px-4 py-4 text-right">{b.imagePct}%</td>
                    <td className={`px-4 py-4 text-right ${cellClass('avgAdAgeDays', b.avgAdAgeDays)}`}>
                      {b.avgAdAgeDays}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </V2Card>
      </section>

      {/* Media mix comparison */}
      <section className="mb-10">
        <V2SectionTitle icon={<Play className="w-5 h-5 text-[#1235e2]" />}>
          Media Mix
        </V2SectionTitle>

        <V2Card className="p-6">
          <div className="flex gap-4 mb-6">
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1235e2]" /> Video
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Image
            </span>
            <span className="flex items-center gap-1.5 text-xs font-medium">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Carousel
            </span>
          </div>

          <div className="space-y-3">
            {data.brands
              .sort((a, b) => b.totalReach - a.totalReach)
              .map((b) => (
                <div key={b.id} className="flex items-center gap-4">
                  <div className="w-36 shrink-0 text-sm font-medium truncate">{b.name}</div>
                  <div className="flex-1 flex items-center gap-3">
                    <div className={`flex-1 h-6 rounded-lg overflow-hidden flex ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      {b.videoPct > 0 && (
                        <div
                          className="h-full bg-[#1235e2] transition-all duration-700"
                          style={{ width: `${b.videoPct}%` }}
                          title={`Video: ${b.videoPct}%`}
                        />
                      )}
                      {b.imagePct > 0 && (
                        <div
                          className="h-full bg-emerald-500 transition-all duration-700"
                          style={{ width: `${b.imagePct}%` }}
                          title={`Image: ${b.imagePct}%`}
                        />
                      )}
                      {b.carouselPct > 0 && (
                        <div
                          className="h-full bg-amber-500 transition-all duration-700"
                          style={{ width: `${b.carouselPct}%` }}
                          title={`Carousel: ${b.carouselPct}%`}
                        />
                      )}
                    </div>
                    <span className={`text-xs w-36 text-right shrink-0 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {b.videoPct}% / {b.imagePct}% / {b.carouselPct}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </V2Card>
      </section>

      {/* Ad age comparison */}
      <section className="mb-10">
        <V2SectionTitle icon={<Clock className="w-5 h-5 text-[#1235e2]" />}>
          Average Ad Age (lower = fresher)
        </V2SectionTitle>

        <V2Card className="p-6">
          <div className="space-y-3">
            {[...data.brands]
              .sort((a, b) => a.avgAdAgeDays - b.avgAdAgeDays)
              .map((b, i) => {
                const maxAge = Math.max(...data.brands.map((x) => x.avgAdAgeDays), 1);
                const pct = maxAge > 0 ? (b.avgAdAgeDays / maxAge) * 100 : 0;
                return (
                  <div key={b.id} className="flex items-center gap-4">
                    <div className="w-36 shrink-0 text-sm font-medium truncate">{b.name}</div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className={`flex-1 h-7 rounded-lg overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <div
                          className="h-full rounded-lg transition-all duration-700"
                          style={{
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: b.avgAdAgeDays <= 30 ? '#10b981' : b.avgAdAgeDays <= 90 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                      <span className={`text-sm font-semibold w-16 text-right shrink-0 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        {b.avgAdAgeDays}d
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </V2Card>
      </section>
    </V2Shell>
  );
}

function StatCard({
  icon,
  label,
  value,
  darkMode,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  darkMode: boolean;
}) {
  return (
    <V2Card className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${darkMode ? 'bg-[#1235e2]/10' : 'bg-[#1235e2]/5'}`}>
          <div className="text-[#1235e2]">{icon}</div>
        </div>
        <span className={`text-xs uppercase font-bold tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
      </div>
      <p className="text-2xl font-black">{value}</p>
    </V2Card>
  );
}
