'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdMedia } from '@/hooks/use-ad-media';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  Eye,
  Filter,
  Grid,
  List,
  Search,
  X,
  Play,
  Image as ImageIcon,
  Layers,
  Download,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  TrendingUp,
  ArrowUpDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Ad {
  id: string;
  adId: string;
  displayFormat: string;
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
}

interface ReachTimelinePoint {
  month: string;
  monthKey: string;
  adsStarted: number;
  totalReach: number;
  activeAds: number;
  inactiveAds: number;
}

interface FormatDistribution {
  format: string;
  count: number;
  reach: number;
  percentage: number;
}

interface ReachTimeline {
  timeline: ReachTimelinePoint[];
  summary: {
    totalAds: number;
    totalReach: number;
    avgReachPerAd: number;
    peakMonth: string;
    peakReach: number;
  };
  formatDistribution: FormatDistribution[];
}

interface Brand {
  id: string;
  pageId: string;
  pageName: string;
  category: string | null;
  website: string | null;
  totalReach: string;
  activeAdCount: number;
  ingestionStatus: string;
}

interface BrandResponse {
  brand: Brand;
  ads: Ad[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

function formatNumber(num: number | string | null): string {
  if (num === null) return '-';
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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

function FormatIcon({ format }: { format: string }) {
  switch (format) {
    case 'video':
      return <Play className="w-4 h-4" />;
    case 'carousel':
      return <Layers className="w-4 h-4" />;
    default:
      return <ImageIcon className="w-4 h-4" />;
  }
}

function AdCard({ ad, viewMode }: { ad: Ad; viewMode: 'grid' | 'list' }) {
  const [imageError, setImageError] = useState(false);
  const { mediaUrl, mediaType, isLoading } = useAdMedia(ad.adId, ad.snapshotUrl);

  if (viewMode === 'list') {
    return (
      <div className="glass rounded-lg p-4 flex gap-4 hover:bg-[var(--bg-tertiary)]/50 transition-colors">
        {/* Thumbnail */}
        <div className="w-24 h-24 rounded-lg bg-[var(--bg-tertiary)] flex-shrink-0 overflow-hidden">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[var(--accent-green)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : mediaUrl && !imageError ? (
            <a href={ad.snapshotUrl || '#'} target="_blank" rel="noopener noreferrer">
              <img
                src={mediaUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            </a>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
              <FormatIcon format={ad.displayFormat} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                ad.isActive
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-500/10 text-gray-400'
              }`}>
                {ad.isActive ? 'Active' : 'Inactive'}
              </span>
              <span className="px-2 py-0.5 rounded text-xs bg-[var(--bg-tertiary)] text-[var(--text-muted)] capitalize flex items-center gap-1">
                <FormatIcon format={ad.displayFormat} />
                {ad.displayFormat}
              </span>
            </div>
            {ad.snapshotUrl && (
              <a
                href={ad.snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--text-muted)] hover:text-[var(--accent-green-light)]"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>

          <p className="text-sm text-[var(--text-primary)] mb-2 line-clamp-2">
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
                {formatNumber(ad.reachEstimate)} reach
              </span>
            )}
            <span className="text-[var(--text-muted)]">
              {ad.publisherPlatforms.join(', ')}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div className="glass rounded-xl overflow-hidden hover:ring-1 hover:ring-[var(--accent-green)]/30 transition-all group">
      {/* Image/Preview Area */}
      <div className="aspect-square bg-[var(--bg-tertiary)] relative">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[var(--accent-green)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mediaUrl && !imageError ? (
          <a href={ad.snapshotUrl || '#'} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            {mediaType === 'video' ? (
              <video
                src={mediaUrl}
                className="w-full h-full object-cover"
                muted
                playsInline
                preload="metadata"
              />
            ) : (
              <img
                src={mediaUrl}
                alt={ad.title || 'Ad creative'}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            )}
          </a>
        ) : (
          <a href={ad.snapshotUrl || '#'} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
              <FormatIcon format={ad.displayFormat} />
              <span className="ml-2 text-sm">View Ad</span>
            </div>
          </a>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            ad.isActive
              ? 'bg-green-500/90 text-white'
              : 'bg-gray-500/90 text-white'
          }`}>
            {ad.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Format badge */}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 rounded text-xs bg-black/50 text-white flex items-center gap-1">
            <FormatIcon format={ad.displayFormat} />
            {ad.displayFormat}
          </span>
        </div>

        {/* External link on hover */}
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
        <p className="text-sm text-[var(--text-primary)] mb-3 line-clamp-3 min-h-[3.75rem]">
          {truncate(ad.body || ad.title || ad.caption || 'No text content', 120)}
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

        {ad.ctaText && (
          <div className="mt-2 pt-2 border-t border-[var(--border-subtle)]">
            <span className="text-xs text-[var(--accent-green-light)]">{ad.ctaText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BrandDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pageId = params.pageId as string;

  const [data, setData] = useState<BrandResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reachTimeline, setReachTimeline] = useState<ReachTimeline | null>(null);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterFormat, setFilterFormat] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('startDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 24;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      if (searchQuery) params.set('search', searchQuery);
      if (filterFormat) params.set('format', filterFormat);
      if (filterActive) params.set('isActive', filterActive);
      if (filterDateFrom) params.set('startDateFrom', filterDateFrom);
      if (filterDateTo) params.set('startDateTo', filterDateTo);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);

      const res = await fetch(`/api/ad-library/brands/${pageId}?${params}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Brand not found');
        throw new Error('Failed to fetch brand data');
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [pageId, page, pageSize, searchQuery, filterFormat, filterActive, filterDateFrom, filterDateTo, sortBy, sortOrder]);

  const fetchReachTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/ad-library/brands/${pageId}/reach-timeline?months=12`);
      if (res.ok) {
        const json = await res.json();
        setReachTimeline(json);
      }
    } catch (err) {
      // Silently fail - chart is optional
      console.error('Failed to fetch reach timeline:', err);
    }
  }, [pageId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchReachTimeline();
  }, [fetchReachTimeline]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/dashboard/ad-library/${pageId}?${params}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handlePageChange(1); // Reset to page 1 on search
    fetchData();
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterFormat('');
    setFilterActive('');
    setFilterDateFrom('');
    setFilterDateTo('');
    router.push(`/dashboard/ad-library/${pageId}`);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setExportOpen(false);
    try {
      const exportParams = new URLSearchParams({ format, pageId, limit: '10000' });
      if (searchQuery) exportParams.set('search', searchQuery);
      if (filterFormat) exportParams.set('displayFormat', filterFormat);
      if (filterActive) exportParams.set('isActive', filterActive);

      const url = `/api/ad-library/export?${exportParams}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `${brand?.pageName || 'brand'}-ads-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 bg-[var(--bg-tertiary)] rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-[var(--bg-tertiary)] rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="aspect-square bg-[var(--bg-tertiary)] rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-secondary)] mb-4">{error}</p>
          <Link href="/dashboard/ad-library" className="btn-primary px-4 py-2 text-sm">
            Back to Ad Library
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { brand, ads, pagination } = data;
  const hasFilters = searchQuery || filterFormat || filterActive || filterDateFrom || filterDateTo;

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
              <div>
                <h1 className="text-sm font-semibold text-[var(--text-primary)]">{brand.pageName}</h1>
                <p className="text-xs text-[var(--text-muted)] capitalize">{brand.category || 'Uncategorized'}</p>
              </div>
            </div>
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent-green-light)] hover:text-[var(--text-primary)] flex items-center gap-1"
              >
                {brand.website.replace(/^https?:\/\//, '').split('/')[0]}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Total Ads</p>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{formatNumber(pagination.total)}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Active Ads</p>
              <p className="text-2xl font-semibold text-green-400">{formatNumber(brand.activeAdCount)}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Total Reach</p>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">{formatNumber(brand.totalReach)}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-[var(--text-muted)] mb-1">Status</p>
              <p className="text-2xl font-semibold text-[var(--text-primary)] capitalize">{brand.ingestionStatus}</p>
            </div>
          </div>

          {/* Analytics Row */}
          {reachTimeline && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Reach Over Time Chart */}
              {reachTimeline.timeline.some(t => t.totalReach > 0) && (
                <div className="glass rounded-xl p-5 lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[var(--accent-green)]" />
                      <h3 className="text-sm font-medium text-[var(--text-primary)]">Reach Over Time</h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                      <span>Peak: {reachTimeline.summary.peakMonth} ({formatNumber(reachTimeline.summary.peakReach)})</span>
                    </div>
                  </div>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reachTimeline.timeline} barGap={0}>
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--border-subtle)' }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => {
                            if (value >= 1e9) return `${(value / 1e9).toFixed(0)}B`;
                            if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
                            if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
                            return value;
                          }}
                          width={45}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          formatter={(value, name) => [
                            formatNumber(Number(value) || 0),
                            name === 'totalReach' ? 'Total Reach' : name === 'adsStarted' ? 'Ads Started' : String(name),
                          ]}
                          labelStyle={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}
                        />
                        <Bar
                          dataKey="totalReach"
                          fill="var(--accent-green)"
                          radius={[4, 4, 0, 0]}
                          name="totalReach"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Format Distribution */}
              {reachTimeline.formatDistribution.length > 0 && (
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4 text-[var(--accent-green)]" />
                    <h3 className="text-sm font-medium text-[var(--text-primary)]">Ad Formats</h3>
                  </div>
                  <div className="space-y-3">
                    {reachTimeline.formatDistribution.slice(0, 5).map((item, i) => {
                      const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
                      return (
                        <div key={item.format}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[var(--text-secondary)] capitalize flex items-center gap-1.5">
                              <FormatIcon format={item.format} />
                              {item.format}
                            </span>
                            <span className="text-[var(--text-muted)]">{item.count} ({item.percentage}%)</span>
                          </div>
                          <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${item.percentage}%`, backgroundColor: colors[i % colors.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
                    <div className="text-xs text-[var(--text-muted)]">
                      Avg reach: {formatNumber(reachTimeline.summary.avgReachPerAd)} per ad
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search ad text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-80 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)]"
              />
            </form>

            <div className="flex items-center gap-2">
              {/* Sort dropdown */}
              <div className="flex items-center gap-1">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-2 py-2 text-xs text-[var(--text-secondary)]"
                >
                  <option value="startDate">Date</option>
                  <option value="reachEstimate">Reach</option>
                  <option value="createdAt">Added</option>
                  <option value="displayFormat">Format</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>

              {/* Filter toggle */}
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
                {hasFilters && (
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
                )}
              </button>

              {/* Export dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  {exporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Export
                </button>
                {exportOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setExportOpen(false)}
                    />
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

          {/* Filter panel */}
          {showFilters && (
            <div className="glass rounded-xl p-4 mb-6 flex flex-wrap gap-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Format</label>
                <select
                  value={filterFormat}
                  onChange={(e) => setFilterFormat(e.target.value)}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)]"
                >
                  <option value="">All formats</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="carousel">Carousel</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Status</label>
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value)}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)]"
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Start Date From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Start Date To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)]"
                />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="self-end text-xs text-red-400 hover:text-red-300 flex items-center gap-1 py-1.5"
                >
                  <X className="w-3 h-3" />
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Ads Grid/List */}
          {ads.length === 0 ? (
            <div className="glass rounded-xl p-12 text-center">
              <p className="text-[var(--text-muted)]">No ads found</p>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-4 text-sm text-[var(--accent-green-light)] hover:text-[var(--text-primary)]"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-3'
            }>
              {ads.map((ad) => (
                <AdCard key={ad.id} ad={ad} viewMode={viewMode} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= pagination.totalPages}
                className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <span className="ml-4 text-sm text-[var(--text-muted)]">
                Page {page} of {pagination.totalPages}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
