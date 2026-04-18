'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Image as ImageIcon,
  Layers,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Globe,
  Tag,
  BarChart3,
  Users,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../../v2-shell';
import { useV2 } from '../../v2-context';
import { formatFormatLabel } from '../types';
import { normalizeDemographicsJson } from '@/lib/demographics-normalizer';
import { DemographicPeek } from '../components/demographic-peek';
import { TAXONOMY, CATEGORY_KEYS, type CategoryKey } from '@/lib/classification/taxonomy';

// ---------------------------------------------------------------------------
// Types (match API response from /api/ad-library/brands/[pageId])
// ---------------------------------------------------------------------------

interface SerializedBrand {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  country: string | null;
  category: string | null;
  website: string | null;
  totalReach: string; // BigInt serialized as string
  activeAdCount: number;
  ingestionStatus: string;
  demographicsJson: unknown;
}

interface SerializedAsset {
  id: string;
  assetType: string;
  storedUrl: string | null;
  thumbnailUrl: string | null;
  originalUrl: string;
  downloadStatus: string;
  position: number;
}

interface SerializedAd {
  id: string;
  adId: string;
  displayFormat: string | null;
  body: string | null;
  caption: string | null;
  title: string | null;
  snapshotUrl: string | null;
  bylines: string | null;
  startDate: string | null;
  isActive: boolean;
  reachEstimate: number | null;
  assets: SerializedAsset[];
}

interface BrandDetailResponse {
  brand: SerializedBrand;
  ads: SerializedAd[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  classificationCoverage: {
    classified: number;
    total: number;
  };
  classificationDistribution: Record<string, Record<string, number>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

// ---------------------------------------------------------------------------
// Brand Detail Page
// ---------------------------------------------------------------------------

export default function BrandDetailPage() {
  const { darkMode } = useV2();
  const params = useParams();
  const pageId = params.pageId as string;

  // Data state
  const [brand, setBrand] = useState<SerializedBrand | null>(null);
  const [ads, setAds] = useState<SerializedAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Monitor state
  const [isMonitored, setIsMonitored] = useState(false);
  const [monitorLoading, setMonitorLoading] = useState(false);

  // Demographics collapse state
  const [demCollapsed, setDemCollapsed] = useState(false);

  // Classification state
  const [classificationCoverage, setClassificationCoverage] = useState<{ classified: number; total: number } | null>(null);
  const [classificationDistribution, setClassificationDistribution] = useState<Record<string, Record<string, number>>>({});

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchBrandDetail = useCallback(async () => {
    if (!pageId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ad-library/brands/${pageId}?page=${page}&pageSize=24&sortBy=reachEstimate&sortOrder=desc`);
      if (res.status === 404) {
        setError('Brand not found. It may have been removed or the link is incorrect.');
        setBrand(null);
        setAds([]);
        return;
      }
      if (!res.ok) {
        throw new Error(`Failed to load brand (${res.status})`);
      }
      const data: BrandDetailResponse = await res.json();
      setBrand(data.brand);
      setAds(data.ads);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
      setClassificationCoverage(data.classificationCoverage ?? null);
      setClassificationDistribution(data.classificationDistribution ?? {});
    } catch (err) {
      console.error('Failed to fetch brand detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load brand details.');
    } finally {
      setLoading(false);
    }
  }, [pageId, page]);

  useEffect(() => {
    fetchBrandDetail();
  }, [fetchBrandDetail]);

  // Check if brand is monitored
  useEffect(() => {
    if (!brand) return;
    fetch('/api/ad-library/brands/monitor/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandIds: [brand.id] }),
    })
      .then(res => res.json())
      .then(data => {
        setIsMonitored((data.monitoredBrandIds || []).includes(brand.id));
      })
      .catch(() => {}); // Graceful fallback for unauthenticated
  }, [brand?.id]);

  // Toggle monitor with optimistic update
  const toggleMonitor = async () => {
    if (!brand || monitorLoading) return;
    const wasMonitored = isMonitored;
    setIsMonitored(!wasMonitored);
    setMonitorLoading(true);
    try {
      await fetch('/api/ad-library/brands/monitor', {
        method: wasMonitored ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: brand.id }),
      });
    } catch {
      setIsMonitored(wasMonitored); // Revert on error
    } finally {
      setMonitorLoading(false);
    }
  };

  // Loading state
  if (loading && !brand) {
    return (
      <V2Shell title="Brand Detail">
        <Link
          href="/dashboard/v2/ad-library"
          className={`inline-flex items-center gap-1.5 text-sm mb-6 transition-colors ${
            darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Ad Library
        </Link>
        <V2Skeleton rows={4} />
      </V2Shell>
    );
  }

  // Error state
  if (error && !brand) {
    return (
      <V2Shell title="Brand Detail">
        <Link
          href="/dashboard/v2/ad-library"
          className={`inline-flex items-center gap-1.5 text-sm mb-6 transition-colors ${
            darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Ad Library
        </Link>
        <V2Card className="p-12 text-center">
          <BarChart3 className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            Something went wrong
          </p>
          <p className={`mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{error}</p>
          <Link
            href="/dashboard/v2/ad-library"
            className="inline-block px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors"
          >
            Back to Ad Library
          </Link>
        </V2Card>
      </V2Shell>
    );
  }

  if (!brand) return null;

  return (
    <V2Shell title={brand.pageName}>
      {/* Back link */}
      <Link
        href="/dashboard/v2/ad-library"
        className={`inline-flex items-center gap-1.5 text-sm mb-6 transition-colors ${
          darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Ad Library
      </Link>

      {/* Brand Header */}
      <V2Card className="p-6 mb-8">
        <div className="flex items-start gap-5">
          {/* Profile pic */}
          {brand.profilePicUrl ? (
            <img
              src={brand.profilePicUrl}
              alt={brand.pageName}
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${
                darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {brand.pageName?.[0] || '?'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Name + category */}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <h2 className="text-2xl font-bold">{brand.pageName}</h2>
              {brand.category && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    darkMode
                      ? 'bg-[#1235e2]/20 text-[#1235e2]'
                      : 'bg-[#1235e2]/10 text-[#1235e2]'
                  }`}
                >
                  <Tag className="w-3 h-3" />
                  {brand.category}
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 mb-3">
              <Link
                href={`/dashboard/v2/creative-lab?pageId=${brand.pageId}&pageName=${encodeURIComponent(brand.pageName)}&mode=analysis${brand.category ? `&category=${encodeURIComponent(brand.category)}` : ''}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors bg-[#1235e2] text-white hover:bg-[#0f2dc5]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Analyze Brand
              </Link>
              <button
                onClick={toggleMonitor}
                disabled={monitorLoading}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-50 ${
                  isMonitored
                    ? 'bg-[#1235e2] text-white'
                    : darkMode
                      ? 'border border-[#1235e2] text-[#1235e2] hover:bg-[#1235e2]/10'
                      : 'border border-[#1235e2] text-[#1235e2] hover:bg-[#1235e2]/5'
                }`}
              >
                {isMonitored ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                {isMonitored ? 'Monitoring' : 'Monitor'}
              </button>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-1.5">
                <BarChart3 className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span className="font-semibold">{formatNumber(brand.activeAdCount)}</span> Active Ads
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <BarChart3 className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <span className="font-semibold">{formatNumber(Number(brand.totalReach))}</span> Total Reach
                </span>
              </div>
              {brand.country && (
                <div className="flex items-center gap-1.5">
                  <Globe className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {brand.country}
                  </span>
                </div>
              )}
              {brand.website && (
                <a
                  href={brand.website.startsWith('http') ? brand.website : `https://${brand.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-[#1235e2] hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  Website
                </a>
              )}
            </div>
          </div>
        </div>
      </V2Card>

      {/* Demographics */}
      {(() => {
        if (!brand.demographicsJson) return null;
        const demographics = normalizeDemographicsJson(brand.demographicsJson);
        if (!demographics) return null;
        return (
          <section className="mb-8">
            <V2SectionTitle
              icon={<Users className="w-5 h-5 text-[#1235e2]" />}
            >
              Audience Demographics
            </V2SectionTitle>
            <DemographicPeek
              demographics={demographics}
              darkMode={darkMode}
              collapsed={demCollapsed}
              onToggleCollapse={() => setDemCollapsed(prev => !prev)}
            />
          </section>
        );
      })()}

      {/* Creative Classification */}
      <ClassificationSection
        coverage={classificationCoverage}
        distribution={classificationDistribution}
        darkMode={darkMode}
      />

      {/* Ad Grid */}
      <section>
        <V2SectionTitle
          icon={<BarChart3 className="w-5 h-5 text-[#1235e2]" />}
          action={
            <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {formatNumber(total)} ads {totalPages > 1 && `- Page ${page} of ${totalPages}`}
            </span>
          }
        >
          Top Ads by Reach
        </V2SectionTitle>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-[4/5] rounded-xl animate-pulse ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        ) : ads.length === 0 ? (
          <V2Card className="p-12 text-center">
            <ImageIcon className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
            <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              No ads found
            </p>
            <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
              This brand has no ads in the library yet.
            </p>
          </V2Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ads.map((ad) => (
              <BrandAdCard key={ad.id} ad={ad} darkMode={darkMode} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 ${
                darkMode
                  ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-30 ${
                darkMode
                  ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>
    </V2Shell>
  );
}

// ---------------------------------------------------------------------------
// Classification Section
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  assetType: 'Asset Type',
  visualFormat: 'Visual Format',
  hookTactic: 'Hook Tactic',
  messagingAngle: 'Messaging Angle',
  awarenessStage: 'Awareness Stage',
  creativeMechanic: 'Creative Mechanic',
  offerType: 'Offer Type',
  intendedAudience: 'Intended Audience',
};

function ClassificationSection({
  coverage,
  distribution,
  darkMode,
}: {
  coverage: { classified: number; total: number } | null;
  distribution: Record<string, Record<string, number>>;
  darkMode: boolean;
}) {
  if (!coverage) return null;

  const hasClassifications = coverage.classified > 0;
  const coveragePercent = coverage.total > 0
    ? Math.round((coverage.classified / coverage.total) * 100)
    : 0;

  const distributionKeys = CATEGORY_KEYS.filter(
    (key) => distribution[key] && Object.keys(distribution[key]).length > 0
  );

  return (
    <section className="mb-8">
      <V2SectionTitle
        icon={<Sparkles className="w-5 h-5 text-[#1235e2]" />}
        action={
          <span
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
              hasClassifications
                ? darkMode
                  ? 'bg-[#1235e2]/20 text-[#1235e2]'
                  : 'bg-[#1235e2]/10 text-[#1235e2]'
                : darkMode
                  ? 'bg-slate-800 text-slate-500'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            {coverage.classified} of {coverage.total} ads classified
            {hasClassifications && (
              <span className="relative w-16 h-1.5 rounded-full overflow-hidden bg-black/10">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[#1235e2]"
                  style={{ width: `${coveragePercent}%` }}
                />
              </span>
            )}
          </span>
        }
      >
        Creative Classification
      </V2SectionTitle>

      {!hasClassifications ? (
        <V2Card className="p-8 text-center">
          <Sparkles className={`w-10 h-10 mx-auto mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-sm font-medium mb-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            No ads classified yet
          </p>
          <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Run the Creative Lab analysis to classify this brand&apos;s ads.
          </p>
        </V2Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {distributionKeys.map((key) => (
            <DistributionChart
              key={key}
              categoryKey={key}
              label={CATEGORY_LABELS[key]}
              values={distribution[key]}
              darkMode={darkMode}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Distribution Chart (horizontal bar chart for a single category)
// ---------------------------------------------------------------------------

function DistributionChart({
  categoryKey,
  label,
  values,
  darkMode,
}: {
  categoryKey: CategoryKey;
  label: string;
  values: Record<string, number>;
  darkMode: boolean;
}) {
  const sorted = Object.entries(values)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8); // Max 8 values

  if (sorted.length === 0) return null;

  const maxCount = sorted[0][1];
  const totalCount = sorted.reduce((sum, [, count]) => sum + count, 0);

  const getLabel = (slug: string): string => {
    const labels = TAXONOMY[categoryKey]?.labels as Record<string, string> | undefined;
    if (labels && labels[slug]) return labels[slug];
    // Fallback: capitalize slug
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  return (
    <V2Card className="p-4">
      <p
        className={`text-[11px] uppercase font-bold tracking-wide mb-3 ${
          darkMode ? 'text-slate-400' : 'text-slate-500'
        }`}
      >
        {label}
      </p>
      <div className="space-y-2">
        {sorted.map(([slug, count]) => {
          const barPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const sharePercent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;

          return (
            <div key={slug}>
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={`text-xs truncate mr-2 ${
                    darkMode ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {getLabel(slug)}
                </span>
                <span
                  className={`text-[10px] font-semibold tabular-nums shrink-0 ${
                    darkMode ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {count} ({sharePercent}%)
                </span>
              </div>
              <div
                className={`h-1.5 w-full rounded-full overflow-hidden ${
                  darkMode ? 'bg-slate-800' : 'bg-slate-100'
                }`}
              >
                <div
                  className="h-full rounded-full bg-[#1235e2] transition-all duration-300"
                  style={{ width: `${barPercent}%`, opacity: 0.6 + (barPercent / 100) * 0.4 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </V2Card>
  );
}

// ---------------------------------------------------------------------------
// Brand Ad Card (no navigation -- these are the detail level)
// ---------------------------------------------------------------------------

function BrandAdCard({ ad, darkMode }: { ad: SerializedAd; darkMode: boolean }) {
  const primaryAsset = ad.assets?.find(
    (a) => a.downloadStatus === 'completed' && a.storedUrl
  );

  const formatIcon = () => {
    switch (ad.displayFormat) {
      case 'video':
        return <Play className="w-3 h-3" />;
      case 'carousel':
        return <Layers className="w-3 h-3" />;
      default:
        return <ImageIcon className="w-3 h-3" />;
    }
  };

  const renderPreview = () => {
    if (primaryAsset?.storedUrl) {
      if (primaryAsset.assetType === 'video') {
        return (
          <video
            src={primaryAsset.storedUrl}
            poster={primaryAsset.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            controls
            muted
            loop
            playsInline
            preload="metadata"
          />
        );
      }
      return (
        <img
          src={primaryAsset.storedUrl}
          alt={ad.title || 'Ad creative'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      );
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <ImageIcon className={`w-8 h-8 mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
        <p className={`text-xs text-center line-clamp-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {ad.body || ad.title || 'No preview available'}
        </p>
      </div>
    );
  };

  return (
    <div
      className={`group rounded-xl overflow-hidden border transition-all hover:shadow-lg ${
        darkMode
          ? 'bg-[#1235e2]/5 border-[#1235e2]/10 hover:border-[#1235e2]/40'
          : 'bg-white border-slate-200 hover:border-[#1235e2]/40'
      }`}
    >
      {/* Preview */}
      <div className={`relative aspect-[4/5] overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {renderPreview()}

        {/* Format badge */}
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold uppercase tracking-wide flex items-center gap-1 z-10">
          {formatIcon()}
          {formatFormatLabel(ad.displayFormat)}
        </div>

        {/* Status badge */}
        <div
          className={`absolute top-2 left-2 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase z-10 ${
            ad.isActive ? 'bg-green-500/80' : 'bg-slate-500/80'
          }`}
        >
          {ad.isActive ? 'Active' : 'Ended'}
        </div>

        {/* Partnership badge */}
        {ad.bylines && (
          <div className="absolute top-9 left-2 bg-purple-500/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase z-10 flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            Partnership
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-4">
        {/* Body preview */}
        {ad.body && (
          <p className={`text-xs mb-3 line-clamp-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {ad.body}
          </p>
        )}

        {/* Stats */}
        <div
          className={`grid grid-cols-2 gap-2 pt-3 border-t ${
            darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'
          }`}
        >
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Reach
            </p>
            <p className="text-sm font-bold">
              {ad.reachEstimate ? formatNumber(ad.reachEstimate) : 'N/A'}
            </p>
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Started
            </p>
            <p className="text-sm font-bold">{formatDate(ad.startDate)}</p>
          </div>
        </div>

        {/* View on Meta link */}
        {ad.snapshotUrl && (
          <a
            href={ad.snapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center gap-1.5 mt-3 pt-3 border-t text-xs font-semibold transition-colors ${
              darkMode
                ? 'border-[#1235e2]/10 text-slate-400 hover:text-[#1235e2]'
                : 'border-slate-100 text-slate-500 hover:text-[#1235e2]'
            }`}
          >
            <ExternalLink className="w-3 h-3" /> View on Meta
          </a>
        )}
      </div>
    </div>
  );
}
