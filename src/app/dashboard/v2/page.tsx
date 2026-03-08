'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Trophy,
  TrendingUp,
  Play,
  Image as ImageIcon,
  Layers,
  Users,
  Database,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { V2Shell, V2Card, V2Skeleton, formatNumber } from './v2-shell';
import { useV2 } from './v2-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdLibraryStats {
  totalBrands: number;
  brandsByStatus: { status: string; count: number }[];
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
  adsByFormat: { format: string; count: number }[];
  adsByPlatform: { platform: string; count: number }[];
  totalReach: string;
  avgReachPerAd: number;
  recentJobs: unknown[];
  jobStats: { total: number; completed: number; failed: number; running: number; queued: number };
  topBrandsByAdCount: TopBrand[];
}

interface TopBrand {
  id: string;
  pageId: string;
  pageName: string;
  category: string | null;
  adCount: number;
  activeAdCount: number;
  totalReach: string;
}

interface Ad {
  id: string;
  adId: string;
  displayFormat: string | null;
  publisherPlatforms: string[];
  body: string | null;
  caption: string | null;
  title: string | null;
  linkUrl: string | null;
  ctaText: string | null;
  snapshotUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  reachEstimate: number | null;
  impressionsLower: number | null;
  impressionsUpper: number | null;
  brand: {
    id: string;
    pageId: string;
    pageName: string;
    profilePicUrl: string | null;
    category: string | null;
    country: string | null;
  };
  assets: {
    id: string;
    assetType: string;
    storedUrl: string | null;
    thumbnailUrl: string | null;
    originalUrl: string;
    downloadStatus: string;
    position: number;
  }[];
}

interface TrackedBrandSnapshot {
  totalReach: number;
  activeAdsCount: number;
  dominantGender: string | null;
  dominantGenderPct: number | null;
  topCountry1Code: string | null;
  topCountry1Pct: number | null;
  topCountry2Code: string | null;
  topCountry2Pct: number | null;
  topCountry3Code: string | null;
  topCountry3Pct: number | null;
}

interface TrackedBrand {
  id: string;
  facebookPageId: string;
  pageName: string;
  snapshots: TrackedBrandSnapshot[];
}

interface DashboardData {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
}

function formatFormatLabel(format: string | null): string {
  if (!format) return 'Unknown';
  return format.charAt(0).toUpperCase() + format.slice(1);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardV2Page() {
  const { darkMode } = useV2();
  const [stats, setStats] = useState<AdLibraryStats | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortTab, setSortTab] = useState<'reach' | 'newest' | 'active'>('reach');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, adsRes] = await Promise.all([
        fetch('/api/ad-library/stats?fast=true'),
        fetch('/api/ad-library/ads?sortBy=reachEstimate&sortOrder=desc&limit=8&isActive=true&excludeFormats=carousel,dpa'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (adsRes.ok) { const d = await adsRes.json(); setAds(d.ads || []); }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const sortMap = {
      reach: 'reachEstimate',
      newest: 'startDate',
      active: 'startDate',
    } as const;
    const sortBy = sortMap[sortTab];
    const params = new URLSearchParams({ sortBy, sortOrder: 'desc', limit: '8', isActive: 'true', excludeFormats: 'carousel,dpa' });
    fetch(`/api/ad-library/ads?${params}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setAds(data.ads || []); })
      .catch(() => {});
  }, [sortTab]);

  // Build sidebar insights
  const ownSnapshot = dashboardData?.ownBrand?.snapshots?.[0] ?? null;
  const countries: { code: string; pct: number }[] = [];
  if (ownSnapshot) {
    if (ownSnapshot.topCountry1Code && ownSnapshot.topCountry1Pct)
      countries.push({ code: ownSnapshot.topCountry1Code, pct: Math.round(ownSnapshot.topCountry1Pct) });
    if (ownSnapshot.topCountry2Code && ownSnapshot.topCountry2Pct)
      countries.push({ code: ownSnapshot.topCountry2Code, pct: Math.round(ownSnapshot.topCountry2Pct) });
    if (ownSnapshot.topCountry3Code && ownSnapshot.topCountry3Pct)
      countries.push({ code: ownSnapshot.topCountry3Code, pct: Math.round(ownSnapshot.topCountry3Pct) });
  }
  const genderLabel = ownSnapshot?.dominantGender
    ? `${Math.round(ownSnapshot.dominantGenderPct ?? 0)}% ${ownSnapshot.dominantGender === 'female' ? 'Female' : ownSnapshot.dominantGender === 'male' ? 'Male' : ownSnapshot.dominantGender}`
    : null;

  // Benchmarking data
  const competitors = dashboardData?.competitors ?? [];
  const benchmarkBrands = [
    ...(dashboardData?.ownBrand ? [{ name: dashboardData.ownBrand.pageName, reach: ownSnapshot?.totalReach ?? 0, isOwn: true }] : []),
    ...competitors.slice(0, 3).map(c => ({ name: c.pageName, reach: c.snapshots?.[0]?.totalReach ?? 0, isOwn: false })),
  ];
  const maxBenchmarkReach = Math.max(...benchmarkBrands.map(b => b.reach), 1);

  return (
    <V2Shell
      title="Analysis Dashboard"
      insights={{ genderLabel, genderPct: ownSnapshot?.dominantGenderPct ?? 0, countries }}
    >
      {loading ? (
        <V2Skeleton rows={4} />
      ) : (
        <>
          {/* Filters Bar */}
          <div className={`flex flex-wrap gap-3 items-center mb-8 p-4 rounded-xl border ${
            darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-slate-50 border-slate-100'
          }`}>
            {stats?.adsByFormat.slice(0, 3).map(f => (
              <button key={f.format} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
                darkMode ? 'bg-[#101322] border-[#1235e2]/20' : 'bg-white border-slate-200'
              }`}>
                {formatFormatLabel(f.format)}
                <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>({formatNumber(f.count)})</span>
              </button>
            ))}
            <button className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ${
              darkMode ? 'bg-[#101322] border-[#1235e2]/20' : 'bg-white border-slate-200'
            }`}>
              <Globe className="w-4 h-4" /> Country <ChevronDown className="w-3 h-3" />
            </button>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border ml-auto ${
              darkMode ? 'bg-[#101322] border-[#1235e2]/20' : 'bg-white border-slate-200'
            }`}>
              <Database className="w-4 h-4" /> {formatNumber(stats?.totalAds ?? 0)} ads tracked
            </div>
          </div>

          {/* Sorting Tabs */}
          <div className="flex items-center justify-between mb-6">
            <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
              {([
                { key: 'reach', label: 'Widest Reach' },
                { key: 'newest', label: 'Newest' },
                { key: 'active', label: 'Most Active' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setSortTab(tab.key)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    sortTab === tab.key
                      ? darkMode ? 'bg-[#1235e2] text-white shadow-sm font-semibold' : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                      : darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className={`text-sm font-medium ${darkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              Showing {formatNumber(stats?.totalAds ?? 0)} results
            </div>
          </div>

          {/* Top Performing Ads */}
          <section className="mb-12">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Top Performing Ads
            </h3>
            {ads.length === 0 ? (
              <V2Card className="p-12 text-center">
                <Database className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>No ads ingested yet.</p>
                <Link href="/dashboard/v2/ad-library" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors">
                  Go to Ad Library
                </Link>
              </V2Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {ads.slice(0, 4).map(ad => <AdCard key={ad.id} ad={ad} />)}
                </div>
                {ads.length > 4 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
                    {ads.slice(4, 8).map(ad => <AdCard key={ad.id} ad={ad} />)}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Benchmarking Section */}
          {benchmarkBrands.length >= 2 && (
            <section className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#1235e2]" /> Brand Benchmarking
                </h3>
                <div className="flex gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1235e2]" /> My Brand
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <div className={`w-2.5 h-2.5 rounded-full ${darkMode ? 'bg-slate-500' : 'bg-slate-400'}`} /> Competitors
                  </span>
                </div>
              </div>
              <V2Card className="p-8">
                <div className="flex items-end justify-between gap-8 h-64 mb-6">
                  {benchmarkBrands.map(brand => {
                    const heightPct = (brand.reach / maxBenchmarkReach) * 100;
                    return (
                      <div key={brand.name} className="flex-1 flex flex-col items-center gap-3">
                        <div className={`w-full rounded-lg relative flex flex-col justify-end h-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div
                            className={`w-full rounded-t-sm transition-all duration-700 ${brand.isOwn ? 'bg-[#1235e2]' : darkMode ? 'bg-slate-500' : 'bg-slate-400'}`}
                            style={{ height: `${Math.max(heightPct, 4)}%` }}
                          />
                        </div>
                        <div className="text-center">
                          <p className={`text-sm truncate max-w-[120px] ${brand.isOwn ? 'font-bold' : 'font-medium'}`}>{brand.name}</p>
                          <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{formatNumber(brand.reach)} reach</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className={`grid grid-cols-3 gap-8 pt-6 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
                  <div className="text-center">
                    <p className={`text-xs mb-1 uppercase font-bold tracking-tight ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Total Brands</p>
                    <p className="text-2xl font-black">{stats?.totalBrands ?? 0}</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-xs mb-1 uppercase font-bold tracking-tight ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Active Ads</p>
                    <p className="text-2xl font-black text-[#1235e2]">{formatNumber(stats?.activeAds ?? 0)}</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-xs mb-1 uppercase font-bold tracking-tight ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Avg Reach / Ad</p>
                    <p className="text-2xl font-black">{formatNumber(stats?.avgReachPerAd ?? 0)}</p>
                  </div>
                </div>
              </V2Card>
            </section>
          )}

          {/* Top Brands Table */}
          {stats && stats.topBrandsByAdCount.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#1235e2]" /> Top Brands by Ad Volume
                </h3>
                <Link href="/dashboard/v2/ad-library" className="text-sm text-[#1235e2] hover:underline flex items-center gap-1">
                  View All <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <V2Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`text-left text-xs uppercase tracking-wide border-b ${darkMode ? 'text-slate-400 border-[#1235e2]/10' : 'text-slate-500 border-slate-100'}`}>
                      <th className="px-6 py-3 font-bold">Brand</th>
                      <th className="px-6 py-3 font-bold">Category</th>
                      <th className="px-6 py-3 font-bold text-right">Total Ads</th>
                      <th className="px-6 py-3 font-bold text-right">Active</th>
                      <th className="px-6 py-3 font-bold text-right">Total Reach</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-[#1235e2]/10' : 'divide-slate-100'}`}>
                    {stats.topBrandsByAdCount.map(brand => (
                      <tr key={brand.id} className={`transition-colors ${darkMode ? 'hover:bg-[#1235e2]/10' : 'hover:bg-slate-50'}`}>
                        <td className="px-6 py-4">
                          <Link href={`/dashboard/ad-library/${brand.pageId}`} className="font-medium hover:text-[#1235e2] transition-colors">
                            {brand.pageName}
                          </Link>
                        </td>
                        <td className={`px-6 py-4 capitalize ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{brand.category || '-'}</td>
                        <td className="px-6 py-4 text-right">{formatNumber(brand.adCount)}</td>
                        <td className="px-6 py-4 text-right text-green-500 font-medium">{formatNumber(brand.activeAdCount)}</td>
                        <td className="px-6 py-4 text-right font-semibold">{formatNumber(brand.totalReach)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </V2Card>
            </section>
          )}

          {/* Format Distribution */}
          {stats && stats.adsByFormat.length > 0 && (
            <section className="mb-12">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#1235e2]" /> Format Distribution
              </h3>
              <V2Card className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.adsByFormat.slice(0, 4).map((f, i) => {
                    const total = stats.adsByFormat.reduce((sum, x) => sum + x.count, 0);
                    const pct = total > 0 ? ((f.count / total) * 100).toFixed(1) : '0';
                    const colors = ['#1235e2', '#10b981', '#8b5cf6', '#f59e0b'];
                    return (
                      <div key={f.format} className={`rounded-lg p-4 ${darkMode ? 'bg-[#101322]' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                          <span className="text-sm font-medium capitalize">{f.format || 'Unknown'}</span>
                        </div>
                        <p className="text-2xl font-black">{pct}%</p>
                        <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{formatNumber(f.count)} ads</p>
                      </div>
                    );
                  })}
                </div>
              </V2Card>
            </section>
          )}
        </>
      )}
    </V2Shell>
  );
}

// ---------------------------------------------------------------------------
// Ad Card Component
// ---------------------------------------------------------------------------

function AdCard({ ad }: { ad: Ad }) {
  const { darkMode } = useV2();
  const primaryAsset = ad.assets?.find(a => a.downloadStatus === 'completed' && a.storedUrl);
  const reachValue = ad.reachEstimate ?? ad.impressionsLower ?? null;

  const renderPreview = () => {
    // 1. R2-stored asset
    if (primaryAsset?.storedUrl) {
      if (primaryAsset.assetType === 'video') {
        return (
          <video src={primaryAsset.storedUrl} poster={primaryAsset.thumbnailUrl || undefined}
            className="w-full h-full object-cover" controls muted loop playsInline preload="metadata"
          />
        );
      }
      return <img alt={ad.title || 'Ad'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src={primaryAsset.storedUrl} loading="lazy" />;
    }
    // 4. Fallback text
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <ImageIcon className={`w-8 h-8 mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
        <p className={`text-xs text-center line-clamp-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {ad.body || ad.title || 'No preview'}
        </p>
      </div>
    );
  };

  const formatIcon = () => {
    switch (ad.displayFormat) {
      case 'video': return <Play className="w-3 h-3" />;
      case 'carousel': return <Layers className="w-3 h-3" />;
      default: return <ImageIcon className="w-3 h-3" />;
    }
  };

  return (
    <div className={`group rounded-xl overflow-hidden border transition-all hover:shadow-lg ${
      darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10 hover:border-[#1235e2]/40' : 'bg-white border-slate-200 hover:border-[#1235e2]/40'
    }`}>
      <div className={`relative aspect-[4/5] overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {renderPreview()}
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold uppercase tracking-wide flex items-center gap-1 z-10">
          {formatIcon()} {formatFormatLabel(ad.displayFormat)}
        </div>
        {ad.isActive && (
          <div className="absolute top-2 left-2 bg-green-500/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase z-10">Active</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3 min-w-0">
          <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
            darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
          }`}>{ad.brand.pageName[0]}</div>
          <Link href={`/dashboard/ad-library/${ad.brand.pageId}`} className="text-sm font-bold truncate hover:text-[#1235e2] transition-colors">
            {ad.brand.pageName}
          </Link>
        </div>
        {ad.body && <p className={`text-xs mb-3 line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{ad.body}</p>}
        <div className={`grid grid-cols-2 gap-2 pt-3 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Reach</p>
            <p className="text-sm font-bold">{reachValue ? formatNumber(reachValue) : 'N/A'}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Platform</p>
            <p className="text-sm font-bold capitalize">{ad.publisherPlatforms?.[0]?.replace('_', ' ') || 'Unknown'}</p>
          </div>
        </div>
        {ad.snapshotUrl && (
          <a href={ad.snapshotUrl} target="_blank" rel="noopener noreferrer"
            className={`flex items-center justify-center gap-1.5 mt-3 pt-3 border-t text-xs font-semibold transition-colors ${
              darkMode ? 'border-[#1235e2]/10 text-slate-400 hover:text-[#1235e2]' : 'border-slate-100 text-slate-500 hover:text-[#1235e2]'
            }`}>
            <ExternalLink className="w-3 h-3" /> View on Meta
          </a>
        )}
      </div>
    </div>
  );
}
