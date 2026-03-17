'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  TrendingUp,
  Users,
  Globe,
} from 'lucide-react';
import { V2Shell, V2Card, V2Skeleton, formatNumber } from './v2-shell';
import { useV2 } from './v2-context';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { FormatDistributionChart } from '@/components/dashboard/format-distribution-chart';
import { AdsTimelineChart } from '@/components/dashboard/ads-timeline-chart';
import { PlatformBreakdownChart } from '@/components/dashboard/platform-breakdown-chart';
import { TopBrandsTable } from '@/components/dashboard/top-brands-table';

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
  adsByDate: { date: string; count: number; activeCount: number }[];
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardV2Page() {
  const { darkMode } = useV2();
  const [fastStats, setFastStats] = useState<AdLibraryStats | null>(null);
  const [fullStats, setFullStats] = useState<AdLibraryStats | null>(null);
  const [fastLoading, setFastLoading] = useState(true);
  const [fullLoading, setFullLoading] = useState(true);

  const fetchData = useCallback(async () => {
    // Phase 1: Fast stats for KPI cards
    setFastLoading(true);
    setFullLoading(true);

    try {
      const fastRes = await fetch('/api/ad-library/stats?fast=true');
      if (fastRes.ok) {
        setFastStats(await fastRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch fast stats:', err);
    } finally {
      setFastLoading(false);
    }

    // Phase 2: Full stats for charts and tables
    try {
      const fullRes = await fetch('/api/ad-library/stats');
      if (fullRes.ok) {
        setFullStats(await fullRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch full stats:', err);
    } finally {
      setFullLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = fullStats || fastStats;

  return (
    <V2Shell title="Analytics Dashboard">
      {fastLoading ? (
        <V2Skeleton rows={4} />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KpiCard
              label="Total Ads"
              value={stats?.totalAds ?? 0}
              icon={Database}
            />
            <KpiCard
              label="Active Ads"
              value={stats?.activeAds ?? 0}
              icon={TrendingUp}
            />
            <KpiCard
              label="Total Brands"
              value={stats?.totalBrands ?? 0}
              icon={Users}
            />
            <KpiCard
              label="Total Reach"
              value={
                fullStats
                  ? formatNumber(fullStats.totalReach)
                  : '...'
              }
              icon={Globe}
            />
          </div>

          {/* Charts Row 1: Timeline + Format Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {fullLoading ? (
              <>
                <V2Skeleton rows={1} />
                <V2Skeleton rows={1} />
              </>
            ) : (
              <>
                <AdsTimelineChart data={fullStats?.adsByDate ?? []} />
                <FormatDistributionChart
                  data={fullStats?.adsByFormat ?? []}
                />
              </>
            )}
          </div>

          {/* Charts Row 2: Platform Breakdown + Placeholder */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {fullLoading ? (
              <>
                <V2Skeleton rows={1} />
                <V2Skeleton rows={1} />
              </>
            ) : (
              <>
                <PlatformBreakdownChart
                  data={fullStats?.adsByPlatform ?? []}
                />
                <V2Card className="p-6 flex items-center justify-center">
                  <div className="text-center">
                    <p
                      className={`text-sm font-medium ${
                        darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      Filters coming soon
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        darkMode ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Date range, brand, and format filters
                    </p>
                  </div>
                </V2Card>
              </>
            )}
          </div>

          {/* Top Brands Table */}
          {fullLoading ? (
            <V2Skeleton rows={2} />
          ) : fullStats &&
            fullStats.topBrandsByAdCount.length > 0 ? (
            <TopBrandsTable data={fullStats.topBrandsByAdCount} />
          ) : null}
        </>
      )}
    </V2Shell>
  );
}
