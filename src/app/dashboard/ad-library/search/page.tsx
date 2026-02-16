'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  Calendar,
  Eye,
  Play,
  Image as ImageIcon,
  Layers,
  ExternalLink,
  Grid,
  List,
  Download,
  FileSpreadsheet,
  FileJson,
  RefreshCw,
} from 'lucide-react';

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
  brand: {
    id: string;
    pageId: string;
    pageName: string;
    category: string | null;
  };
}

interface SearchResponse {
  ads: Ad[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

function formatNumber(num: number | null): string {
  if (num === null) return '-';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function truncate(str: string | null, len: number): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

function FormatIcon({ format }: { format: string | null }) {
  switch (format) {
    case 'video':
      return <Play className="w-4 h-4" />;
    case 'carousel':
      return <Layers className="w-4 h-4" />;
    default:
      return <ImageIcon className="w-4 h-4" />;
  }
}

function PlatformBadges({ platforms }: { platforms: string[] }) {
  const platformColors: Record<string, string> = {
    facebook: 'bg-blue-500/20 text-blue-400',
    instagram: 'bg-pink-500/20 text-pink-400',
    messenger: 'bg-purple-500/20 text-purple-400',
    audience_network: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="flex flex-wrap gap-1">
      {platforms.slice(0, 3).map((p) => (
        <span
          key={p}
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${platformColors[p] || 'bg-gray-500/20 text-gray-400'}`}
        >
          {p.replace('_', ' ')}
        </span>
      ))}
      {platforms.length > 3 && (
        <span className="px-1.5 py-0.5 rounded text-[10px] text-[var(--text-muted)]">
          +{platforms.length - 3}
        </span>
      )}
    </div>
  );
}

function AdCard({ ad, viewMode }: { ad: Ad; viewMode: 'grid' | 'list' }) {
  const [imageError, setImageError] = useState(false);

  if (viewMode === 'list') {
    return (
      <div className="glass rounded-lg p-4 flex gap-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors">
        {/* Thumbnail */}
        <div className="w-24 h-24 rounded-lg bg-[var(--bg-tertiary)] overflow-hidden shrink-0 relative">
          {ad.snapshotUrl && !imageError ? (
            <img
              src={ad.snapshotUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
              <FormatIcon format={ad.displayFormat} />
            </div>
          )}
          <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/50 text-white">
            {ad.displayFormat || 'unknown'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <Link
              href={`/dashboard/ad-library/${ad.brand.pageId}`}
              className="text-sm font-medium text-[var(--accent-green-light)] hover:text-[var(--text-primary)] truncate"
            >
              {ad.brand.pageName}
            </Link>
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-xs ${
                ad.isActive
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-500/10 text-gray-400'
              }`}
            >
              {ad.isActive ? 'Active' : 'Ended'}
            </span>
          </div>

          <p className="text-sm text-[var(--text-primary)] line-clamp-2 mb-2">
            {ad.body || ad.title || ad.caption || 'No text content'}
          </p>

          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(ad.startDate)}
            </span>
            {ad.reachEstimate && (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {formatNumber(ad.reachEstimate)}
              </span>
            )}
            <PlatformBadges platforms={ad.publisherPlatforms} />
          </div>
        </div>

        {/* Actions */}
        {ad.snapshotUrl && (
          <a
            href={ad.snapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    );
  }

  // Grid view
  return (
    <div className="glass rounded-xl overflow-hidden group">
      {/* Image */}
      <div className="aspect-square bg-[var(--bg-tertiary)] relative overflow-hidden">
        {ad.snapshotUrl && !imageError ? (
          <img
            src={ad.snapshotUrl}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
            <FormatIcon format={ad.displayFormat} />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          <span
            className={`px-2 py-0.5 rounded-full text-xs ${
              ad.isActive
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-500/20 text-gray-400'
            }`}
          >
            {ad.isActive ? 'Active' : 'Ended'}
          </span>
        </div>

        {/* Format badge */}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 rounded text-xs bg-black/50 text-white flex items-center gap-1">
            <FormatIcon format={ad.displayFormat} />
            {ad.displayFormat || 'unknown'}
          </span>
        </div>

        {/* Hover overlay */}
        {ad.snapshotUrl && (
          <a
            href={ad.snapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <span className="bg-white text-black px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
              <ExternalLink className="w-4 h-4" />
              View on Meta
            </span>
          </a>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <Link
          href={`/dashboard/ad-library/${ad.brand.pageId}`}
          className="text-xs font-medium text-[var(--accent-green-light)] hover:text-[var(--text-primary)] block mb-1"
        >
          {ad.brand.pageName}
        </Link>

        <p className="text-sm text-[var(--text-primary)] line-clamp-2 min-h-[2.5rem] mb-2">
          {truncate(ad.body || ad.title || ad.caption || 'No text content', 80)}
        </p>

        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(ad.startDate)}
          </span>
          {ad.reachEstimate && (
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {formatNumber(ad.reachEstimate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AdSearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [filterFormat, setFilterFormat] = useState(searchParams.get('displayFormat') || '');
  const [filterPlatform, setFilterPlatform] = useState(searchParams.get('publisherPlatforms') || '');
  const [filterActive, setFilterActive] = useState(searchParams.get('isActive') || '');
  const [filterDateFrom, setFilterDateFrom] = useState(searchParams.get('startDateFrom') || '');
  const [filterDateTo, setFilterDateTo] = useState(searchParams.get('startDateTo') || '');

  const [exportOpen, setExportOpen] = useState(false);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 24;

  const hasFilters = filterFormat || filterPlatform || filterActive || filterDateFrom || filterDateTo;
  const hasQuery = searchQuery.trim().length > 0;

  const fetchData = useCallback(async () => {
    if (!hasQuery && !hasFilters) {
      setData(null);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy: 'startDate',
        sortOrder: 'desc',
      });
      if (searchQuery) params.set('search', searchQuery);
      if (filterFormat) params.set('displayFormat', filterFormat);
      if (filterPlatform) params.set('publisherPlatforms', filterPlatform);
      if (filterActive) params.set('isActive', filterActive);
      if (filterDateFrom) params.set('startDateFrom', filterDateFrom);
      if (filterDateTo) params.set('startDateTo', filterDateTo);

      const res = await fetch(`/api/ad-library/ads?${params}`);
      if (!res.ok) throw new Error('Failed to search ads');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, filterFormat, filterPlatform, filterActive, filterDateFrom, filterDateTo, hasQuery, hasFilters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateURL = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`/dashboard/ad-library/search?${params}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateURL({ q: searchQuery, page: '1' });
  };

  const clearFilters = () => {
    setFilterFormat('');
    setFilterPlatform('');
    setFilterActive('');
    setFilterDateFrom('');
    setFilterDateTo('');
    updateURL({
      displayFormat: '',
      publisherPlatforms: '',
      isActive: '',
      startDateFrom: '',
      startDateTo: '',
      page: '1',
    });
  };

  const handleExport = (format: 'csv' | 'json') => {
    setExportOpen(false);
    const params = new URLSearchParams({ format, limit: '10000' });
    if (searchQuery) params.set('search', searchQuery);
    if (filterFormat) params.set('displayFormat', filterFormat);
    if (filterPlatform) params.set('publisherPlatforms', filterPlatform);
    if (filterActive) params.set('isActive', filterActive);
    if (filterDateFrom) params.set('startDateFrom', filterDateFrom);
    if (filterDateTo) params.set('startDateTo', filterDateTo);

    const link = document.createElement('a');
    link.href = `/api/ad-library/export?${params}`;
    link.download = `ad-search-${new Date().toISOString().split('T')[0]}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <div className="min-h-screen">
        {/* Navigation */}
        <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/ad-library"
                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-sm font-semibold text-[var(--text-primary)]">Search Ads</h1>
            </div>

            <div className="flex items-center gap-2">
              {/* Export dropdown */}
              {data && data.ads.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setExportOpen(!exportOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                  {exportOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                        <button
                          onClick={() => handleExport('csv')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                          Export CSV
                        </button>
                        <button
                          onClick={() => handleExport('json')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <FileJson className="w-4 h-4" />
                          Export JSON
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Search bar */}
          <div className="mb-6">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search ad copy, headlines, captions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-xl pl-12 pr-4 py-4 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)] text-lg"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    updateURL({ q: '' });
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-colors flex items-center gap-2 text-sm ${
                  showFilters || hasFilters
                    ? 'bg-[var(--accent-green)]/10 border-[var(--accent-green)] text-[var(--accent-green-light)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasFilters && <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />}
              </button>

              {data && (
                <span className="text-sm text-[var(--text-muted)]">
                  {data.pagination.total.toLocaleString()} results
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-[var(--accent-green)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-[var(--accent-green)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="glass rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Format</label>
                  <select
                    value={filterFormat}
                    onChange={(e) => {
                      setFilterFormat(e.target.value);
                      updateURL({ displayFormat: e.target.value, page: '1' });
                    }}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">All formats</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="carousel">Carousel</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Platform</label>
                  <select
                    value={filterPlatform}
                    onChange={(e) => {
                      setFilterPlatform(e.target.value);
                      updateURL({ publisherPlatforms: e.target.value, page: '1' });
                    }}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">All platforms</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="messenger">Messenger</option>
                    <option value="audience_network">Audience Network</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Status</label>
                  <select
                    value={filterActive}
                    onChange={(e) => {
                      setFilterActive(e.target.value);
                      updateURL({ isActive: e.target.value, page: '1' });
                    }}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <option value="">All</option>
                    <option value="true">Active</option>
                    <option value="false">Ended</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">From Date</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => {
                      setFilterDateFrom(e.target.value);
                      updateURL({ startDateFrom: e.target.value, page: '1' });
                    }}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">To Date</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => {
                      setFilterDateTo(e.target.value);
                      updateURL({ startDateTo: e.target.value, page: '1' });
                    }}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {hasFilters && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                  <button
                    onClick={clearFilters}
                    className="text-xs text-[var(--accent-green-light)] hover:text-[var(--text-primary)]"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 text-[var(--accent-green)] animate-spin" />
            </div>
          )}

          {/* Empty state - no search yet */}
          {!loading && !data && !error && (
            <div className="glass rounded-xl p-12 text-center">
              <Search className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">Search Ad Creatives</h2>
              <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                Search across {formatNumber(87000)}+ ads from {formatNumber(54)} brands.
                Find ads by copy, headlines, or apply filters to narrow results.
              </p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="glass rounded-xl p-6 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button onClick={fetchData} className="btn-primary px-4 py-2 text-sm">
                Try Again
              </button>
            </div>
          )}

          {/* Results */}
          {!loading && data && (
            <>
              {data.ads.length === 0 ? (
                <div className="glass rounded-xl p-12 text-center">
                  <Search className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)]">No ads found</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    Try different keywords or adjust your filters
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                        : 'space-y-3'
                    }
                  >
                    {data.ads.map((ad) => (
                      <AdCard key={ad.id} ad={ad} viewMode={viewMode} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {data.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-8">
                      <button
                        onClick={() => updateURL({ page: (page - 1).toString() })}
                        disabled={!data.pagination.hasPrev}
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>

                      <span className="px-4 py-2 text-sm text-[var(--text-secondary)]">
                        Page {data.pagination.page} of {data.pagination.totalPages}
                      </span>

                      <button
                        onClick={() => updateURL({ page: (page + 1).toString() })}
                        disabled={!data.pagination.hasNext}
                        className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function SearchPageLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-12 w-full bg-[var(--bg-tertiary)] rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="aspect-square bg-[var(--bg-tertiary)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdSearchPage() {
  return (
    <Suspense fallback={<SearchPageLoading />}>
      <AdSearchPageContent />
    </Suspense>
  );
}
