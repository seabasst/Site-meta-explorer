'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Search,
  Play,
  Image as ImageIcon,
  Layers,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
  BarChart3,
  Activity,
  Archive,
  Filter,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdLibraryStats {
  totalBrands: number;
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
  adsByFormat: { format: string; count: number }[];
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
  snapshotUrl: string | null;
  startDate: string | null;
  isActive: boolean;
  reachEstimate: number | null;
  brand: {
    pageId: string;
    pageName: string;
    profilePicUrl: string | null;
    category: string | null;
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFormatLabel(format: string | null): string {
  if (!format) return 'Unknown';
  return format.charAt(0).toUpperCase() + format.slice(1);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdLibraryPage() {
  const { darkMode } = useV2();

  // Data state
  const [stats, setStats] = useState<AdLibraryStats | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [topBrands, setTopBrands] = useState<TopBrand[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [adsLoading, setAdsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [formatDropdownOpen, setFormatDropdownOpen] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch stats + top brands on mount
  useEffect(() => {
    async function fetchInitial() {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, brandsRes] = await Promise.all([
          fetch('/api/ad-library/stats?fast=true'),
          fetch('/api/ad-library/brands?page=1&limit=5&sortBy=activeAdCount&sortOrder=desc'),
        ]);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
          setTopBrands(statsData.topBrandsByAdCount?.slice(0, 5) || []);
        }
        if (brandsRes.ok) {
          const brandsData = await brandsRes.json();
          if (brandsData.brands?.length) {
            setTopBrands(brandsData.brands.slice(0, 5));
          }
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load ad library data.');
      } finally {
        setLoading(false);
      }
    }
    fetchInitial();
  }, []);

  // Fetch ads when filters/page change
  const fetchAds = useCallback(async () => {
    setAdsLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy: 'startDate',
        sortOrder: 'desc',
        limit: '24',
        page: String(page),
      });
      if (statusFilter === 'active') {
        params.set('isActive', 'true');
      }
      if (formatFilter !== 'all') {
        params.set('displayFormat', formatFilter);
      }
      if (searchDebounce.trim()) {
        params.set('search', searchDebounce.trim());
      }

      const res = await fetch(`/api/ad-library/ads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAds(data.ads || []);
        setPagination(data.pagination || null);
      }
    } catch (err) {
      console.error('Failed to fetch ads:', err);
    } finally {
      setAdsLoading(false);
    }
  }, [page, statusFilter, formatFilter, searchDebounce]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, formatFilter, searchDebounce]);

  if (loading) {
    return (
      <V2Shell title="Ad Library">
        <V2Skeleton rows={4} />
      </V2Shell>
    );
  }

  if (error && !stats) {
    return (
      <V2Shell title="Ad Library">
        <div className={`rounded-xl p-12 text-center border ${darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200'}`}>
          <BookOpen className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Something went wrong
          </p>
          <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors"
          >
            Retry
          </button>
        </div>
      </V2Shell>
    );
  }

  const statCards = [
    { label: 'Total Brands', value: stats?.totalBrands ?? 0, icon: Users, color: 'text-[#1235e2]' },
    { label: 'Total Ads', value: stats?.totalAds ?? 0, icon: BookOpen, color: 'text-[#1235e2]' },
    { label: 'Active Ads', value: stats?.activeAds ?? 0, icon: Activity, color: 'text-green-500' },
    { label: 'Inactive Ads', value: stats?.inactiveAds ?? 0, icon: Archive, color: 'text-slate-400' },
  ];

  const formatOptions = [
    { value: 'all', label: 'All Formats' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'carousel', label: 'Carousel' },
  ];

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <V2Shell title="Ad Library">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <V2Card key={stat.label} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {stat.label}
              </span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-black">{formatNumber(stat.value)}</p>
          </V2Card>
        ))}
      </div>

      {/* Top Brands + Filter bar row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        {/* Filter Bar - takes 3 cols */}
        <div className="lg:col-span-3">
          <V2Card className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Format Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setFormatDropdownOpen(!formatDropdownOpen)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    darkMode
                      ? 'bg-[#101322] border-[#1235e2]/20 hover:border-[#1235e2]/40'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  {formatOptions.find(f => f.value === formatFilter)?.label}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {formatDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setFormatDropdownOpen(false)} />
                    <div className={`absolute top-full left-0 mt-1 w-44 rounded-lg border shadow-lg z-40 py-1 ${
                      darkMode ? 'bg-[#101322] border-[#1235e2]/20' : 'bg-white border-slate-200'
                    }`}>
                      {formatOptions.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => { setFormatFilter(opt.value); setFormatDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                            formatFilter === opt.value
                              ? 'text-[#1235e2] font-medium'
                              : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Status Toggle */}
              <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
                {(['active', 'all'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      statusFilter === s
                        ? darkMode
                          ? 'bg-[#1235e2] text-white shadow-sm font-semibold'
                          : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                        : darkMode
                          ? 'text-slate-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {s === 'active' ? 'Active' : 'All'}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full border-none rounded-lg pl-10 pr-4 h-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#1235e2] ${
                    darkMode ? 'bg-[#101322] text-white placeholder:text-slate-500' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400'
                  }`}
                  placeholder="Search ads by brand, text, or keyword..."
                />
              </div>

              {/* Result count */}
              <div className={`text-sm font-medium ml-auto ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {pagination ? formatNumber(pagination.total) : '...'} results
              </div>
            </div>
          </V2Card>
        </div>

        {/* Top Brands Sidebar */}
        <div className="lg:col-span-1">
          <V2Card className="p-4">
            <h4 className={`text-xs font-bold uppercase tracking-wider mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Top Brands
            </h4>
            <div className="space-y-2">
              {topBrands.length === 0 && (
                <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No brands tracked yet.</p>
              )}
              {topBrands.map((brand, i) => (
                <Link
                  key={brand.id || brand.pageId}
                  href={`/dashboard/v2/ad-library/${brand.pageId}`}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    darkMode ? 'hover:bg-[#1235e2]/10' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-[#1235e2]/10 text-[#1235e2]'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{brand.pageName}</p>
                    <p className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {formatNumber(brand.activeAdCount)} active
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </V2Card>
        </div>
      </div>

      {/* Ads Grid */}
      <section>
        <V2SectionTitle
          icon={<BookOpen className="w-5 h-5 text-[#1235e2]" />}
          action={
            <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Page {page} of {totalPages}
            </span>
          }
        >
          Browse Ads
        </V2SectionTitle>

        {adsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-[4/5] rounded-xl animate-pulse ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <V2Card className="p-12 text-center">
            <BookOpen className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              No ads found
            </p>
            <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
              {searchDebounce
                ? `No results for "${searchDebounce}". Try a different search.`
                : 'No ads match the current filters. Try adjusting your filters.'}
            </p>
          </V2Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} darkMode={darkMode} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
                darkMode
                  ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {generatePageNumbers(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`ellipsis-${i}`} className={`px-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
                    page === p
                      ? 'bg-[#1235e2] text-white shadow-sm'
                      : darkMode
                        ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
                darkMode
                  ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </section>
    </V2Shell>
  );
}

// ---------------------------------------------------------------------------
// Page number generator
// ---------------------------------------------------------------------------

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');

  pages.push(total);
  return pages;
}

// ---------------------------------------------------------------------------
// Ad Card
// ---------------------------------------------------------------------------

function AdCard({ ad, darkMode }: { ad: Ad; darkMode: boolean }) {
  // Find the best available asset (prefer completed R2 downloads)
  const primaryAsset = ad.assets?.find(a => a.downloadStatus === 'completed' && a.storedUrl);
  const isFacebookRender = ad.snapshotUrl?.includes('render_ad');

  const formatIcon = () => {
    switch (ad.displayFormat) {
      case 'video': return <Play className="w-3 h-3" />;
      case 'carousel': return <Layers className="w-3 h-3" />;
      default: return <ImageIcon className="w-3 h-3" />;
    }
  };

  const renderPreview = () => {
    // 1. R2-stored asset (best quality)
    if (primaryAsset?.storedUrl) {
      if (primaryAsset.assetType === 'video') {
        return (
          <video
            src={primaryAsset.storedUrl}
            poster={primaryAsset.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            controls
            muted
            loop
            playsInline
            preload="metadata"
          />
        );
      }
      return (
        <img
          src={primaryAsset.storedUrl}
          alt={ad.title || 'Ad creative'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      );
    }

    // 2. Facebook render URL (iframe fallback)
    if (ad.snapshotUrl && isFacebookRender) {
      return (
        <iframe
          src={ad.snapshotUrl}
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-0 pointer-events-none"
          loading="lazy"
          title={ad.title || 'Ad preview'}
        />
      );
    }

    // 3. Fallback: show body text
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <ImageIcon className={`w-8 h-8 mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
        <p className={`text-xs text-center line-clamp-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {ad.body || ad.title || 'No preview available'}
        </p>
      </div>
    );
  };

  return (
    <div className={`group rounded-xl overflow-hidden border transition-all hover:shadow-lg ${
      darkMode
        ? 'bg-[#1235e2]/5 border-[#1235e2]/10 hover:border-[#1235e2]/40'
        : 'bg-white border-slate-200 hover:border-[#1235e2]/40'
    }`}>
      {/* Preview */}
      <div className={`relative aspect-[4/5] overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {renderPreview()}

        {/* Format badge - top right */}
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold uppercase tracking-wide flex items-center gap-1 z-10">
          {formatIcon()}
          {formatFormatLabel(ad.displayFormat)}
        </div>

        {/* Status badge - top left */}
        <div className={`absolute top-2 left-2 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase z-10 ${
          ad.isActive ? 'bg-green-500/80' : 'bg-slate-500/80'
        }`}>
          {ad.isActive ? 'Active' : 'Ended'}
        </div>

      </div>

      {/* Card Info */}
      <div className="p-4">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-3 min-w-0">
          {ad.brand.profilePicUrl ? (
            <img src={ad.brand.profilePicUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
          ) : (
            <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
              darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
            }`}>
              {ad.brand.pageName?.[0] || '?'}
            </div>
          )}
          <Link
            href={`/dashboard/v2/ad-library/${ad.brand.pageId}`}
            className="text-sm font-bold truncate hover:text-[#1235e2] transition-colors"
          >
            {ad.brand.pageName}
          </Link>
        </div>

        {/* Body preview */}
        {ad.body && (
          <p className={`text-xs mb-3 line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {ad.body}
          </p>
        )}

        {/* Stats */}
        <div className={`grid grid-cols-2 gap-2 pt-3 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Reach</p>
            <p className="text-sm font-bold">{ad.reachEstimate ? formatNumber(ad.reachEstimate) : 'N/A'}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Platform</p>
            <p className="text-sm font-bold capitalize">
              {ad.publisherPlatforms?.[0]?.replace('_', ' ') || 'Unknown'}
            </p>
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
