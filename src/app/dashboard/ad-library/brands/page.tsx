'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  MoreVertical,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ArrowUpDown,
  Users,
  TrendingUp,
  Database,
} from 'lucide-react';

interface Brand {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  country: string | null;
  category: string | null;
  website: string | null;
  totalReach: string;
  activeAdCount: number;
  lastCheckedAt: string | null;
  ingestionStatus: string;
  priority: number;
  createdAt: string;
}

interface BrandsResponse {
  brands: Brand[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
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
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    active: {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    failed: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      icon: <XCircle className="w-3 h-3" />,
    },
    pending: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      icon: <Clock className="w-3 h-3" />,
    },
    paused: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      icon: <AlertCircle className="w-3 h-3" />,
    },
  };

  const { bg, text, icon } = config[status] || config.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {icon}
      {status}
    </span>
  );
}

function BrandActions({
  brand,
  onStatusChange,
  onDelete,
}: {
  brand: Brand;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg shadow-lg overflow-hidden min-w-[160px]">
            {brand.ingestionStatus === 'failed' && (
              <button
                onClick={() => {
                  onStatusChange(brand.id, 'pending');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Ingestion
              </button>
            )}
            {brand.ingestionStatus === 'active' && (
              <button
                onClick={() => {
                  onStatusChange(brand.id, 'paused');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            {brand.ingestionStatus === 'paused' && (
              <button
                onClick={() => {
                  onStatusChange(brand.id, 'active');
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Play className="w-4 h-4" />
                Resume
              </button>
            )}
            <a
              href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${brand.pageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              onClick={() => setOpen(false)}
            >
              <ExternalLink className="w-4 h-4" />
              View on Meta
            </a>
            <button
              onClick={() => {
                if (confirm(`Delete ${brand.pageName}? This will remove all ads and data.`)) {
                  onDelete(brand.id);
                }
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BrandsListPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<BrandsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'priority');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [showFilters, setShowFilters] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 25;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/ad-library/brands?${params}`);
      if (!res.ok) throw new Error('Failed to fetch brands');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, searchQuery, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateURL = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`/dashboard/ad-library/brands?${params}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateURL({ search: searchQuery, page: '1' });
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      setSortOrder(newOrder);
      updateURL({ sortOrder: newOrder });
    } else {
      setSortBy(field);
      setSortOrder('desc');
      updateURL({ sortBy: field, sortOrder: 'desc' });
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch('/api/ad-library/brands', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [id], updates: { ingestionStatus: newStatus } }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async (pageId: string) => {
    try {
      const brand = data?.brands.find(b => b.id === pageId);
      if (!brand) return;

      const res = await fetch(`/api/ad-library/brands/${brand.pageId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete brand');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete brand');
    }
  };

  const handleBulkAction = async (action: 'retry' | 'pause' | 'resume' | 'delete') => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);

    try {
      if (action === 'delete') {
        if (!confirm(`Delete ${selectedIds.size} brands? This cannot be undone.`)) {
          setBulkActionLoading(false);
          return;
        }
        // Delete one by one (API doesn't support bulk delete)
        for (const id of selectedIds) {
          const brand = data?.brands.find(b => b.id === id);
          if (brand) {
            await fetch(`/api/ad-library/brands/${brand.pageId}`, { method: 'DELETE' });
          }
        }
      } else {
        const statusMap = { retry: 'pending', pause: 'paused', resume: 'active' };
        await fetch('/api/ad-library/brands', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: Array.from(selectedIds),
            updates: { ingestionStatus: statusMap[action] },
          }),
        });
      }
      setSelectedIds(new Set());
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data) return;
    if (selectedIds.size === data.brands.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.brands.map(b => b.id)));
    }
  };

  // Get unique categories for filter
  const categories = data?.brands
    ? [...new Set(data.brands.map(b => b.category).filter(Boolean))]
    : [];

  // Calculate status counts
  const statusCounts = data?.brands.reduce((acc, b) => {
    acc[b.ingestionStatus] = (acc[b.ingestionStatus] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-[var(--bg-tertiary)] rounded" />
            <div className="h-12 bg-[var(--bg-tertiary)] rounded-lg" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
              <h1 className="text-sm font-semibold text-[var(--text-primary)]">All Brands</h1>
              {data && (
                <span className="text-xs text-[var(--text-muted)]">
                  ({data.pagination.total} total)
                </span>
              )}
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {statusCounts['failed'] > 0 && (
              <button
                onClick={async () => {
                  if (!confirm(`Retry all ${statusCounts['failed']} failed brands?`)) return;
                  try {
                    const failedBrands = data?.brands.filter(b => b.ingestionStatus === 'failed');
                    if (failedBrands && failedBrands.length > 0) {
                      await fetch('/api/ad-library/brands', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          ids: failedBrands.map(b => b.id),
                          updates: { ingestionStatus: 'pending' },
                        }),
                      });
                      fetchData();
                    }
                  } catch (err) {
                    alert('Failed to retry brands');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 text-xs transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Retry {statusCounts['failed']} Failed
              </button>
            )}
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats row */}
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-green)]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[var(--accent-green)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Total</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{data.pagination.total}</p>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Active</p>
                  <p className="text-lg font-semibold text-green-400">{statusCounts['active'] || 0}</p>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Failed</p>
                  <p className="text-lg font-semibold text-red-400">{statusCounts['failed'] || 0}</p>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Pending</p>
                  <p className="text-lg font-semibold text-yellow-400">{statusCounts['pending'] || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <form onSubmit={handleSearch} className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-80 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg pl-10 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)]"
              />
            </form>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg border transition-colors flex items-center gap-2 text-sm ${
                  showFilters || statusFilter || categoryFilter
                    ? 'bg-[var(--accent-green)]/10 border-[var(--accent-green)] text-[var(--accent-green-light)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="glass rounded-xl p-4 mb-4 flex flex-wrap gap-4">
              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    updateURL({ status: e.target.value, page: '1' });
                  }}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)]"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    updateURL({ category: e.target.value, page: '1' });
                  }}
                  className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 text-sm text-[var(--text-primary)]"
                >
                  <option value="">All categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat!}>{cat}</option>
                  ))}
                </select>
              </div>

              {(statusFilter || categoryFilter) && (
                <button
                  onClick={() => {
                    setStatusFilter('');
                    setCategoryFilter('');
                    updateURL({ status: '', category: '', page: '1' });
                  }}
                  className="self-end text-xs text-[var(--accent-green-light)] hover:text-[var(--text-primary)]"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="glass rounded-xl p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction('retry')}
                  disabled={bulkActionLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3 inline mr-1" />
                  Retry
                </button>
                <button
                  onClick={() => handleBulkAction('pause')}
                  disabled={bulkActionLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  <Pause className="w-3 h-3 inline mr-1" />
                  Pause
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  disabled={bulkActionLoading}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3 inline mr-1" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="glass rounded-xl p-6 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-[var(--text-secondary)]">{error}</p>
              <button onClick={fetchData} className="mt-4 btn-primary px-4 py-2 text-sm">
                Try Again
              </button>
            </div>
          )}

          {/* Brands table */}
          {data && !error && (
            <div className="glass rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === data.brands.length && data.brands.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-[var(--border-medium)]"
                      />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Brand</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-muted)]">Status</th>
                    <th
                      className="text-right px-4 py-3 font-medium text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]"
                      onClick={() => handleSort('activeAdCount')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Ads
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="text-right px-4 py-3 font-medium text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]"
                      onClick={() => handleSort('totalReach')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Reach
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th
                      className="text-left px-4 py-3 font-medium text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]"
                      onClick={() => handleSort('lastCheckedAt')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Last Check
                        <ArrowUpDown className="w-3 h-3" />
                      </span>
                    </th>
                    <th className="w-10 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {data.brands.map((brand) => (
                    <tr
                      key={brand.id}
                      className={`hover:bg-[var(--bg-tertiary)]/50 transition-colors ${
                        selectedIds.has(brand.id) ? 'bg-[var(--accent-green)]/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(brand.id)}
                          onChange={() => toggleSelect(brand.id)}
                          className="rounded border-[var(--border-medium)]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/ad-library/${brand.pageId}`}
                          className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-green-light)]"
                        >
                          {brand.pageName}
                        </Link>
                        {brand.website && (
                          <p className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">
                            {brand.website.replace(/^https?:\/\//, '').split('/')[0]}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)] capitalize">
                        {brand.category || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={brand.ingestionStatus} />
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                        {formatNumber(brand.activeAdCount)}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                        {formatNumber(brand.totalReach)}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {formatDate(brand.lastCheckedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <BrandActions
                          brand={brand}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
                  <p className="text-xs text-[var(--text-muted)]">
                    Showing {(data.pagination.page - 1) * limit + 1} to{' '}
                    {Math.min(data.pagination.page * limit, data.pagination.total)} of{' '}
                    {data.pagination.total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateURL({ page: (page - 1).toString() })}
                      disabled={!data.pagination.hasPrev}
                      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 text-sm text-[var(--text-secondary)]">
                      {data.pagination.page} / {data.pagination.totalPages}
                    </span>
                    <button
                      onClick={() => updateURL({ page: (page + 1).toString() })}
                      disabled={!data.pagination.hasNext}
                      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {data && data.brands.length === 0 && (
            <div className="glass rounded-xl p-12 text-center">
              <Database className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
              <p className="text-[var(--text-secondary)] mb-2">No brands found</p>
              <p className="text-sm text-[var(--text-muted)]">
                {searchQuery || statusFilter || categoryFilter
                  ? 'Try adjusting your filters'
                  : 'Add some brands to get started'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function BrandsPageLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[var(--bg-tertiary)] rounded" />
          <div className="h-12 bg-[var(--bg-tertiary)] rounded-lg" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrandsListPage() {
  return (
    <Suspense fallback={<BrandsPageLoading />}>
      <BrandsListPageContent />
    </Suspense>
  );
}
