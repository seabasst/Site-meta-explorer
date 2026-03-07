'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Scale,
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  Play,
  Image as ImageIcon,
  Zap,
  Table,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandSnapshot {
  totalAdsFound: number;
  activeAdsCount: number;
  totalReach: number;
  avgReachPerAd: number;
  estimatedSpendUsd: number;
  videoCount: number;
  imageCount: number;
  videoPercentage: number;
  imagePercentage: number;
  avgAdAgeDays: number;
  dominantGender: string | null;
  dominantGenderPct: number | null;
}

interface TrackedBrand {
  id: string;
  pageName: string;
  snapshots: BrandSnapshot[];
}

interface OverviewData {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
}

interface BrandRow {
  id: string;
  name: string;
  isOwn: boolean;
  totalAds: number;
  activeAds: number;
  totalReach: number;
  avgReachPerAd: number;
  estSpend: number;
  videoPct: number;
  imagePct: number;
  avgAdAge: number;
  performanceScore: number;
}

type ChartMetric = 'reach' | 'activeAds' | 'spend';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(num: number): string {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
}

function buildBrandRow(brand: TrackedBrand, isOwn: boolean): BrandRow | null {
  const snap = brand.snapshots?.[0];
  if (!snap) return null;

  const totalAds = snap.totalAdsFound || 0;
  const rawScore = totalAds > 0 ? snap.totalReach / totalAds : 0;

  return {
    id: brand.id,
    name: brand.pageName,
    isOwn,
    totalAds,
    activeAds: snap.activeAdsCount || 0,
    totalReach: snap.totalReach || 0,
    avgReachPerAd: snap.avgReachPerAd || 0,
    estSpend: snap.estimatedSpendUsd || 0,
    videoPct: snap.videoPercentage || 0,
    imagePct: snap.imagePercentage || 0,
    avgAdAge: snap.avgAdAgeDays || 0,
    performanceScore: rawScore, // normalized later
  };
}

function normalizePerfScores(brands: BrandRow[]): BrandRow[] {
  const maxRaw = Math.max(...brands.map(b => b.performanceScore), 1);
  return brands.map(b => ({
    ...b,
    performanceScore: Math.round((b.performanceScore / maxRaw) * 100),
  }));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BenchmarksPage() {
  const { darkMode } = useV2();
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('reach');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/overview');
      if (!res.ok) return;
      const data: OverviewData = await res.json();

      const rows: BrandRow[] = [];
      if (data.ownBrand) {
        const row = buildBrandRow(data.ownBrand, true);
        if (row) rows.push(row);
      }
      for (const c of data.competitors) {
        const row = buildBrandRow(c, false);
        if (row) rows.push(row);
      }

      setBrands(normalizePerfScores(rows));
    } catch (err) {
      console.error('Failed to fetch benchmarking data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Computed values
  const hasCompetitors = brands.filter(b => !b.isOwn).length > 0;
  const totalBrands = brands.length;
  const avgReach = totalBrands > 0 ? brands.reduce((s, b) => s + b.totalReach, 0) / totalBrands : 0;
  const avgSpend = totalBrands > 0 ? brands.reduce((s, b) => s + b.estSpend, 0) / totalBrands : 0;
  const avgAge = totalBrands > 0 ? brands.reduce((s, b) => s + b.avgAdAge, 0) / totalBrands : 0;

  // Chart data
  const chartValue = (b: BrandRow): number => {
    if (chartMetric === 'reach') return b.totalReach;
    if (chartMetric === 'activeAds') return b.activeAds;
    return b.estSpend;
  };
  const chartLabel = (v: number): string => {
    if (chartMetric === 'spend') return formatCurrency(v);
    return formatNumber(v);
  };
  const maxChartVal = Math.max(...brands.map(chartValue), 1);

  // Best/worst column detection for comparison table
  const metricKeys: (keyof BrandRow)[] = [
    'totalAds', 'activeAds', 'totalReach', 'avgReachPerAd', 'estSpend', 'videoPct', 'imagePct', 'avgAdAge',
  ];
  const bestWorst: Record<string, { best: number; worst: number }> = {};
  if (brands.length >= 2) {
    for (const key of metricKeys) {
      const vals = brands.map(b => b[key] as number);
      // For avgAdAge, lower is better (fresher ads). For everything else, higher is better.
      if (key === 'avgAdAge') {
        bestWorst[key] = { best: Math.min(...vals), worst: Math.max(...vals) };
      } else {
        bestWorst[key] = { best: Math.max(...vals), worst: Math.min(...vals) };
      }
    }
  }

  function cellClass(key: string, val: number): string {
    if (!bestWorst[key] || brands.length < 2) return '';
    if (val === bestWorst[key].best && bestWorst[key].best !== bestWorst[key].worst) return 'text-green-500 font-semibold';
    if (val === bestWorst[key].worst && bestWorst[key].best !== bestWorst[key].worst) return 'text-red-500';
    return '';
  }

  return (
    <V2Shell title="Benchmarking">
      {loading ? (
        <V2Skeleton rows={4} />
      ) : brands.length === 0 ? (
        <EmptyState darkMode={darkMode} />
      ) : !hasCompetitors ? (
        <NoCompetitorsState darkMode={darkMode} brand={brands[0]} />
      ) : (
        <>
          {/* --------------------------------------------------------------- */}
          {/* Overview Cards */}
          {/* --------------------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <OverviewCard
              icon={<Users className="w-5 h-5" />}
              label="Brands Tracked"
              value={String(totalBrands)}
              darkMode={darkMode}
            />
            <OverviewCard
              icon={<TrendingUp className="w-5 h-5" />}
              label="Avg Reach"
              value={formatNumber(avgReach)}
              darkMode={darkMode}
            />
            <OverviewCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Avg Spend"
              value={formatCurrency(avgSpend)}
              darkMode={darkMode}
            />
            <OverviewCard
              icon={<Clock className="w-5 h-5" />}
              label="Avg Ad Age"
              value={`${avgAge.toFixed(0)}d`}
              darkMode={darkMode}
            />
          </div>

          {/* --------------------------------------------------------------- */}
          {/* Bar Chart Comparison */}
          {/* --------------------------------------------------------------- */}
          <section className="mb-10">
            <V2SectionTitle
              icon={<BarChart3 className="w-5 h-5 text-[#1235e2]" />}
              action={
                <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
                  {([
                    { key: 'reach' as ChartMetric, label: 'Total Reach' },
                    { key: 'activeAds' as ChartMetric, label: 'Active Ads' },
                    { key: 'spend' as ChartMetric, label: 'Est. Spend' },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setChartMetric(tab.key)}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
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

            <V2Card className="p-8">
              {/* Legend */}
              <div className="flex gap-4 mb-6">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1235e2]" /> Your Brand
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <div className={`w-2.5 h-2.5 rounded-full ${darkMode ? 'bg-slate-500' : 'bg-slate-400'}`} /> Competitors
                </span>
              </div>

              {/* Horizontal bar chart */}
              <div className="space-y-4">
                {brands.map(b => {
                  const val = chartValue(b);
                  const pct = maxChartVal > 0 ? (val / maxChartVal) * 100 : 0;
                  return (
                    <div key={b.id} className="flex items-center gap-4">
                      <div className={`w-32 shrink-0 text-sm truncate ${b.isOwn ? 'font-bold' : 'font-medium'}`}>
                        {b.name}
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <div className={`flex-1 h-8 rounded-lg overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div
                            className={`h-full rounded-lg transition-all duration-700 ${
                              b.isOwn ? 'bg-[#1235e2]' : darkMode ? 'bg-slate-500' : 'bg-slate-400'
                            }`}
                            style={{ width: `${Math.max(pct, 2)}%` }}
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

          {/* --------------------------------------------------------------- */}
          {/* Performance Scores */}
          {/* --------------------------------------------------------------- */}
          <section className="mb-10">
            <V2SectionTitle icon={<Zap className="w-5 h-5 text-[#1235e2]" />}>
              Performance Score
            </V2SectionTitle>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {brands.map(b => (
                <V2Card key={b.id} className="p-5 text-center">
                  <div className={`text-3xl font-black mb-1 ${
                    b.performanceScore >= 80
                      ? 'text-green-500'
                      : b.performanceScore >= 50
                        ? 'text-yellow-500'
                        : 'text-red-500'
                  }`}>
                    {b.performanceScore}
                  </div>
                  <div className={`text-xs mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    out of 100
                  </div>
                  <div className={`text-sm truncate ${b.isOwn ? 'font-bold' : 'font-medium'}`}>
                    {b.name}
                  </div>
                  {b.isOwn && (
                    <span className="inline-block mt-1 text-[10px] uppercase font-bold tracking-wider text-[#1235e2]">
                      Your Brand
                    </span>
                  )}
                </V2Card>
              ))}
            </div>
          </section>

          {/* --------------------------------------------------------------- */}
          {/* Detailed Comparison Table */}
          {/* --------------------------------------------------------------- */}
          <section className="mb-10">
            <V2SectionTitle icon={<Table className="w-5 h-5 text-[#1235e2]" />}>
              Detailed Comparison
            </V2SectionTitle>

            <V2Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left text-xs uppercase tracking-wide border-b ${
                      darkMode ? 'text-slate-400 border-[#1235e2]/10' : 'text-slate-500 border-slate-100'
                    }`}>
                      <th className="px-6 py-3 font-bold">Brand</th>
                      <th className="px-4 py-3 font-bold text-right">Total Ads</th>
                      <th className="px-4 py-3 font-bold text-right">Active Ads</th>
                      <th className="px-4 py-3 font-bold text-right">Total Reach</th>
                      <th className="px-4 py-3 font-bold text-right">Avg Reach/Ad</th>
                      <th className="px-4 py-3 font-bold text-right">Est. Spend</th>
                      <th className="px-4 py-3 font-bold text-right">Video%</th>
                      <th className="px-4 py-3 font-bold text-right">Image%</th>
                      <th className="px-4 py-3 font-bold text-right">Avg Ad Age</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-[#1235e2]/10' : 'divide-slate-100'}`}>
                    {brands.map(b => (
                      <tr
                        key={b.id}
                        className={`transition-colors ${
                          b.isOwn
                            ? darkMode ? 'bg-[#1235e2]/5' : 'bg-[#1235e2]/[0.02]'
                            : ''
                        } ${darkMode ? 'hover:bg-[#1235e2]/10' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-6 py-4">
                          <span className={b.isOwn ? 'font-bold' : 'font-medium'}>
                            {b.name}
                          </span>
                          {b.isOwn && (
                            <span className="ml-2 text-[10px] uppercase font-bold tracking-wider text-[#1235e2]">
                              You
                            </span>
                          )}
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
                          {b.videoPct.toFixed(0)}%
                        </td>
                        <td className={`px-4 py-4 text-right ${cellClass('imagePct', b.imagePct)}`}>
                          {b.imagePct.toFixed(0)}%
                        </td>
                        <td className={`px-4 py-4 text-right ${cellClass('avgAdAge', b.avgAdAge)}`}>
                          {b.avgAdAge.toFixed(0)}d
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </V2Card>
          </section>

          {/* --------------------------------------------------------------- */}
          {/* Media Mix Comparison */}
          {/* --------------------------------------------------------------- */}
          <section className="mb-10">
            <V2SectionTitle icon={<Play className="w-5 h-5 text-[#1235e2]" />}>
              Media Mix Comparison
            </V2SectionTitle>

            <V2Card className="p-6">
              {/* Legend */}
              <div className="flex gap-4 mb-6">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1235e2]" /> Video
                </span>
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Image
                </span>
              </div>

              <div className="space-y-4">
                {brands.map(b => (
                  <div key={b.id} className="flex items-center gap-4">
                    <div className={`w-32 shrink-0 text-sm truncate ${b.isOwn ? 'font-bold' : 'font-medium'}`}>
                      {b.name}
                    </div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className={`flex-1 h-6 rounded-lg overflow-hidden flex ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        {b.videoPct > 0 && (
                          <div
                            className="h-full bg-[#1235e2] transition-all duration-700"
                            style={{ width: `${b.videoPct}%` }}
                            title={`Video: ${b.videoPct.toFixed(0)}%`}
                          />
                        )}
                        {b.imagePct > 0 && (
                          <div
                            className="h-full bg-emerald-500 transition-all duration-700"
                            style={{ width: `${b.imagePct}%` }}
                            title={`Image: ${b.imagePct.toFixed(0)}%`}
                          />
                        )}
                      </div>
                      <span className={`text-xs w-28 text-right shrink-0 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {b.videoPct.toFixed(0)}% / {b.imagePct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </V2Card>
          </section>
        </>
      )}
    </V2Shell>
  );
}

// ---------------------------------------------------------------------------
// Overview Card
// ---------------------------------------------------------------------------

function OverviewCard({
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

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ darkMode }: { darkMode: boolean }) {
  return (
    <V2Card className="p-12 text-center">
      <Scale className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
      <h3 className="text-lg font-bold mb-2">No benchmarking data yet</h3>
      <p className={`mb-6 max-w-md mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Set up your brand and add competitors to start comparing performance metrics across your market.
      </p>
      <Link
        href="/dashboard/v2/competitors"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors"
      >
        <Users className="w-4 h-4" />
        Add Competitors
      </Link>
    </V2Card>
  );
}

// ---------------------------------------------------------------------------
// No Competitors State
// ---------------------------------------------------------------------------

function NoCompetitorsState({ darkMode, brand }: { darkMode: boolean; brand: BrandRow }) {
  return (
    <div className="space-y-8">
      {/* Show own brand summary */}
      <V2Card className="p-6">
        <h3 className="text-lg font-bold mb-4">Your Brand: {brand.name}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className={`text-xs uppercase font-bold tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Total Ads
            </p>
            <p className="text-xl font-black">{formatNumber(brand.totalAds)}</p>
          </div>
          <div>
            <p className={`text-xs uppercase font-bold tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Total Reach
            </p>
            <p className="text-xl font-black">{formatNumber(brand.totalReach)}</p>
          </div>
          <div>
            <p className={`text-xs uppercase font-bold tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Est. Spend
            </p>
            <p className="text-xl font-black">{formatCurrency(brand.estSpend)}</p>
          </div>
          <div>
            <p className={`text-xs uppercase font-bold tracking-wider mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Avg Ad Age
            </p>
            <p className="text-xl font-black">{brand.avgAdAge.toFixed(0)}d</p>
          </div>
        </div>
      </V2Card>

      {/* CTA to add competitors */}
      <V2Card className="p-10 text-center">
        <Scale className={`w-10 h-10 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
        <h3 className="text-lg font-bold mb-2">Add competitors to unlock benchmarking</h3>
        <p className={`mb-6 max-w-lg mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Compare your ad performance against competitors. See who has the highest reach, best media mix,
          and most efficient spend across your market.
        </p>
        <Link
          href="/dashboard/v2/competitors"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors"
        >
          <Users className="w-4 h-4" />
          Add Competitors
        </Link>
      </V2Card>
    </div>
  );
}
