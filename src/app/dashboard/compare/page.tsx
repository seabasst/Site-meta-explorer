'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTrackedBrands } from '@/hooks/use-tracked-brands';
import type { TrackedBrand } from '@/hooks/use-tracked-brands';
import type { AggregatedDemographics } from '@/lib/demographic-types';
import { BrandSelector } from '@/components/comparison/brand-selector';
import { ComparisonEmpty } from '@/components/comparison/comparison-empty';
import { ButterflyChart } from '@/components/comparison/butterfly-chart';
import { CountryComparison } from '@/components/comparison/country-comparison';
import { MetricsTable } from '@/components/comparison/metrics-table';

function parseDemographics(
  brand: TrackedBrand | undefined
): AggregatedDemographics | null {
  if (!brand || brand.snapshots.length === 0) return null;
  const snap = brand.snapshots[0];
  const raw = snap.demographicsJson;
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as AggregatedDemographics;
    } catch {
      return null;
    }
  }
  return raw as AggregatedDemographics;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data, loading } = useTrackedBrands();

  const allBrands = useMemo(() => {
    if (!data) return [];
    return [
      ...(data.ownBrand ? [data.ownBrand] : []),
      ...(data.competitors ?? []),
    ];
  }, [data]);

  const eligibleBrands = useMemo(
    () => allBrands.filter((b) => b.snapshots.length > 0),
    [allBrands]
  );

  const selectedAId = searchParams.get('a');
  const selectedBId = searchParams.get('b');

  const updateParam = useCallback(
    (key: string, id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set(key, id);
      } else {
        params.delete(key);
      }
      router.replace(`/dashboard/compare?${params.toString()}`);
    },
    [searchParams, router]
  );

  const brandA = allBrands.find((b) => b.id === selectedAId);
  const brandB = allBrands.find((b) => b.id === selectedBId);

  const brandADemo = useMemo(() => parseDemographics(brandA), [brandA]);
  const brandBDemo = useMemo(() => parseDemographics(brandB), [brandB]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-2xl p-6 animate-pulse">
            <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded mb-4" />
            <div className="h-32 bg-[var(--bg-tertiary)] rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (eligibleBrands.length < 2) {
    return <ComparisonEmpty brandCount={eligibleBrands.length} />;
  }

  const bothSelected = brandA && brandB;

  return (
    <div className="space-y-6">
      {/* Brand Selector */}
      <div className="glass rounded-2xl p-6">
        <BrandSelector
          brands={allBrands}
          selectedAId={selectedAId}
          selectedBId={selectedBId}
          onSelectA={(id) => updateParam('a', id)}
          onSelectB={(id) => updateParam('b', id)}
        />
      </div>

      {bothSelected ? (
        <>
          {/* Metrics Table */}
          <MetricsTable brandA={brandA} brandB={brandB} />

          {/* Butterfly Chart */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Age &amp; Gender Distribution
            </h3>
            <ButterflyChart
              brandAName={brandA.pageName}
              brandBName={brandB.pageName}
              brandADemo={brandADemo}
              brandBDemo={brandBDemo}
            />
          </div>

          {/* Country Comparison */}
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Geographic Distribution
            </h3>
            <CountryComparison
              brandAName={brandA.pageName}
              brandBName={brandB.pageName}
              brandADemo={brandADemo}
              brandBDemo={brandBDemo}
            />
          </div>
        </>
      ) : (
        <div className="glass rounded-2xl p-12 text-center">
          <p className="text-[var(--text-muted)] text-sm">
            Select two brands above to compare.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <h1 className="font-serif text-3xl text-[var(--text-primary)] mb-1">
              Brand Comparison
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              Compare two brands side by side across demographics, geography,
              and key metrics
            </p>
          </div>

          <Suspense
            fallback={
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                    <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded mb-4" />
                    <div className="h-32 bg-[var(--bg-tertiary)] rounded-lg" />
                  </div>
                ))}
              </div>
            }
          >
            <CompareContent />
          </Suspense>
        </div>
      </div>
    </>
  );
}
