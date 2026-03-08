'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  HardDrive,
  Image as ImageIcon,
  Play,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
} from 'lucide-react';
import { V2Shell, V2Card, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

interface Overview {
  total: number;
  completed: number;
  pending: number;
  failed: number;
  downloading: number;
  pct: number;
  storageMB: number;
}

interface ByType {
  type: string;
  count: number;
  sizeMB: number;
}

interface Brand {
  brandId: string;
  pageName: string;
  completed: number;
  pending: number;
  failed: number;
  images: number;
  videos: number;
  sizeMB: number;
}

interface StatsData {
  r2Configured: boolean;
  overview: Overview;
  byType: ByType[];
  brands: Brand[];
}

export default function DownloadsPage() {
  const { darkMode } = useV2();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch('/api/ad-library/assets/stats');
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchData(), 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  if (loading) {
    return (
      <V2Shell title="Asset Downloads">
        <V2Skeleton rows={4} />
      </V2Shell>
    );
  }

  const o = data?.overview;
  const isRunning = (o?.downloading ?? 0) > 0 || (o?.pending ?? 0) > 0;

  return (
    <V2Shell title="Asset Downloads">
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isRunning
              ? 'bg-green-500/10 text-green-500'
              : 'bg-slate-500/10 text-slate-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`} />
            {isRunning ? 'Pipeline Active' : 'Idle'}
          </div>
          {autoRefresh && (
            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Auto-refreshing every 10s
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              autoRefresh
                ? 'bg-[#1235e2]/10 text-[#1235e2]'
                : darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <OverviewCard
          icon={<HardDrive className="w-5 h-5" />}
          label="Total Assets"
          value={formatNumber(o?.total ?? 0)}
          darkMode={darkMode}
        />
        <OverviewCard
          icon={<CheckCircle className="w-5 h-5 text-green-500" />}
          label="Completed"
          value={formatNumber(o?.completed ?? 0)}
          sub={`${o?.pct ?? 0}%`}
          darkMode={darkMode}
        />
        <OverviewCard
          icon={<Clock className="w-5 h-5 text-yellow-500" />}
          label="Pending"
          value={formatNumber(o?.pending ?? 0)}
          darkMode={darkMode}
        />
        <OverviewCard
          icon={<XCircle className="w-5 h-5 text-red-400" />}
          label="Failed"
          value={formatNumber(o?.failed ?? 0)}
          darkMode={darkMode}
        />
        <OverviewCard
          icon={<Download className="w-5 h-5 text-[#1235e2]" />}
          label="Storage"
          value={`${o?.storageMB ?? 0} MB`}
          darkMode={darkMode}
        />
      </div>

      {/* Progress Bar */}
      <V2Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">Overall Progress</h3>
          <span className="text-sm font-bold text-[#1235e2]">{o?.pct ?? 0}%</span>
        </div>
        <div className={`h-4 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
          <div
            className="h-full bg-[#1235e2] rounded-full transition-all duration-700 relative"
            style={{ width: `${o?.pct ?? 0}%` }}
          >
            {(o?.pct ?? 0) > 5 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {formatNumber(o?.completed ?? 0)} / {formatNumber(o?.total ?? 0)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-6 mt-3">
          {data?.byType.map((t) => (
            <div key={t.type} className="flex items-center gap-2 text-sm">
              {t.type === 'video' ? (
                <Play className="w-4 h-4 text-purple-400" />
              ) : (
                <ImageIcon className="w-4 h-4 text-emerald-400" />
              )}
              <span className="font-medium">{formatNumber(t.count)}</span>
              <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>
                {t.type}s ({t.sizeMB} MB)
              </span>
            </div>
          ))}
        </div>
      </V2Card>

      {/* Per-Brand Table */}
      <V2Card className="overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: darkMode ? 'rgba(18,53,226,0.1)' : 'rgb(226,232,240)' }}>
          <h3 className="text-base font-bold">Per-Brand Breakdown</h3>
          <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {data?.brands.length ?? 0} brands
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-left text-xs uppercase tracking-wide border-b ${
                darkMode ? 'text-slate-400 border-[#1235e2]/10' : 'text-slate-500 border-slate-100'
              }`}>
                <th className="px-6 py-3 font-bold">Brand</th>
                <th className="px-6 py-3 font-bold text-right">Images</th>
                <th className="px-6 py-3 font-bold text-right">Videos</th>
                <th className="px-6 py-3 font-bold text-right">Completed</th>
                <th className="px-6 py-3 font-bold text-right">Pending</th>
                <th className="px-6 py-3 font-bold text-right">Failed</th>
                <th className="px-6 py-3 font-bold text-right">Size</th>
                <th className="px-6 py-3 font-bold">Progress</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-[#1235e2]/10' : 'divide-slate-100'}`}>
              {data?.brands.map((brand) => {
                const brandTotal = brand.completed + brand.pending + brand.failed;
                const brandPct = brandTotal > 0 ? Math.round((brand.completed / brandTotal) * 100) : 0;
                return (
                  <tr key={brand.brandId} className={`transition-colors ${darkMode ? 'hover:bg-[#1235e2]/5' : 'hover:bg-slate-50'}`}>
                    <td className="px-6 py-3 font-medium">{brand.pageName}</td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-emerald-400" />
                        {formatNumber(brand.images)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className="inline-flex items-center gap-1">
                        <Play className="w-3 h-3 text-purple-400" />
                        {formatNumber(brand.videos)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-green-500 font-medium">{formatNumber(brand.completed)}</td>
                    <td className="px-6 py-3 text-right">
                      {brand.pending > 0 ? (
                        <span className="text-yellow-500">{formatNumber(brand.pending)}</span>
                      ) : (
                        <span className={darkMode ? 'text-slate-600' : 'text-slate-300'}>0</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {brand.failed > 0 ? (
                        <span className="text-red-400">{formatNumber(brand.failed)}</span>
                      ) : (
                        <span className={darkMode ? 'text-slate-600' : 'text-slate-300'}>0</span>
                      )}
                    </td>
                    <td className={`px-6 py-3 text-right ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {brand.sizeMB} MB
                    </td>
                    <td className="px-6 py-3 w-40">
                      <div className="flex items-center gap-2">
                        <div className={`flex-1 h-2 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              brandPct === 100 ? 'bg-green-500' : 'bg-[#1235e2]'
                            }`}
                            style={{ width: `${brandPct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium w-10 text-right ${
                          brandPct === 100 ? 'text-green-500' : darkMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {brandPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </V2Card>
    </V2Shell>
  );
}

function OverviewCard({
  icon,
  label,
  value,
  sub,
  darkMode,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  darkMode: boolean;
}) {
  return (
    <V2Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {label}
        </span>
        {icon}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-black">{value}</p>
        {sub && <span className="text-sm font-semibold text-[#1235e2]">{sub}</span>}
      </div>
    </V2Card>
  );
}
