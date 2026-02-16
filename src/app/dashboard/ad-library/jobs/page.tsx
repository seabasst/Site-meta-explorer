'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Play,
  Filter,
  RotateCcw,
  ExternalLink,
  Activity,
  Calendar,
  FileText,
  ArrowUpDown,
} from 'lucide-react';

interface IngestionJob {
  id: string;
  brandId: string;
  brandName: string;
  brandPageId: string;
  jobType: string;
  status: string;
  adsFetched: number;
  adsCreated: number;
  adsUpdated: number;
  assetsQueued: number;
  assetsDownloaded: number;
  assetsFailed: number;
  errorMessage: string | null;
  errorsJson: string[] | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface JobsResponse {
  jobs: IngestionJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '-';
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    completed: {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      icon: <CheckCircle className="w-3.5 h-3.5" />,
    },
    running: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
    },
    failed: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    queued: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      icon: <Clock className="w-3.5 h-3.5" />,
    },
  };

  const { bg, text, icon } = config[status] || config.queued;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      {icon}
      {status}
    </span>
  );
}

function JobCard({ job, onRetry }: { job: IngestionJob; onRetry: (brandId: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-[var(--bg-tertiary)]/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/dashboard/ad-library/${job.brandPageId}`}
                className="font-medium text-[var(--text-primary)] hover:text-[var(--accent-green-light)]"
                onClick={(e) => e.stopPropagation()}
              >
                {job.brandName}
              </Link>
              <StatusBadge status={job.status} />
            </div>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(job.startedAt || job.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(job.startedAt, job.completedAt)}
              </span>
              <span className="capitalize">{job.jobType}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {job.adsFetched.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--text-muted)]">ads fetched</p>
            </div>

            {job.status === 'failed' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(job.brandId);
                }}
                className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-green)] transition-colors"
                title="Queue for retry"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--border-subtle)] pt-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">Fetched</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{job.adsFetched.toLocaleString()}</p>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">Created</p>
              <p className="text-lg font-semibold text-green-400">{job.adsCreated.toLocaleString()}</p>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">Updated</p>
              <p className="text-lg font-semibold text-blue-400">{job.adsUpdated.toLocaleString()}</p>
            </div>
            <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">Duration</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatDuration(job.startedAt, job.completedAt)}
              </p>
            </div>
          </div>

          {/* Error message */}
          {job.errorMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs text-red-400 font-medium mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Error
              </p>
              <p className="text-sm text-red-300">{job.errorMessage}</p>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-6 text-xs text-[var(--text-muted)]">
            <span>Created: {formatDate(job.createdAt)}</span>
            {job.startedAt && <span>Started: {formatDate(job.startedAt)}</span>}
            {job.completedAt && <span>Completed: {formatDate(job.completedAt)}</span>}
          </div>

          {/* Links */}
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/ad-library/${job.brandPageId}`}
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
            >
              <FileText className="w-3 h-3" />
              View Brand
            </Link>
            <a
              href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${job.brandPageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Meta Ad Library
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function JobsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [showFilters, setShowFilters] = useState(false);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/ad-library/jobs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const updateURL = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`/dashboard/ad-library/jobs?${params}`);
  };

  const handleRetry = async (brandId: string) => {
    try {
      const res = await fetch('/api/ad-library/brands', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids: [brandId],
          updates: { ingestionStatus: 'pending' },
        }),
      });
      if (!res.ok) throw new Error('Failed to queue retry');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to queue retry');
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-[var(--bg-tertiary)] rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 bg-[var(--bg-tertiary)] rounded-xl" />
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[var(--bg-tertiary)] rounded-xl" />
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
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/ad-library"
                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-sm font-semibold text-[var(--text-primary)]">Ingestion Jobs</h1>
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
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Stats */}
          {data && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-green)]/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-[var(--accent-green)]" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Total</p>
                  <p className="text-lg font-semibold text-[var(--text-primary)]">{data.stats.total}</p>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Completed</p>
                  <p className="text-lg font-semibold text-green-400">{data.stats.completed}</p>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Running</p>
                  <p className="text-lg font-semibold text-blue-400">{data.stats.running}</p>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Failed</p>
                  <p className="text-lg font-semibold text-red-400">{data.stats.failed}</p>
                </div>
              </div>
              <div className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Queued</p>
                  <p className="text-lg font-semibold text-yellow-400">{data.stats.queued}</p>
                </div>
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg border transition-colors flex items-center gap-2 text-sm ${
                showFilters || statusFilter
                  ? 'bg-[var(--accent-green)]/10 border-[var(--accent-green)] text-[var(--accent-green-light)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="glass rounded-xl p-4 mb-4">
              <div className="flex items-center gap-4">
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
                    <option value="completed">Completed</option>
                    <option value="running">Running</option>
                    <option value="failed">Failed</option>
                    <option value="queued">Queued</option>
                  </select>
                </div>
                {statusFilter && (
                  <button
                    onClick={() => {
                      setStatusFilter('');
                      updateURL({ status: '', page: '1' });
                    }}
                    className="self-end text-xs text-[var(--accent-green-light)] hover:text-[var(--text-primary)]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="glass rounded-xl p-6 text-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p className="text-[var(--text-secondary)]">{error}</p>
              <button onClick={fetchData} className="mt-4 btn-primary px-4 py-2 text-sm">
                Try Again
              </button>
            </div>
          )}

          {/* Jobs list */}
          {data && !error && (
            <>
              {data.jobs.length === 0 ? (
                <div className="glass rounded-xl p-12 text-center">
                  <Activity className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)]">No jobs found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.jobs.map((job) => (
                    <JobCard key={job.id} job={job} onRetry={handleRetry} />
                  ))}
                </div>
              )}

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
        </div>
      </div>
    </>
  );
}

function JobsPageLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--bg-tertiary)] rounded" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-[var(--bg-tertiary)] rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-[var(--bg-tertiary)] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<JobsPageLoading />}>
      <JobsPageContent />
    </Suspense>
  );
}
