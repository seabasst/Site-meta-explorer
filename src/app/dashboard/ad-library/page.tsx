'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Database,
  TrendingUp,
  Users,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Download,
  FileJson,
  FileSpreadsheet,
  Search,
  Briefcase,
  Globe,
  Calendar,
} from 'lucide-react';

// Types matching the API response
interface BrandStatusCount {
  status: string;
  count: number;
}

interface AdFormatCount {
  format: string;
  count: number;
}

interface AdPlatformCount {
  platform: string;
  count: number;
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

interface IngestionJob {
  id: string;
  brandId: string;
  brandName: string;
  jobType: string;
  status: string;
  adsFetched: number;
  adsCreated: number;
  adsUpdated: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface AdLibraryStats {
  totalBrands: number;
  brandsByStatus: BrandStatusCount[];
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
  adsByFormat: AdFormatCount[];
  adsByPlatform: AdPlatformCount[];
  totalReach: string;
  avgReachPerAd: number;
  recentJobs: IngestionJob[];
  jobStats: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
  };
  topBrandsByAdCount: TopBrand[];
}

interface ReachByCountry {
  country: string;
  reach: number;
  adCount: number;
}

interface ReachByMonth {
  month: string;
  reach: number;
  adCount: number;
}

interface AnalyticsData {
  reachByCountry: ReachByCountry[];
  reachByMonth: ReachByMonth[];
  summary: {
    totalReach: number;
    totalAds: number;
    countriesTracked: number;
    monthsTracked: number;
  };
}

function formatNumber(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    completed: {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    running: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      icon: <RefreshCw className="w-3 h-3 animate-spin" />,
    },
    failed: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      icon: <XCircle className="w-3 h-3" />,
    },
    queued: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-400',
      icon: <Clock className="w-3 h-3" />,
    },
    active: {
      bg: 'bg-green-500/10',
      text: 'text-green-400',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    pending: {
      bg: 'bg-gray-500/10',
      text: 'text-gray-400',
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

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-green)]/10 flex items-center justify-center text-[var(--accent-green)]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function FormatChart({ data }: { data: AdFormatCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Ads by Format</h3>
      <div className="space-y-3">
        {data.slice(0, 5).map((item, i) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.format}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)] capitalize">{item.format}</span>
                <span className="text-[var(--text-muted)]">{formatNumber(item.count)}</span>
              </div>
              <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percentage}%`, backgroundColor: colors[i % colors.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlatformChart({ data }: { data: AdPlatformCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const platformIcons: Record<string, React.ReactNode> = {
    facebook: <span className="text-blue-500">f</span>,
    instagram: <span className="text-pink-500">IG</span>,
    messenger: <span className="text-blue-400">M</span>,
    audience_network: <span className="text-gray-400">AN</span>,
  };

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-4">Platform Distribution</h3>
      <div className="grid grid-cols-2 gap-3">
        {data.slice(0, 4).map((item) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.platform} className="bg-[var(--bg-tertiary)] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold">{platformIcons[item.platform] || item.platform[0].toUpperCase()}</span>
                <span className="text-xs text-[var(--text-muted)] capitalize">{item.platform.replace('_', ' ')}</span>
              </div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{percentage.toFixed(0)}%</p>
              <p className="text-xs text-[var(--text-muted)]">{formatNumber(item.count)} ads</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReachByCountryChart({ data }: { data: ReachByCountry[] }) {
  const maxReach = Math.max(...data.map(d => d.reach), 1);

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-[var(--accent-green)]" />
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Reach by Region</h3>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {data.slice(0, 15).map((item, i) => {
          const percentage = (item.reach / maxReach) * 100;
          return (
            <div key={item.country}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)] truncate max-w-[150px]" title={item.country}>
                  {item.country}
                </span>
                <span className="text-[var(--text-muted)]">{formatNumber(item.reach)}</span>
              </div>
              <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: `hsl(${160 - i * 8}, 70%, 50%)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {data.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">No region data available</p>
      )}
    </div>
  );
}

function ReachByMonthChart({ data }: { data: ReachByMonth[] }) {
  const maxReach = Math.max(...data.map(d => d.reach), 1);

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-[var(--accent-green)]" />
        <h3 className="text-sm font-medium text-[var(--text-primary)]">Reach by Month</h3>
      </div>
      <div className="flex items-end gap-1 h-40">
        {data.slice(-12).map((item, i) => {
          const height = (item.reach / maxReach) * 100;
          return (
            <div key={item.month} className="flex-1 flex flex-col items-center group">
              <div className="relative w-full flex justify-center mb-1">
                <div
                  className="w-full max-w-8 rounded-t transition-all duration-300 group-hover:opacity-80"
                  style={{
                    height: `${Math.max(height, 4)}%`,
                    backgroundColor: `hsl(160, 70%, ${50 + i * 2}%)`,
                  }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[var(--bg-secondary)] px-2 py-1 rounded text-xs text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg">
                  {formatNumber(item.reach)}
                </div>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] truncate w-full text-center">
                {formatMonth(item.month)}
              </span>
            </div>
          );
        })}
      </div>
      {data.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] text-center py-4">No monthly data available</p>
      )}
    </div>
  );
}

export default function AdLibraryDashboard() {
  const [stats, setStats] = useState<AdLibraryStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Only fetch stats - analytics is too slow, skip it for now
      const statsRes = await fetch('/api/ad-library/stats?fast=true');

      if (!statsRes.ok) throw new Error('Failed to fetch stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(true);
    setExportOpen(false);
    try {
      const url = `/api/ad-library/export?format=${format}&limit=10000`;
      const link = document.createElement('a');
      link.href = url;
      link.download = `ad-library-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 5 minutes (was 30s - too aggressive with large datasets)
    const interval = setInterval(fetchStats, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-[var(--bg-tertiary)] rounded" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-[var(--bg-tertiary)] rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-[var(--bg-tertiary)] rounded-xl" />
              <div className="h-64 bg-[var(--bg-tertiary)] rounded-xl" />
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
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-[var(--text-secondary)] mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="btn-primary px-4 py-2 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <div className="min-h-screen">
        {/* Navigation */}
        <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
                Ad Analyser
              </Link>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--accent-green-light)]">Ad Library</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Search link */}
              <Link
                href="/dashboard/ad-library/search"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                Search Ads
              </Link>
              {/* Jobs link */}
              <Link
                href="/dashboard/ad-library/jobs"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Briefcase className="w-3.5 h-3.5" />
                Jobs
              </Link>
              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setExportOpen(!exportOpen)}
                  disabled={exporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                >
                  {exporting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
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
              <button
                onClick={fetchStats}
                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href="/dashboard"
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl text-[var(--text-primary)] mb-1">Ad Library Pipeline</h1>
            <p className="text-sm text-[var(--text-muted)]">
              Meta Ad Library data ingestion and analysis
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Total Brands"
              value={stats.totalBrands}
              subtitle={`${stats.brandsByStatus.find(b => b.status === 'active')?.count || 0} active`}
              icon={<Users className="w-5 h-5" />}
            />
            <StatCard
              title="Total Ads"
              value={formatNumber(stats.totalAds)}
              subtitle={`${formatNumber(stats.activeAds)} currently active`}
              icon={<Database className="w-5 h-5" />}
            />
            <StatCard
              title="Total Reach"
              value={formatNumber(stats.totalReach)}
              subtitle={`~${formatNumber(stats.avgReachPerAd)} per ad`}
              icon={<TrendingUp className="w-5 h-5" />}
            />
            <StatCard
              title="Ingestion Jobs"
              value={stats.jobStats.completed}
              subtitle={`${stats.jobStats.running} running, ${stats.jobStats.failed} failed`}
              icon={<Play className="w-5 h-5" />}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <FormatChart data={stats.adsByFormat} />
            <PlatformChart data={stats.adsByPlatform} />
          </div>

          {/* Analytics Row - Reach by Country and Month */}
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <ReachByCountryChart data={analytics.reachByCountry} />
              <ReachByMonthChart data={analytics.reachByMonth} />
            </div>
          )}

          {/* Top Brands Table */}
          <div className="glass rounded-xl p-5 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Top Brands by Ad Volume</h3>
              <Link
                href="/dashboard/ad-library/brands"
                className="text-xs text-[var(--accent-green-light)] hover:text-[var(--text-primary)] flex items-center gap-1"
              >
                View All Brands <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] uppercase tracking-wide border-b border-[var(--border-subtle)]">
                    <th className="pb-3 font-medium">Brand</th>
                    <th className="pb-3 font-medium">Category</th>
                    <th className="pb-3 font-medium text-right">Total Ads</th>
                    <th className="pb-3 font-medium text-right">Active</th>
                    <th className="pb-3 font-medium text-right">Reach</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {stats.topBrandsByAdCount.map((brand) => (
                    <tr key={brand.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                      <td className="py-3">
                        <Link
                          href={`/dashboard/ad-library/${brand.pageId}`}
                          className="text-[var(--text-primary)] hover:text-[var(--accent-green-light)] font-medium"
                        >
                          {brand.pageName}
                        </Link>
                      </td>
                      <td className="py-3 text-[var(--text-muted)] capitalize">{brand.category || '-'}</td>
                      <td className="py-3 text-right text-[var(--text-secondary)]">{formatNumber(brand.adCount)}</td>
                      <td className="py-3 text-right text-[var(--text-secondary)]">{formatNumber(brand.activeAdCount)}</td>
                      <td className="py-3 text-right text-[var(--text-secondary)]">{formatNumber(brand.totalReach)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Jobs */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Recent Ingestion Jobs</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400" /> {stats.jobStats.completed} completed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> {stats.jobStats.running} running
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-400" /> {stats.jobStats.failed} failed
                  </span>
                </div>
                <Link
                  href="/dashboard/ad-library/jobs"
                  className="text-xs text-[var(--accent-green-light)] hover:text-[var(--text-primary)] flex items-center gap-1"
                >
                  View All Jobs <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] uppercase tracking-wide border-b border-[var(--border-subtle)]">
                    <th className="pb-3 font-medium">Brand</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Fetched</th>
                    <th className="pb-3 font-medium text-right">Created</th>
                    <th className="pb-3 font-medium">Started</th>
                    <th className="pb-3 font-medium">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {stats.recentJobs.slice(0, 10).map((job) => (
                    <tr key={job.id} className="hover:bg-[var(--bg-tertiary)]/50 transition-colors">
                      <td className="py-3 text-[var(--text-primary)]">{job.brandName}</td>
                      <td className="py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="py-3 text-right text-[var(--text-secondary)]">{formatNumber(job.adsFetched)}</td>
                      <td className="py-3 text-right text-[var(--text-secondary)]">{formatNumber(job.adsCreated)}</td>
                      <td className="py-3 text-[var(--text-muted)]">{formatDate(job.startedAt)}</td>
                      <td className="py-3 text-[var(--text-muted)]">{formatDate(job.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
