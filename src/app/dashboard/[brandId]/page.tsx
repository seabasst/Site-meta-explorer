'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTrackedBrands } from '@/hooks/use-tracked-brands';
import type { TrackedBrand, TrackedBrandSnapshot } from '@/hooks/use-tracked-brands';
import { DeleteBrandDialog } from '@/components/dashboard/delete-brand-dialog';
import { HookExplorer } from '@/components/dashboard/hook-explorer';
import type { HookGroupDisplay } from '@/components/dashboard/hook-explorer';

export default function BrandDetailPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = React.use(params);
  const router = useRouter();
  const { data, loading, refresh } = useTrackedBrands();
  const [analyzing, setAnalyzing] = useState(false);
  const [history, setHistory] = useState<TrackedBrandSnapshot[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [hookGroups, setHookGroups] = useState<HookGroupDisplay[]>([]);
  const [hooksLoading, setHooksLoading] = useState(false);

  const fetchHistory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/dashboard/snapshots?trackedBrandId=${id}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        setHistory(Array.isArray(json) ? json : json.snapshots ?? []);
      }
    } catch {
      // silently fail — history is non-critical
    }
  }, []);

  const fetchHooks = useCallback(async (snapshotId: string) => {
    setHooksLoading(true);
    try {
      const res = await fetch(`/api/dashboard/hooks?snapshotId=${snapshotId}`);
      if (res.ok) {
        const json = await res.json();
        setHookGroups(json.hookGroups ?? []);
      }
    } catch {
      // silently fail -- hooks are non-critical
    } finally {
      setHooksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (brandId) {
      fetchHistory(brandId);
    }
  }, [brandId, fetchHistory]);

  const handleReanalyze = async () => {
    if (!brand) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/dashboard/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedBrandId: brand.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(err.error || 'Analysis failed');
      }
      await refresh();
      await fetchHistory(brand.id);
      toast.success('Analysis complete — data updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to re-analyze. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const isOwnBrand = data?.ownBrand?.id === brandId;
      const url = isOwnBrand
        ? '/api/dashboard/own-brand'
        : `/api/dashboard/competitors?id=${brandId}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete brand');
      toast.success('Brand deleted');
      router.push('/dashboard');
    } catch {
      toast.error('Failed to delete brand');
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  const brand: TrackedBrand | null = useMemo(() => {
    if (!data) return null;
    if (data.ownBrand?.id === brandId) return data.ownBrand;
    return data.competitors.find(c => c.id === brandId) ?? null;
  }, [data, brandId]);

  const snapshot: TrackedBrandSnapshot | null = brand?.snapshots[0] ?? null;

  const demographics = useMemo(() => {
    if (!snapshot?.demographicsJson) return null;
    try {
      const raw = typeof snapshot.demographicsJson === 'string'
        ? JSON.parse(snapshot.demographicsJson)
        : snapshot.demographicsJson;
      return raw as {
        gender?: Record<string, number>;
        age?: Record<string, number>;
        country?: Record<string, number>;
      };
    } catch {
      return null;
    }
  }, [snapshot]);

  useEffect(() => {
    if (snapshot?.id) {
      fetchHooks(snapshot.id);
    }
  }, [snapshot?.id, fetchHooks]);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded mb-8 animate-pulse" />
        <div className="h-8 w-64 bg-[var(--bg-tertiary)] rounded mb-4 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-[var(--bg-tertiary)] rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Not found state
  if (!brand) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-[var(--text-primary)] mb-4">Brand not found</h1>
        <p className="text-[var(--text-secondary)] mb-6">
          This brand may have been removed or doesn&apos;t exist.
        </p>
        <Link
          href="/dashboard"
          className="text-sm text-[var(--accent-green-light)] hover:text-[var(--text-primary)] transition-colors"
        >
          &larr; Back to Dashboard
        </Link>
      </div>
    );
  }

  // Country data from snapshot fields
  const countries: { code: string; pct: number }[] = [];
  if (snapshot?.topCountry1Code) countries.push({ code: snapshot.topCountry1Code, pct: snapshot.topCountry1Pct ?? 0 });
  if (snapshot?.topCountry2Code) countries.push({ code: snapshot.topCountry2Code, pct: snapshot.topCountry2Pct ?? 0 });
  if (snapshot?.topCountry3Code) countries.push({ code: snapshot.topCountry3Code, pct: snapshot.topCountry3Pct ?? 0 });

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Back navigation */}
        <Link
          href="/dashboard"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors inline-block mb-6"
        >
          &larr; Back to Dashboard
        </Link>

        {/* Brand header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-serif text-3xl text-[var(--text-primary)] mb-1">{brand.pageName}</h1>
              {snapshot && (
                <p className="text-xs text-[var(--text-muted)] mb-1">
                  Last analyzed: {new Date(snapshot.snapshotDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(snapshot.snapshotDate).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </p>
              )}
              {brand.adLibraryUrl && (
                <a
                  href={brand.adLibraryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-green-light)] transition-colors"
                >
                  View in Ad Library &rarr;
                </a>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleReanalyze}
                disabled={analyzing}
                className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green-light)] transition-colors disabled:opacity-50"
              >
                {analyzing ? 'Analyzing...' : 'Re-analyze'}
              </button>
              <button
                onClick={() => setDeleteOpen(true)}
                className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-red-400 hover:text-red-300 transition-colors"
              >
                Delete Brand
              </button>
            </div>
          </div>
        </div>

        {!snapshot ? (
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-[var(--text-muted)] text-sm">No snapshot data available yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Key metrics summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricBox label="Active Ads" value={snapshot.activeAdsCount.toLocaleString()} />
              <MetricBox label="Total Reach" value={formatReach(snapshot.totalReach)} />
              <MetricBox label="Est. Spend" value={`$${Math.round(snapshot.estimatedSpendUsd).toLocaleString()}`} />
              <MetricBox label="Avg Ad Age" value={`${Math.round(snapshot.avgAdAgeDays)}d`} />
              {snapshot.topCountry1Code && (
                <MetricBox label="Top Country" value={`${snapshot.topCountry1Code} (${Math.round(snapshot.topCountry1Pct ?? 0)}%)`} />
              )}
              {snapshot.dominantGender && (
                <MetricBox label="Dominant Gender" value={`${snapshot.dominantGender} (${Math.round(snapshot.dominantGenderPct ?? 0)}%)`} />
              )}
              {snapshot.dominantAgeRange && (
                <MetricBox label="Top Age Range" value={`${snapshot.dominantAgeRange} (${Math.round(snapshot.dominantAgePct ?? 0)}%)`} />
              )}
            </div>

            {/* Gender distribution */}
            {demographics?.gender && Object.keys(demographics.gender).length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Gender Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(demographics.gender)
                    .sort(([, a], [, b]) => b - a)
                    .map(([gender, pct]) => (
                      <div key={gender}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[var(--text-secondary)] capitalize">{gender}</span>
                          <span className="text-[var(--text-primary)] font-medium">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent-green)] rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Age range distribution */}
            {demographics?.age && Object.keys(demographics.age).length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Age Range Distribution</h3>
                <div className="space-y-3">
                  {Object.entries(demographics.age)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([range, pct]) => (
                      <div key={range}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-[var(--text-secondary)]">{range}</span>
                          <span className="text-[var(--text-primary)] font-medium">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[var(--accent-green)] rounded-full transition-all"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Country distribution */}
            {countries.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Country Distribution</h3>
                <div className="space-y-3">
                  {countries.map(({ code, pct }) => (
                    <div key={code}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[var(--text-secondary)]">{code}</span>
                        <span className="text-[var(--text-primary)] font-medium">{Math.round(pct)}%</span>
                      </div>
                      <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent-green)] rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Opening Hooks */}
            <HookExplorer hookGroups={hookGroups} loading={hooksLoading} />
          </div>
        )}

        {/* Snapshot History */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">History</h3>
          {history.length <= 1 ? (
            <p className="text-sm text-[var(--text-muted)]">
              No previous snapshots yet. Re-analyze to start tracking changes.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((snap, idx) => (
                <div
                  key={snap.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-[var(--bg-tertiary)]"
                >
                  <div className="flex items-center gap-2">
                    {idx === 0 && (
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] shrink-0" />
                    )}
                    <span className={`text-sm ${idx === 0 ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                      {new Date(snap.snapshotDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      {idx === 0 && <span className="text-xs text-[var(--accent-green-light)] ml-2">Latest</span>}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                    <span>{snap.activeAdsCount} ads</span>
                    <span>{formatReach(snap.totalReach)} reach</span>
                    <span>${Math.round(snap.estimatedSpendUsd).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <DeleteBrandDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        brandName={brand?.pageName ?? ''}
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function formatReach(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}
