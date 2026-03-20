'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import {
  BookOpen,
  X,
  Heart,
  LogIn,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton } from '../v2-shell';
import { useV2 } from '../v2-context';

// Extracted components & shared types
import { Ad, FilteredStats, TopBrand, PaginationData, FilterOption, DaysRange, SortField, GridDensity } from './types';
import { AdCard } from './components/ad-card';
import { FilterBar } from './components/filter-bar';
import { StatsStrip } from './components/stats-strip';
import { LoadMoreButton } from './components/load-more-button';
import { AdDetailLightbox } from './components/ad-detail-lightbox';
import { DemographicPeek } from './components/demographic-peek';
import { normalizeDemographicsJson, NormalizedDemographics } from '@/lib/demographics-normalizer';

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
  const [filteredStats, setFilteredStats] = useState<FilteredStats | null>(null);
  const [loadedAds, setLoadedAds] = useState<Ad[]>([]);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [topBrands, setTopBrands] = useState<TopBrand[]>([]);
  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter options from API
  const [categories, setCategories] = useState<FilterOption[]>([]);
  const [formatOptions, setFormatOptions] = useState<FilterOption[]>([]);
  const [daysRanges] = useState<DaysRange[]>([
    { label: 'Last 7 days', min: 0, max: 7 },
    { label: '7\u201330 days', min: 7, max: 30 },
    { label: '30\u201390 days', min: 30, max: 90 },
    { label: '90\u2013180 days', min: 90, max: 180 },
    { label: '180+ days', min: 180, max: undefined },
  ]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [adsLoading, setAdsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [hideCarousel, setHideCarousel] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [daysActiveFilter, setDaysActiveFilter] = useState<DaysRange | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>(urlBrandPageId);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');

  // Sort & display
  const [sortBy, setSortBy] = useState<SortField>('reachEstimate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [partnershipFilter, setPartnershipFilter] = useState<'all' | 'partnership' | 'non-partnership'>('all');
  const [gridDensity, setGridDensity] = useState<GridDensity>('standard');

  // Auth & saved ads
  const { data: session } = useSession();
  const [savedAdIds, setSavedAdIds] = useState<Set<string>>(new Set());
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  // Demographic peek state
  const [brandDemographics, setBrandDemographics] = useState<NormalizedDemographics | null>(null);
  const [demoCollapsed, setDemoCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('demographicPeekCollapsed') === 'true';
    }
    return false;
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleDemoCollapsed = useCallback(() => {
    setDemoCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('demographicPeekCollapsed', String(next));
      return next;
    });
  }, []);

  // Fetch demographics when brand filter changes (independent from ads)
  useEffect(() => {
    if (!brandFilter) {
      setBrandDemographics(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/ad-library/brands/${brandFilter}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return;
        if (data?.brand?.demographicsJson) {
          const normalized = normalizeDemographicsJson(data.brand.demographicsJson);
          setBrandDemographics(normalized);
        } else {
          setBrandDemographics(null);
        }
      })
      .catch(() => {
        if (!cancelled) setBrandDemographics(null);
      });
    return () => { cancelled = true; };
  }, [brandFilter]);

  // Fetch top brands + filter options on mount
  useEffect(() => {
    async function fetchInitial() {
      setLoading(true);
      setError(null);
      try {
        const [brandsRes, filtersRes] = await Promise.all([
          fetch('/api/ad-library/brands?page=1&limit=5&sortBy=activeAdCount&sortOrder=desc'),
          fetch('/api/ad-library/filters'),
        ]);
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
        console.error('Failed to fetch initial data:', err);
        setError('Failed to load ad library data.');
      } finally {
        setLoading(false);
      }
    }
    fetchInitial();
  }, []);

  // Build filter params shared by fetchAds and loadMore
  const buildFilterParams = useCallback((opts: { page: number; limit: number }) => {
    const params = new URLSearchParams({
      sortBy,
      sortOrder,
      limit: String(opts.limit),
      page: String(opts.page),
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
    if (partnershipFilter === 'partnership') {
      params.set('hasBylines', 'true');
    } else if (partnershipFilter === 'non-partnership') {
      params.set('hasBylines', 'false');
    }
    return params;
  }, [statusFilter, selectedFormats, hideCarousel, categoryFilter, brandFilter, daysActiveFilter, searchDebounce, sortBy, sortOrder, partnershipFilter]);

  // Fetch ads on initial load / filter change (replaces entire grid)
  const fetchAds = useCallback(async () => {
    setAdsLoading(true);
    try {
      const params = buildFilterParams({ page: 1, limit: 48 });
      const res = await fetch(`/api/ad-library/ads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedAds = data.ads || [];
        setLoadedAds(fetchedAds);
        setPagination(data.pagination || null);
        setHasMore(data.pagination?.hasNext ?? false);
        setNextPage(2);
        setFilteredStats(data.filteredStats || null);

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
            // Non-critical -- ignore
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch ads:', err);
    } finally {
      setAdsLoading(false);
    }
  }, [buildFilterParams]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Load more: append next batch to existing ads
  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const params = buildFilterParams({ page: nextPage, limit: 24 });
      const res = await fetch(`/api/ad-library/ads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const newAds = data.ads || [];
        setLoadedAds(prev => [...prev, ...newAds]);
        setHasMore(data.pagination?.hasNext ?? false);
        setNextPage(prev => prev + 1);
        setPagination(data.pagination);

        // Check saved status for new batch only
        if (newAds.length > 0) {
          try {
            const checkRes = await fetch('/api/ad-library/saved/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adIds: newAds.map((a: Ad) => a.id) }),
            });
            if (checkRes.ok) {
              const { savedAdIds: ids } = await checkRes.json();
              setSavedAdIds(prev => new Set([...prev, ...ids]));
            }
          } catch {
            // Non-critical -- ignore
          }
        }
      }
    } catch (err) {
      console.error('Failed to load more ads:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [buildFilterParams, nextPage]);

  const activeFilterCount = (selectedFormats.size > 0 ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (brandFilter ? 1 : 0) +
    (daysActiveFilter ? 1 : 0) +
    (partnershipFilter !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedFormats(new Set());
    setHideCarousel(true);
    setCategoryFilter('');
    setBrandFilter('');
    setDaysActiveFilter(null);
    setStatusFilter('active');
    setSearchQuery('');
    setPartnershipFilter('all');
    setSortBy('reachEstimate');
    setSortOrder('desc');
    setBrandDemographics(null);
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

  if (error && !filteredStats) {
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

  const gridClasses = gridDensity === 'compact'
    ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6';

  return (
    <V2Shell title="Ad Library">
      {/* Stats Strip */}
      <StatsStrip stats={filteredStats} loading={adsLoading} darkMode={darkMode} />

      {/* Filter Bar */}
      <FilterBar
        darkMode={darkMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortByChange={setSortBy}
        onSortOrderToggle={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        categories={categories}
        selectedFormats={selectedFormats}
        onToggleFormat={toggleFormat}
        formatOptions={formatOptions}
        daysActiveFilter={daysActiveFilter}
        onDaysActiveChange={setDaysActiveFilter}
        daysRanges={daysRanges}
        brandFilter={brandFilter}
        onBrandChange={setBrandFilter}
        topBrands={topBrands}
        hideCarousel={hideCarousel}
        onHideCarouselToggle={() => setHideCarousel(h => !h)}
        partnershipFilter={partnershipFilter}
        onPartnershipChange={setPartnershipFilter}
        gridDensity={gridDensity}
        onGridDensityChange={setGridDensity}
        resultCount={pagination?.total ?? null}
        activeFilterCount={activeFilterCount}
        onClearAll={clearAllFilters}
      />

      {/* Demographic Peek (brand filter active + brand has demographics) */}
      {brandDemographics && (
        <DemographicPeek
          demographics={brandDemographics}
          darkMode={darkMode}
          collapsed={demoCollapsed}
          onToggleCollapse={toggleDemoCollapsed}
        />
      )}

      {/* Ads Grid */}
      <section>
        <V2SectionTitle
          icon={<BookOpen className="w-5 h-5 text-[#1235e2]" />}
          action={
            <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Showing {loadedAds.length} of {(pagination?.total ?? 0).toLocaleString()}
            </span>
          }
        >
          Browse Ads
        </V2SectionTitle>

        {adsLoading ? (
          <div className={gridClasses}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`${gridDensity === 'compact' ? 'aspect-square' : 'aspect-[4/5]'} rounded-xl animate-pulse ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        ) : loadedAds.length === 0 ? (
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
          <div className={gridClasses}>
            {loadedAds.map((ad) => (
              <AdCard key={ad.id} ad={ad} darkMode={darkMode} isSaved={savedAdIds.has(ad.id)} onToggleSave={toggleSaveAd} onSelect={() => setSelectedAd(ad)} compact={gridDensity === 'compact'} />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !adsLoading && (
          <LoadMoreButton
            onClick={loadMore}
            loading={isLoadingMore}
            loadedCount={loadedAds.length}
            totalCount={pagination?.total ?? 0}
            darkMode={darkMode}
          />
        )}
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
      {/* Ad Detail Lightbox */}
      {selectedAd && (
        <AdDetailLightbox
          ad={selectedAd}
          darkMode={darkMode}
          isSaved={savedAdIds.has(selectedAd.id)}
          onToggleSave={toggleSaveAd}
          onClose={() => setSelectedAd(null)}
        />
      )}
    </V2Shell>
  );
}
