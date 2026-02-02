'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useTrackedBrands } from '@/hooks/use-tracked-brands';
import type { TrackedBrand, TrackedBrandSnapshot } from '@/hooks/use-tracked-brands';

export default function BrandDetailPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = React.use(params);
  const { data, loading } = useTrackedBrands();

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
          <h1 className="font-serif text-3xl text-[var(--text-primary)] mb-1">{brand.pageName}</h1>
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
          </div>
        )}
      </div>
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
