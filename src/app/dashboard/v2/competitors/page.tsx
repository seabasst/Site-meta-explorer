'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  TrendingDown,
  Play,
  Image as ImageIcon,
  DollarSign,
  Eye,
  Megaphone,
  X,
  AlertCircle,
  Crown,
  Calendar,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandSnapshot {
  totalAdsFound: number;
  activeAdsCount: number;
  totalReach: number;
  avgReachPerAd: number;
  estimatedSpendUsd: number;
  videoCount: number;
  imageCount: number;
  videoPercentage: number;
  imagePercentage: number;
  avgAdAgeDays: number;
  dominantGender: string | null;
  dominantGenderPct: number | null;
  dominantAgeRange: string | null;
  dominantAgePct: number | null;
  topCountry1Code: string | null;
  topCountry1Pct: number | null;
  topCountry2Code: string | null;
  topCountry2Pct: number | null;
  topCountry3Code: string | null;
  topCountry3Pct: number | null;
}

interface TrackedBrand {
  id: string;
  facebookPageId: string;
  pageName: string;
  adLibraryUrl: string | null;
  createdAt: string;
  snapshots: BrandSnapshot[];
}

interface DashboardData {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
  trendSnapshots?: unknown;
  topHooks?: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const countryFlags: Record<string, string> = {
  US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷',
  NL: '🇳🇱', IT: '🇮🇹', ES: '🇪🇸', BR: '🇧🇷', IN: '🇮🇳', JP: '🇯🇵',
  MX: '🇲🇽', SE: '🇸🇪', DK: '🇩🇰', NO: '🇳🇴', FI: '🇫🇮', PL: '🇵🇱',
  BE: '🇧🇪', AT: '🇦🇹', CH: '🇨🇭', IE: '🇮🇪', NZ: '🇳🇿', SG: '🇸🇬',
  KR: '🇰🇷', ZA: '🇿🇦', AE: '🇦🇪', PT: '🇵🇹',
};

function getFlag(code: string | null): string {
  if (!code) return '🌍';
  return countryFlags[code.toUpperCase()] || '🌍';
}

function formatSpend(num: number | null): string {
  if (num === null || num === undefined || num === 0) return '-';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toLocaleString()}`;
}

function getSnapshot(brand: TrackedBrand): BrandSnapshot | null {
  return brand.snapshots?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompetitorsPage() {
  const { darkMode } = useV2();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // Add competitor form state
  const [formPageId, setFormPageId] = useState('');
  const [formPageName, setFormPageName] = useState('');
  const [formAdLibUrl, setFormAdLibUrl] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/overview');
      if (!res.ok) throw new Error('Failed to load data');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ------ Actions ------

  const handleAddCompetitor = async () => {
    if (!formPageId.trim() || !formPageName.trim()) {
      toast.error('Facebook Page ID and Page Name are required.');
      return;
    }
    setFormSubmitting(true);
    try {
      const res = await fetch('/api/dashboard/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facebookPageId: formPageId.trim(),
          pageName: formPageName.trim(),
          adLibraryUrl: formAdLibUrl.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to add competitor');
      }
      toast.success(`Added ${formPageName.trim()} as a competitor.`);
      setFormPageId('');
      setFormPageName('');
      setFormAdLibUrl('');
      setShowAddModal(false);
      await fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleRefreshSnapshot = async (brand: TrackedBrand) => {
    setRefreshingIds(prev => new Set(prev).add(brand.id));
    try {
      const res = await fetch('/api/dashboard/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedBrandId: brand.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create snapshot');
      }
      toast.success(`Snapshot refreshed for ${brand.pageName}.`);
      await fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(brand.id);
        return next;
      });
    }
  };

  const handleDeleteCompetitor = async (brand: TrackedBrand) => {
    if (!confirm(`Remove ${brand.pageName} from competitors?`)) return;
    setDeletingIds(prev => new Set(prev).add(brand.id));
    try {
      const res = await fetch(`/api/dashboard/competitors?id=${brand.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to remove competitor');
      }
      toast.success(`Removed ${brand.pageName}.`);
      await fetchData();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(brand.id);
        return next;
      });
    }
  };

  // ------ Comparison helpers ------

  function comparisonIndicator(ownVal: number, compVal: number, higherIsBetter = true) {
    if (!ownVal || !compVal) return null;
    const diff = compVal - ownVal;
    const pct = ownVal > 0 ? Math.round((diff / ownVal) * 100) : 0;
    if (pct === 0) return null;
    const isGood = higherIsBetter ? diff < 0 : diff > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${isGood ? 'text-emerald-500' : 'text-red-400'}`}>
        {isGood ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
        {Math.abs(pct)}%
      </span>
    );
  }

  // ------ Derived data ------

  const ownBrand = data?.ownBrand ?? null;
  const competitors = data?.competitors ?? [];
  const ownSnap = ownBrand ? getSnapshot(ownBrand) : null;

  // Build sidebar insights from own brand
  const sidebarCountries: { code: string; pct: number }[] = [];
  if (ownSnap) {
    if (ownSnap.topCountry1Code && ownSnap.topCountry1Pct) sidebarCountries.push({ code: ownSnap.topCountry1Code, pct: Math.round(ownSnap.topCountry1Pct) });
    if (ownSnap.topCountry2Code && ownSnap.topCountry2Pct) sidebarCountries.push({ code: ownSnap.topCountry2Code, pct: Math.round(ownSnap.topCountry2Pct) });
    if (ownSnap.topCountry3Code && ownSnap.topCountry3Pct) sidebarCountries.push({ code: ownSnap.topCountry3Code, pct: Math.round(ownSnap.topCountry3Pct) });
  }
  const genderLabel = ownSnap?.dominantGender
    ? `${Math.round(ownSnap.dominantGenderPct ?? 0)}% ${ownSnap.dominantGender === 'female' ? 'Female' : ownSnap.dominantGender === 'male' ? 'Male' : ownSnap.dominantGender}`
    : undefined;

  return (
    <V2Shell
      title="Competitors"
      insights={{
        genderLabel: genderLabel ?? null,
        genderPct: ownSnap?.dominantGenderPct ?? 0,
        countries: sidebarCountries,
      }}
    >
      {loading ? (
        <V2Skeleton rows={4} />
      ) : error ? (
        <V2Card className="p-12 text-center">
          <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
          <p className={`text-lg font-semibold mb-2 ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>Failed to load data</p>
          <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{error}</p>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors"
          >
            Retry
          </button>
        </V2Card>
      ) : (
        <>
          {/* ============================================================ */}
          {/* OWN BRAND CARD                                               */}
          {/* ============================================================ */}
          <section className="mb-10">
            <V2SectionTitle icon={<Crown className="w-5 h-5 text-yellow-500" />}>
              Your Brand
            </V2SectionTitle>

            {ownBrand && ownSnap ? (
              <V2Card className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h4 className="text-xl font-bold">{ownBrand.pageName}</h4>
                    <p className={`text-xs mt-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      Page ID: {ownBrand.facebookPageId}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRefreshSnapshot(ownBrand)}
                    disabled={refreshingIds.has(ownBrand.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      darkMode
                        ? 'bg-[#1235e2]/10 text-[#1235e2] hover:bg-[#1235e2]/20'
                        : 'bg-[#1235e2]/5 text-[#1235e2] hover:bg-[#1235e2]/10'
                    } disabled:opacity-50`}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingIds.has(ownBrand.id) ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                  <MetricCell
                    label="Total Ads"
                    value={formatNumber(ownSnap.totalAdsFound)}
                    icon={<Megaphone className="w-4 h-4 text-[#1235e2]" />}
                    darkMode={darkMode}
                  />
                  <MetricCell
                    label="Active Ads"
                    value={formatNumber(ownSnap.activeAdsCount)}
                    icon={<Eye className="w-4 h-4 text-emerald-500" />}
                    darkMode={darkMode}
                  />
                  <MetricCell
                    label="Total Reach"
                    value={formatNumber(ownSnap.totalReach)}
                    icon={<TrendingUp className="w-4 h-4 text-[#1235e2]" />}
                    darkMode={darkMode}
                  />
                  <MetricCell
                    label="Est. Spend"
                    value={formatSpend(ownSnap.estimatedSpendUsd)}
                    icon={<DollarSign className="w-4 h-4 text-amber-500" />}
                    darkMode={darkMode}
                  />
                  <div>
                    <p className={`text-[10px] uppercase font-bold mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      Media Mix
                    </p>
                    <MediaMixBar video={ownSnap.videoPercentage} image={ownSnap.imagePercentage} darkMode={darkMode} />
                  </div>
                </div>
              </V2Card>
            ) : (
              <V2Card className="p-12 text-center">
                <Crown className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                <p className={`font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  No brand set up yet
                </p>
                <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Set up your own brand in Settings to enable competitor comparisons.
                </p>
                <Link
                  href="/dashboard/v2/settings"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors"
                >
                  Go to Settings
                </Link>
              </V2Card>
            )}
          </section>

          {/* ============================================================ */}
          {/* COMPETITOR GRID                                              */}
          {/* ============================================================ */}
          <section className="mb-10">
            <V2SectionTitle
              icon={<Users className="w-5 h-5 text-[#1235e2]" />}
              action={
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Competitor
                </button>
              }
            >
              Competitors ({competitors.length})
            </V2SectionTitle>

            {competitors.length === 0 ? (
              <V2Card className="p-12 text-center">
                <Users className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                <p className={`font-semibold mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  No competitors tracked yet
                </p>
                <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Add competitors to compare their ad performance against your brand.
                </p>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2dc5] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Competitor
                </button>
              </V2Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {competitors.map(comp => {
                  const snap = getSnapshot(comp);
                  const isRefreshing = refreshingIds.has(comp.id);
                  const isDeleting = deletingIds.has(comp.id);

                  return (
                    <V2Card key={comp.id} className={`p-5 transition-opacity ${isDeleting ? 'opacity-50' : ''}`}>
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-bold truncate">{comp.pageName}</h4>
                          <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            <Calendar className="w-3 h-3" />
                            Added {new Date(comp.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {snap?.topCountry1Code && (
                          <span className="text-lg" title={snap.topCountry1Code}>
                            {getFlag(snap.topCountry1Code)}
                          </span>
                        )}
                      </div>

                      {snap ? (
                        <>
                          {/* Metrics */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div>
                              <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                Active Ads
                              </p>
                              <p className="text-sm font-bold">{formatNumber(snap.activeAdsCount)}</p>
                              {ownSnap && comparisonIndicator(ownSnap.activeAdsCount, snap.activeAdsCount, false)}
                            </div>
                            <div>
                              <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                Total Reach
                              </p>
                              <p className="text-sm font-bold">{formatNumber(snap.totalReach)}</p>
                              {ownSnap && comparisonIndicator(ownSnap.totalReach, snap.totalReach, false)}
                            </div>
                            <div>
                              <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                Est. Spend
                              </p>
                              <p className="text-sm font-bold">{formatSpend(snap.estimatedSpendUsd)}</p>
                              {ownSnap && comparisonIndicator(ownSnap.estimatedSpendUsd, snap.estimatedSpendUsd, false)}
                            </div>
                          </div>

                          {/* Media Mix */}
                          <div className="mb-4">
                            <p className={`text-[10px] uppercase font-bold mb-1.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                              Media Mix
                            </p>
                            <MediaMixBar video={snap.videoPercentage} image={snap.imagePercentage} darkMode={darkMode} />
                          </div>
                        </>
                      ) : (
                        <div className={`rounded-lg p-4 mb-4 text-center text-xs ${darkMode ? 'bg-slate-800/50 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                          No snapshot data yet. Click Refresh to create one.
                        </div>
                      )}

                      {/* Actions */}
                      <div className={`flex gap-2 pt-3 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
                        <button
                          onClick={() => handleRefreshSnapshot(comp)}
                          disabled={isRefreshing}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            darkMode
                              ? 'bg-[#1235e2]/10 text-[#1235e2] hover:bg-[#1235e2]/20'
                              : 'bg-[#1235e2]/5 text-[#1235e2] hover:bg-[#1235e2]/10'
                          } disabled:opacity-50`}
                        >
                          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                          {isRefreshing ? 'Refreshing...' : 'Refresh Snapshot'}
                        </button>
                        <button
                          onClick={() => handleDeleteCompetitor(comp)}
                          disabled={isDeleting}
                          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            darkMode
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'bg-red-50 text-red-500 hover:bg-red-100'
                          } disabled:opacity-50`}
                        >
                          <Trash2 className="w-3 h-3" />
                          Remove
                        </button>
                      </div>
                    </V2Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* ============================================================ */}
          {/* COMPARISON TABLE                                             */}
          {/* ============================================================ */}
          {ownBrand && ownSnap && competitors.length > 0 && (
            <section className="mb-10">
              <V2SectionTitle icon={<TrendingUp className="w-5 h-5 text-[#1235e2]" />}>
                Side-by-Side Comparison
              </V2SectionTitle>

              <V2Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`text-left text-[11px] uppercase tracking-wide border-b ${
                        darkMode ? 'text-slate-400 border-[#1235e2]/10' : 'text-slate-500 border-slate-100'
                      }`}>
                        <th className="px-5 py-3 font-bold">Metric</th>
                        <th className="px-5 py-3 font-bold text-right">
                          <span className="inline-flex items-center gap-1">
                            <Crown className="w-3 h-3 text-yellow-500" />
                            {ownBrand.pageName}
                          </span>
                        </th>
                        {competitors.map(c => (
                          <th key={c.id} className="px-5 py-3 font-bold text-right">{c.pageName}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${darkMode ? 'divide-[#1235e2]/10' : 'divide-slate-100'}`}>
                      {[
                        { label: 'Total Ads', key: 'totalAdsFound' as const, format: formatNumber },
                        { label: 'Active Ads', key: 'activeAdsCount' as const, format: formatNumber },
                        { label: 'Total Reach', key: 'totalReach' as const, format: formatNumber },
                        { label: 'Avg Reach / Ad', key: 'avgReachPerAd' as const, format: formatNumber },
                        { label: 'Est. Spend', key: 'estimatedSpendUsd' as const, format: formatSpend },
                        { label: 'Video %', key: 'videoPercentage' as const, format: (v: number | null) => v != null ? `${Math.round(v)}%` : '-' },
                        { label: 'Image %', key: 'imagePercentage' as const, format: (v: number | null) => v != null ? `${Math.round(v)}%` : '-' },
                        { label: 'Avg Ad Age (days)', key: 'avgAdAgeDays' as const, format: (v: number | null) => v != null ? `${Math.round(v)}` : '-' },
                      ].map(metric => (
                        <tr key={metric.label} className={`transition-colors ${darkMode ? 'hover:bg-[#1235e2]/5' : 'hover:bg-slate-50'}`}>
                          <td className={`px-5 py-3 font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                            {metric.label}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-[#1235e2]">
                            {metric.format(ownSnap[metric.key] as number)}
                          </td>
                          {competitors.map(c => {
                            const cSnap = getSnapshot(c);
                            const val = cSnap ? (cSnap[metric.key] as number) : null;
                            return (
                              <td key={c.id} className="px-5 py-3 text-right">
                                {val != null ? metric.format(val) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Top Country row */}
                      <tr className={`transition-colors ${darkMode ? 'hover:bg-[#1235e2]/5' : 'hover:bg-slate-50'}`}>
                        <td className={`px-5 py-3 font-medium ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          Top Country
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-[#1235e2]">
                          {ownSnap.topCountry1Code
                            ? `${getFlag(ownSnap.topCountry1Code)} ${ownSnap.topCountry1Code} (${Math.round(ownSnap.topCountry1Pct ?? 0)}%)`
                            : '-'}
                        </td>
                        {competitors.map(c => {
                          const cSnap = getSnapshot(c);
                          return (
                            <td key={c.id} className="px-5 py-3 text-right">
                              {cSnap?.topCountry1Code
                                ? `${getFlag(cSnap.topCountry1Code)} ${cSnap.topCountry1Code} (${Math.round(cSnap.topCountry1Pct ?? 0)}%)`
                                : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </V2Card>
            </section>
          )}
        </>
      )}

      {/* ============================================================ */}
      {/* ADD COMPETITOR MODAL                                         */}
      {/* ============================================================ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          {/* Modal */}
          <div className={`relative w-full max-w-md rounded-xl border p-6 shadow-2xl ${
            darkMode
              ? 'bg-[#101322] border-[#1235e2]/20'
              : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Add Competitor</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  darkMode ? 'hover:bg-[#1235e2]/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Facebook Page ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formPageId}
                  onChange={e => setFormPageId(e.target.value)}
                  placeholder="e.g. 123456789012345"
                  className={`w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-[#1235e2] ${
                    darkMode
                      ? 'bg-[#1235e2]/5 border-[#1235e2]/10 text-white placeholder:text-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Page Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formPageName}
                  onChange={e => setFormPageName(e.target.value)}
                  placeholder="e.g. Nike"
                  className={`w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-[#1235e2] ${
                    darkMode
                      ? 'bg-[#1235e2]/5 border-[#1235e2]/10 text-white placeholder:text-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wide mb-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Ad Library URL <span className={`font-normal normal-case tracking-normal ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>(optional)</span>
                </label>
                <input
                  type="url"
                  value={formAdLibUrl}
                  onChange={e => setFormAdLibUrl(e.target.value)}
                  placeholder="https://www.facebook.com/ads/library/..."
                  className={`w-full rounded-lg px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-[#1235e2] ${
                    darkMode
                      ? 'bg-[#1235e2]/5 border-[#1235e2]/10 text-white placeholder:text-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                  }`}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  darkMode
                    ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleAddCompetitor}
                disabled={formSubmitting || !formPageId.trim() || !formPageName.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {formSubmitting ? 'Adding...' : 'Add Competitor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </V2Shell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCell({
  label,
  value,
  icon,
  darkMode,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  darkMode: boolean;
}) {
  return (
    <div>
      <p className={`text-[10px] uppercase font-bold flex items-center gap-1 mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        {icon}
        {label}
      </p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function MediaMixBar({
  video,
  image,
  darkMode,
}: {
  video: number;
  image: number;
  darkMode: boolean;
}) {
  const videoPct = video ?? 0;
  const imagePct = image ?? 0;

  return (
    <div>
      <div className={`h-2 w-full rounded-full overflow-hidden flex ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
        {videoPct > 0 && (
          <div
            className="h-full bg-[#1235e2] transition-all duration-500"
            style={{ width: `${videoPct}%` }}
          />
        )}
        {imagePct > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${imagePct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className={`text-[10px] flex items-center gap-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <Play className="w-2.5 h-2.5 text-[#1235e2]" />
          Video {Math.round(videoPct)}%
        </span>
        <span className={`text-[10px] flex items-center gap-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <ImageIcon className="w-2.5 h-2.5 text-emerald-500" />
          Image {Math.round(imagePct)}%
        </span>
      </div>
    </div>
  );
}
