'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import {
  BookOpen,
  Search,
  Layers,
  Users,
  X,
  Calendar,
  Tag,
  Heart,
  LogIn,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

// Extracted components & shared types
import { Ad, AdLibraryStats, TopBrand, PaginationData, FilterOption, DaysRange } from './types';
import { AdCard } from './components/ad-card';
import { FilterDropdown } from './components/filter-dropdown';
import { FilterChip } from './components/filter-chip';
import { StatsBar } from './components/stats-bar';
import { AdPagination } from './components/pagination';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdLibraryPage() {
  return (
    <Suspense fallback={<V2Shell title="Ad Library"><V2Skeleton rows={4} /></V2Shell>}>
      <AdLibraryContent />
    </Suspense>
  );
}

function AdLibraryContent() {
  const { darkMode } = useV2();
  const searchParams = useSearchParams();
  const urlBrandPageId = searchParams.get('brandPageId') || '';

  // Data state
  const [stats, setStats] = useState<AdLibraryStats | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [topBrands, setTopBrands] = useState<TopBrand[]>([]);

  // Filter options from API
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [formatOptions, setFormatOptions] = useState<FilterOption[]>([]);
  const [daysRanges] = useState<DaysRange[]>([
    { label: 'Last 7 days', min: 0, max: 7 },
    { label: '7–30 days', min: 7, max: 30 },
    { label: '30–90 days', min: 30, max: 90 },
    { label: '90–180 days', min: 90, max: 180 },
    { label: '180+ days', min: 180, max: undefined },
  ]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [adsLoading, setAdsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Filters
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [hideCarousel, setHideCarousel] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [daysActiveFilter, setDaysActiveFilter] = useState<DaysRange | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>(urlBrandPageId);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  // Auth & saved ads
  const { data: session } = useSession();
  const [savedAdIds, setSavedAdIds] = useState<Set<string>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch stats + top brands + filter options on mount
  useEffect(() => {
    async function fetchInitial() {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, brandsRes, filtersRes] = await Promise.all([
          fetch('/api/ad-library/stats?fast=true'),
          fetch('/api/ad-library/brands?page=1&limit=5&sortBy=activeAdCount&sortOrder=desc'),
          fetch('/api/ad-library/filters'),
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
        if (filtersRes.ok) {
          const filtersData = await filtersRes.json();
          setCategories(filtersData.categories || []);
          setFormatOptions(filtersData.formats || []);
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
        sortBy: 'reachEstimate',
        sortOrder: 'desc',
        limit: '24',
        page: String(page),
      });
      if (statusFilter === 'active') {
        params.set('isActive', 'true');
      }
      if (selectedFormats.size > 0) {
        params.set('displayFormats', Array.from(selectedFormats).join(','));
      } else if (hideCarousel) {
        params.set('excludeFormats', 'carousel,dpa');
      }
      if (categoryFilter) {
        params.set('category', categoryFilter);
      }
      if (daysActiveFilter) {
        params.set('minDaysActive', String(daysActiveFilter.min));
        if (daysActiveFilter.max !== undefined) {
          params.set('maxDaysActive', String(daysActiveFilter.max));
        }
      }
      if (brandFilter) {
        params.set('brandPageId', brandFilter);
      }
      if (searchDebounce.trim()) {
        params.set('search', searchDebounce.trim());
      }

      const res = await fetch(`/api/ad-library/ads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedAds = data.ads || [];
        setAds(fetchedAds);
        setPagination(data.pagination || null);

        // Check which ads are saved
        if (fetchedAds.length > 0) {
          try {
            const checkRes = await fetch('/api/ad-library/saved/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adIds: fetchedAds.map((a: Ad) => a.id) }),
            });
            if (checkRes.ok) {
              const { savedAdIds: ids } = await checkRes.json();
              setSavedAdIds(new Set(ids));
            }
          } catch {
            // Non-critical — ignore
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch ads:', err);
    } finally {
      setAdsLoading(false);
    }
  }, [page, statusFilter, selectedFormats, hideCarousel, categoryFilter, brandFilter, daysActiveFilter, searchDebounce]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, selectedFormats, hideCarousel, categoryFilter, brandFilter, daysActiveFilter, searchDebounce]);

  const activeFilterCount = (selectedFormats.size > 0 ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (brandFilter ? 1 : 0) +
    (daysActiveFilter ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedFormats(new Set());
    setHideCarousel(true);
    setCategoryFilter('');
    setBrandFilter('');
    setDaysActiveFilter(null);
    setStatusFilter('active');
    setSearchQuery('');
  };

  const toggleSaveAd = useCallback(async (adId: string) => {
    if (!session?.user) {
      setShowLoginModal(true);
      return;
    }
    const isSaved = savedAdIds.has(adId);
    // Optimistic update
    setSavedAdIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(adId);
      else next.add(adId);
      return next;
    });
    try {
      await fetch('/api/ad-library/saved', {
        method: isSaved ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId }),
      });
    } catch {
      // Revert on error
      setSavedAdIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(adId);
        else next.delete(adId);
        return next;
      });
    }
  }, [savedAdIds, session]);

  const toggleFormat = (fmt: string) => {
    setSelectedFormats(prev => {
      const next = new Set(prev);
      if (next.has(fmt)) next.delete(fmt);
      else next.add(fmt);
      return next;
    });
  };

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

  const totalPages = pagination?.totalPages ?? 1;

  return (
    <V2Shell title="Ad Library">
      {/* Stats Bar */}
      <StatsBar stats={stats} darkMode={darkMode} />

      {/* Filter Bar */}
      <V2Card className="p-4 mb-8">
        {/* Row 1: Search + Status + Result count */}
        <div className="flex flex-wrap gap-3 items-center mb-3">
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
          <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
            {(['active', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? darkMode ? 'bg-[#1235e2] text-white shadow-sm font-semibold' : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                    : darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {s === 'active' ? 'Active' : 'All'}
              </button>
            ))}
          </div>
          <div className={`text-sm font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {pagination ? formatNumber(pagination.total) : '...'} results
          </div>
        </div>

        {/* Row 2: Filter dropdowns */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Industry/Category Filter */}
          <FilterDropdown
            label="Industry"
            icon={<Tag className="w-3.5 h-3.5" />}
            isOpen={openDropdown === 'category'}
            onToggle={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
            onClose={() => setOpenDropdown(null)}
            hasValue={!!categoryFilter}
            darkMode={darkMode}
          >
            <button
              onClick={() => { setCategoryFilter(''); setOpenDropdown(null); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                !categoryFilter ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Industries
            </button>
            {categories.map(c => (
              <button
                key={c.value}
                onClick={() => { setCategoryFilter(c.value); setOpenDropdown(null); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex justify-between ${
                  categoryFilter === c.value ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="capitalize">{c.value}</span>
                <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>{c.count}</span>
              </button>
            ))}
          </FilterDropdown>

          {/* Format Filter (multi-select) */}
          <FilterDropdown
            label="Format"
            icon={<Layers className="w-3.5 h-3.5" />}
            isOpen={openDropdown === 'format'}
            onToggle={() => setOpenDropdown(openDropdown === 'format' ? null : 'format')}
            onClose={() => setOpenDropdown(null)}
            hasValue={selectedFormats.size > 0}
            darkMode={darkMode}
          >
            {formatOptions.map(f => (
              <button
                key={f.value}
                onClick={() => toggleFormat(f.value)}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                  darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                  selectedFormats.has(f.value)
                    ? 'bg-[#1235e2] border-[#1235e2] text-white'
                    : darkMode ? 'border-slate-600' : 'border-slate-300'
                }`}>
                  {selectedFormats.has(f.value) && '✓'}
                </div>
                <span className="capitalize flex-1">{f.value}</span>
                <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>{formatNumber(f.count)}</span>
              </button>
            ))}
          </FilterDropdown>

          {/* Days Active Filter */}
          <FilterDropdown
            label="Days Active"
            icon={<Calendar className="w-3.5 h-3.5" />}
            isOpen={openDropdown === 'days'}
            onToggle={() => setOpenDropdown(openDropdown === 'days' ? null : 'days')}
            onClose={() => setOpenDropdown(null)}
            hasValue={!!daysActiveFilter}
            darkMode={darkMode}
          >
            <button
              onClick={() => { setDaysActiveFilter(null); setOpenDropdown(null); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                !daysActiveFilter ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Any Duration
            </button>
            {daysRanges.map(r => (
              <button
                key={r.label}
                onClick={() => { setDaysActiveFilter(r); setOpenDropdown(null); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  daysActiveFilter?.label === r.label ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </FilterDropdown>

          {/* Brand Filter */}
          <FilterDropdown
            label={categoryFilter ? topBrands.find(b => b.pageId === categoryFilter)?.pageName || 'Brand' : 'Brand'}
            icon={<Users className="w-3.5 h-3.5" />}
            isOpen={openDropdown === 'brand'}
            onToggle={() => setOpenDropdown(openDropdown === 'brand' ? null : 'brand')}
            onClose={() => setOpenDropdown(null)}
            hasValue={!!brandFilter}
            darkMode={darkMode}
          >
            <button
              onClick={() => { setBrandFilter(''); setOpenDropdown(null); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                !brandFilter ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              All Brands
            </button>
            {topBrands.map((brand, i) => (
              <button
                key={brand.id || brand.pageId}
                onClick={() => { setBrandFilter(brand.pageId); setOpenDropdown(null); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                  brandFilter === brand.pageId ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-[#1235e2]/10 text-[#1235e2]'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate">{brand.pageName}</span>
                <span className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {formatNumber(brand.activeAdCount)}
                </span>
              </button>
            ))}
          </FilterDropdown>

          {/* Hide Carousel toggle */}
          <button
            onClick={() => setHideCarousel(!hideCarousel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              hideCarousel
                ? 'bg-[#1235e2]/20 text-[#1235e2]'
                : darkMode
                  ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {hideCarousel ? 'Carousel hidden' : 'Show all formats'}
          </button>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <>
              <div className={`w-px h-6 mx-1 ${darkMode ? 'bg-[#1235e2]/20' : 'bg-slate-200'}`} />
              {brandFilter && (
                <FilterChip label={`Brand: ${topBrands.find(b => b.pageId === brandFilter)?.pageName || brandFilter}`} onRemove={() => setBrandFilter('')} darkMode={darkMode} />
              )}
              {categoryFilter && (
                <FilterChip label={`Industry: ${categoryFilter}`} onRemove={() => setCategoryFilter('')} darkMode={darkMode} />
              )}
              {selectedFormats.size > 0 && (
                <FilterChip label={`Format: ${Array.from(selectedFormats).join(', ')}`} onRemove={() => setSelectedFormats(new Set())} darkMode={darkMode} />
              )}
              {daysActiveFilter && (
                <FilterChip label={daysActiveFilter.label} onRemove={() => setDaysActiveFilter(null)} darkMode={darkMode} />
              )}
              <button
                onClick={clearAllFilters}
                className="text-xs text-[#1235e2] hover:underline font-medium"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      </V2Card>

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
              <AdCard key={ad.id} ad={ad} darkMode={darkMode} isSaved={savedAdIds.has(ad.id)} onToggleSave={toggleSaveAd} />
            ))}
          </div>
        )}

        {/* Pagination */}
        <AdPagination page={page} totalPages={totalPages} onPageChange={setPage} darkMode={darkMode} />
      </section>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLoginModal(false)}>
          <div
            className={`relative w-full max-w-sm mx-4 rounded-2xl p-6 shadow-2xl ${
              darkMode ? 'bg-[#161b2e] border border-[#1235e2]/20' : 'bg-white border border-slate-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowLoginModal(false)}
              className={`absolute top-3 right-3 p-1 rounded-lg transition-colors ${
                darkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                darkMode ? 'bg-[#1235e2]/20' : 'bg-[#1235e2]/10'
              }`}>
                <Heart className="w-6 h-6 text-[#1235e2]" />
              </div>
              <h3 className={`text-lg font-bold mb-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                Sign in to save ads
              </h3>
              <p className={`text-sm mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Create a free account to save ads and build your collection.
              </p>

              <form
                className="w-full space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                  const password = (form.elements.namedItem('password') as HTMLInputElement).value;
                  const res = await signIn('credentials', { email, password, redirect: false });
                  if (res?.ok) setShowLoginModal(false);
                }}
              >
                <input
                  name="email"
                  type="email"
                  placeholder="Email"
                  defaultValue="demo@example.com"
                  className={`w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors ${
                    darkMode
                      ? 'bg-[#101322] border-[#1235e2]/20 text-white placeholder-slate-500 focus:border-[#1235e2]'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#1235e2]'
                  }`}
                />
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  defaultValue="demo123"
                  className={`w-full px-3 py-2.5 rounded-lg text-sm border outline-none transition-colors ${
                    darkMode
                      ? 'bg-[#101322] border-[#1235e2]/20 text-white placeholder-slate-500 focus:border-[#1235e2]'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-[#1235e2]'
                  }`}
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-[#1235e2] text-white text-sm font-semibold hover:bg-[#0f2bc4] transition-colors flex items-center justify-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              </form>

              <p className={`text-xs mt-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Demo: demo@example.com / demo123
              </p>
            </div>
          </div>
        </div>
      )}
    </V2Shell>
  );
}
