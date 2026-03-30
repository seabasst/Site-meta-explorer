'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Zap,
  Eye,
  Building2,
  Plus,
  ArrowRight,
  Clock,
  Sparkles,
  BarChart3,
  Users,
  ExternalLink,
} from 'lucide-react';
import { V2Shell, V2Card, V2Skeleton, formatNumber } from './v2-shell';
import { useV2 } from './v2-context';
import { KpiCard } from '@/components/dashboard/kpi-card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Brand {
  id: string;
  pageId: string;
  name: string;
  profilePic: string | null;
  category: string | null;
  activeAds: number;
  totalReach: number;
}

interface FeedItem {
  id: string;
  adId: string;
  format: string | null;
  body: string | null;
  title: string | null;
  startDate: string | null;
  isActive: boolean;
  reach: number | null;
  brand: {
    id: string;
    name: string;
    pageId: string;
    profilePic: string | null;
    category: string | null;
  };
}

interface TopAd {
  id: string;
  adId: string;
  format: string | null;
  body: string | null;
  title: string | null;
  startDate: string | null;
  reach: number | null;
  snapshotUrl: string | null;
  mediaUrl: string | null;
  mediaType: string;
  brand: {
    id: string;
    name: string;
    pageId: string;
    profilePic: string | null;
  };
}

interface Creator {
  id: string;
  pageId: string;
  name: string;
  totalAds: number;
  brandCount: number;
  tier: string | null;
  score: number | null;
  type: string | null;
  topBrands: {
    name: string;
    pageId: string;
    profilePic: string | null;
    adCount: number;
    sampleMedia: string | null;
  }[];
}

interface CategoryTrend {
  category: string;
  brands: number;
  activeAds: number;
  totalReach: number;
}

interface DashboardData {
  authenticated: boolean;
  hasMonitored: boolean;
  kpis: {
    newAds: number;
    newAdsTrend: number;
    activeAds: number;
    activeAdsTrend: number;
    totalReach: number;
    totalReachTrend: number;
    brandCount: number;
  };
  activityFeed: FeedItem[];
  topAds: TopAd[];
  creatorSpotlight: Creator[];
  industryTrends: CategoryTrend[];
  monitoredBrands: Brand[];
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatReach(n: number | null): string {
  if (!n) return '—';
  return formatNumber(n);
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ darkMode }: { darkMode: boolean }) {
  return (
    <V2Card className="p-12 text-center">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-2xl bg-[#1235e2]/10 flex items-center justify-center">
          <Building2 className="w-8 h-8 text-[#1235e2]" />
        </div>
      </div>
      <h2 className="text-xl font-bold mb-2">Your competitive dashboard</h2>
      <p className={`mb-6 max-w-md mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Start monitoring brands to see their latest ads, performance trends, creator partnerships,
        and industry benchmarks — all in one place.
      </p>
      <Link
        href="/dashboard/v2/brands"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1235e2] text-white font-medium hover:bg-[#0f2ec0] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Browse brands to monitor
      </Link>
    </V2Card>
  );
}

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------

function ActivityFeed({
  items,
  darkMode,
}: {
  items: FeedItem[];
  darkMode: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <V2Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#1235e2]" />
          Activity Feed
        </h3>
        <Link
          href="/dashboard/v2/ad-library"
          className="text-xs text-[#1235e2] hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
            }`}
          >
            {item.brand.profilePic ? (
              <img
                src={item.brand.profilePic}
                alt=""
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                  darkMode ? 'bg-slate-700' : 'bg-slate-200'
                }`}
              >
                {item.brand.name.charAt(0)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {item.brand.name}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    item.isActive
                      ? 'bg-green-500/10 text-green-500'
                      : darkMode
                      ? 'bg-slate-700 text-slate-400'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.format || 'ad'}
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 line-clamp-1 ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {item.body || item.title || 'New ad launched'}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p
                className={`text-xs ${
                  darkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {timeAgo(item.startDate)}
              </p>
              {item.reach ? (
                <p className="text-xs font-medium mt-0.5">
                  {formatReach(item.reach)} reach
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </V2Card>
  );
}

// ---------------------------------------------------------------------------
// Top Ads Grid
// ---------------------------------------------------------------------------

function TopAdsGrid({
  ads,
  darkMode,
}: {
  ads: TopAd[];
  darkMode: boolean;
}) {
  if (ads.length === 0) return null;

  return (
    <V2Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#1235e2]" />
          Top Ads by Reach
        </h3>
        <Link
          href="/dashboard/v2/ad-library"
          className="text-xs text-[#1235e2] hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ads.map((ad) => (
          <div
            key={ad.id}
            className={`rounded-lg overflow-hidden border ${
              darkMode ? 'border-white/10' : 'border-slate-200'
            }`}
          >
            {/* Media */}
            <div
              className={`aspect-[4/3] relative ${
                darkMode ? 'bg-slate-800' : 'bg-slate-100'
              }`}
            >
              {ad.mediaUrl ? (
                ad.mediaType === 'video' ? (
                  <video
                    src={ad.mediaUrl}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={ad.mediaUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )
              ) : ad.snapshotUrl ? (
                <div className="w-full h-full flex items-center justify-center">
                  <a
                    href={ad.snapshotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1235e2] hover:underline flex items-center gap-1"
                  >
                    View snapshot <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Sparkles
                    className={`w-8 h-8 ${
                      darkMode ? 'text-slate-600' : 'text-slate-300'
                    }`}
                  />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-1">
                {ad.brand.profilePic ? (
                  <img
                    src={ad.brand.profilePic}
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                ) : null}
                <span className="text-xs font-medium truncate">
                  {ad.brand.name}
                </span>
              </div>
              {ad.title && (
                <p className="text-sm font-medium line-clamp-1">{ad.title}</p>
              )}
              {ad.body && (
                <p
                  className={`text-xs mt-1 line-clamp-2 ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {ad.body}
                </p>
              )}
              <div className="flex items-center justify-between mt-2">
                <span
                  className={`text-xs ${
                    darkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {ad.format}
                </span>
                <span className="text-xs font-bold">
                  {formatReach(ad.reach)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </V2Card>
  );
}

// ---------------------------------------------------------------------------
// Creator Spotlight
// ---------------------------------------------------------------------------

function CreatorSpotlight({
  creators,
  darkMode,
}: {
  creators: Creator[];
  darkMode: boolean;
}) {
  if (creators.length === 0) return null;

  const tierColors: Record<string, string> = {
    gold: 'bg-yellow-500/10 text-yellow-500',
    silver: 'bg-slate-400/10 text-slate-400',
    bronze: 'bg-orange-500/10 text-orange-500',
  };

  return (
    <V2Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <Users className="w-4 h-4 text-[#1235e2]" />
          Creator Spotlight
        </h3>
        <Link
          href="/dashboard/v2/creators"
          className="text-xs text-[#1235e2] hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {creators.map((c) => (
          <div
            key={c.id}
            className={`p-3 rounded-lg ${
              darkMode ? 'bg-white/5' : 'bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{c.name}</span>
                {c.tier && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      tierColors[c.tier] || 'bg-slate-500/10 text-slate-500'
                    }`}
                  >
                    {c.tier}
                  </span>
                )}
              </div>
              <span
                className={`text-xs ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {c.totalAds} ads / {c.brandCount} brands
              </span>
            </div>
            {/* Top brand partnerships */}
            <div className="flex items-center gap-2">
              {c.topBrands.map((b, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded ${
                    darkMode ? 'bg-white/5' : 'bg-white'
                  }`}
                >
                  {b.profilePic ? (
                    <img
                      src={b.profilePic}
                      alt=""
                      className="w-4 h-4 rounded-full"
                    />
                  ) : null}
                  <span className="truncate max-w-[80px]">{b.name}</span>
                  <span
                    className={`${
                      darkMode ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    ({b.adCount})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </V2Card>
  );
}

// ---------------------------------------------------------------------------
// Industry Trends
// ---------------------------------------------------------------------------

function IndustryTrendsSection({
  trends,
  darkMode,
}: {
  trends: CategoryTrend[];
  darkMode: boolean;
}) {
  if (trends.length === 0) return null;

  const maxAds = Math.max(...trends.map((t) => t.activeAds), 1);

  return (
    <V2Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#1235e2]" />
          Industry Trends
        </h3>
        <Link
          href="/dashboard/v2/categories"
          className="text-xs text-[#1235e2] hover:underline flex items-center gap-1"
        >
          Explore <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {trends.map((t) => (
          <div key={t.category}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium capitalize">
                {t.category}
              </span>
              <span
                className={`text-xs ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {t.brands} brands / {formatNumber(t.activeAds)} active ads
              </span>
            </div>
            <div
              className={`h-2 rounded-full overflow-hidden ${
                darkMode ? 'bg-white/10' : 'bg-slate-100'
              }`}
            >
              <div
                className="h-full rounded-full bg-[#1235e2] transition-all"
                style={{
                  width: `${Math.max((t.activeAds / maxAds) * 100, 2)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </V2Card>
  );
}

// ---------------------------------------------------------------------------
// Monitored Brands Bar
// ---------------------------------------------------------------------------

function MonitoredBrandsBar({
  brands,
  darkMode,
}: {
  brands: Brand[];
  darkMode: boolean;
}) {
  if (brands.length === 0) return null;

  return (
    <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2">
      <span
        className={`text-xs font-bold uppercase tracking-wide flex-shrink-0 ${
          darkMode ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        Monitoring
      </span>
      {brands.map((b) => (
        <Link
          key={b.id}
          href={`/dashboard/v2/brands/${b.pageId}`}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 transition-colors ${
            darkMode
              ? 'bg-white/5 hover:bg-white/10'
              : 'bg-slate-100 hover:bg-slate-200'
          }`}
        >
          {b.profilePic ? (
            <img src={b.profilePic} alt="" className="w-5 h-5 rounded-full" />
          ) : (
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                darkMode ? 'bg-slate-700' : 'bg-slate-300'
              }`}
            >
              {b.name.charAt(0)}
            </div>
          )}
          {b.name}
        </Link>
      ))}
      <Link
        href="/dashboard/v2/brands"
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-[#1235e2] border border-[#1235e2]/20 hover:bg-[#1235e2]/5 flex-shrink-0 transition-colors"
      >
        <Plus className="w-3 h-3" />
        Add
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

function DashboardContent() {
  const { darkMode } = useV2();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/dashboard/feed');
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('Dashboard feed error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <V2Skeleton rows={6} />;
  }

  if (!data) {
    return (
      <V2Card className="p-8 text-center">
        <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
          Failed to load dashboard. Try refreshing.
        </p>
      </V2Card>
    );
  }

  // Empty state: no monitored brands
  if (!data.hasMonitored) {
    return (
      <>
        <EmptyState darkMode={darkMode} />

        {/* Still show global trends and creators as a taste */}
        {data.industryTrends.length > 0 && (
          <div className="mt-8">
            <p
              className={`text-xs font-bold uppercase tracking-wide mb-4 ${
                darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Global overview
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <KpiCard
                label="New Ads (7d)"
                value={data.kpis.newAds}
                icon={Zap}
                trend={{
                  value: data.kpis.newAdsTrend,
                  label: 'vs prev 7d',
                }}
              />
              <KpiCard
                label="Active Ads"
                value={data.kpis.activeAds}
                icon={TrendingUp}
              />
              <KpiCard
                label="Total Reach"
                value={formatReach(data.kpis.totalReach)}
                icon={Eye}
                trend={{
                  value: data.kpis.totalReachTrend,
                  label: 'vs prev 7d',
                }}
              />
              <KpiCard
                label="Brands Tracked"
                value={data.kpis.brandCount || data.industryTrends.reduce((s, t) => s + t.brands, 0)}
                icon={Building2}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <IndustryTrendsSection
                trends={data.industryTrends}
                darkMode={darkMode}
              />
              <CreatorSpotlight
                creators={data.creatorSpotlight}
                darkMode={darkMode}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  // Full personalized dashboard
  return (
    <>
      {/* Monitored brands bar */}
      <MonitoredBrandsBar brands={data.monitoredBrands} darkMode={darkMode} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KpiCard
          label="New Ads (7d)"
          value={data.kpis.newAds}
          icon={Zap}
          trend={{ value: data.kpis.newAdsTrend, label: 'vs prev 7d' }}
        />
        <KpiCard
          label="Active Ads"
          value={data.kpis.activeAds}
          icon={TrendingUp}
          trend={{ value: data.kpis.activeAdsTrend, label: 'vs prev 7d' }}
        />
        <KpiCard
          label="Total Reach"
          value={formatReach(data.kpis.totalReach)}
          icon={Eye}
          trend={{ value: data.kpis.totalReachTrend, label: 'vs prev 7d' }}
        />
        <KpiCard
          label="Brands Monitored"
          value={data.kpis.brandCount}
          icon={Building2}
        />
      </div>

      {/* Main grid: Activity Feed + Top Ads */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        <div className="lg:col-span-2">
          <ActivityFeed items={data.activityFeed} darkMode={darkMode} />
        </div>
        <div className="lg:col-span-3">
          <TopAdsGrid ads={data.topAds} darkMode={darkMode} />
        </div>
      </div>

      {/* Creator Spotlight + Industry Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CreatorSpotlight
          creators={data.creatorSpotlight}
          darkMode={darkMode}
        />
        <IndustryTrendsSection
          trends={data.industryTrends}
          darkMode={darkMode}
        />
      </div>
    </>
  );
}

export default function DashboardV2Page() {
  return (
    <V2Shell title="Dashboard">
      <DashboardContent />
    </V2Shell>
  );
}
