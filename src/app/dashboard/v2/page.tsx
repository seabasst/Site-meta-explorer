'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { TopPartnershipBrands } from '@/components/dashboard/top-partnership-brands';
import { DashboardFilters } from '@/components/dashboard/dashboard-filters';
import { ConfigManager } from '@/components/dashboard/config-manager';

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
// Inner Page (uses useSearchParams)
// ---------------------------------------------------------------------------

function DashboardContent() {
  const { darkMode } = useV2();
  const searchParams = useSearchParams();
  const [fastStats, setFastStats] = useState<AdLibraryStats | null>(null);
  const [fullStats, setFullStats] = useState<AdLibraryStats | null>(null);
  const [fastLoading, setFastLoading] = useState(true);
  const [fullLoading, setFullLoading] = useState(true);

  // Derive filter query string from URL params
  const filterQuery = useCallback(() => {
    const params = new URLSearchParams();
    const displayFormat = searchParams.get('displayFormat');
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const isActive = searchParams.get('isActive');

    if (displayFormat) params.set('displayFormat', displayFormat);
    if (category) params.set('category', category);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (isActive) params.set('isActive', isActive);

    return params.toString();
  }, [searchParams]);

  const fetchData = useCallback(async () => {
    const filters = filterQuery();
    const separator = filters ? '&' : '';

    // Phase 1: Fast stats for KPI cards
    setFastLoading(true);
    setFullLoading(true);

    try {
      const fastRes = await fetch(
        `/api/ad-library/stats?fast=true${separator}${filters}`
      );
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
      const fullRes = await fetch(
        `/api/ad-library/stats${filters ? `?${filters}` : ''}`
      );
      if (fullRes.ok) {
        setFullStats(await fullRes.json());
      }
    } catch (err) {
      console.error('Failed to fetch full stats:', err);
    } finally {
      setFullLoading(false);
    }
  }, [filterQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = fullStats || fastStats;

  // Derive categories and formats from stats for the filter dropdowns
  const categories = Array.from(
    new Set(
      (fullStats?.topBrandsByAdCount ?? fastStats?.topBrandsByAdCount ?? [])
        .map((b) => b.category)
        .filter((c): c is string => !!c)
    )
  ).sort();

  const formats = (fullStats?.adsByFormat ?? fastStats?.adsByFormat ?? [])
    .map((f) => f.format)
    .filter((f) => f !== 'unknown')
    .sort();

  return (
    <>
      {/* Filter Bar */}
      <DashboardFilters
        categories={categories}
        formats={formats}
        loading={fastLoading}
      />

      {/* Config Manager - save/load filter presets */}
      <div className="flex justify-end mb-6 -mt-4">
        <ConfigManager />
      </div>

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

          {/* Charts Row 2: Platform Breakdown */}
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
                <TopPartnershipBrands />
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Page (wrapped in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function DashboardV2Page() {
  return (
    <V2Shell title="Analytics Dashboard">
      <Suspense fallback={<V2Skeleton rows={4} />}>
        <DashboardContent />
      </Suspense>
    </V2Shell>
  );
}
