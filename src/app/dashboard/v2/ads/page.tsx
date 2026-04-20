// SERVER COMPONENT — do NOT add 'use client'.
//
// Fetches the initial ad page + filter options + top brands on the server
// so the first paint ships real data instead of a skeleton. The client
// component (ads-client.tsx) hydrates from props and only refetches when
// the user changes filters.
//
// Before Phase 6.8 this was a client-everywhere component that fired 3+
// mount XHRs before rendering anything. See the audit scope 2 notes and
// .planning/review-2026-04-18/00-SYNTHESIS.md (Phase 6.8).

import { headers } from 'next/headers';
import { Suspense } from 'react';
import { V2Shell, V2Skeleton } from '../v2-shell';
import AdsClient from './ads-client';
import type { Ad, FilteredStats, TopBrand, PaginationData, FilterOption } from './types';

interface AdsPageProps {
  // Next 16 passes searchParams as a Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// Page is always dynamic — the ad list depends on query params (brandPageId)
// and the underlying data mutates hourly via cron. Don't prerender.
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Server-side fetch helpers
// ---------------------------------------------------------------------------

/**
 * Build an absolute URL for an internal API call from a server component.
 * Next 16's `fetch` requires absolute URLs from server code.
 */
async function apiUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}${path}`;
}

/**
 * Default search params matching the v2 client's initial state:
 *   isActive=true, hide carousel+dpa, sort by reach desc, 48 per page.
 * If the page is opened with ?brandPageId=..., we pass that through too.
 */
function buildInitialAdsQuery(searchParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  params.set('sortBy', 'reachEstimate');
  params.set('sortOrder', 'desc');
  params.set('page', '1');
  params.set('limit', '48');
  params.set('isActive', 'true');
  params.set('excludeFormats', 'carousel,dpa');
  const brandPageId = typeof searchParams.brandPageId === 'string' ? searchParams.brandPageId : undefined;
  if (brandPageId) params.set('brandPageId', brandPageId);
  return params.toString();
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdsPage({ searchParams }: AdsPageProps) {
  const sp = await searchParams;
  const initialBrandFilter = typeof sp.brandPageId === 'string' ? sp.brandPageId : '';

  // Fetch the three initial payloads in parallel, on the server, before any
  // HTML is sent. Total latency ≈ slowest of the three (bounded by the ads
  // query, which is the heaviest).
  //
  // Notes on cache:
  //   - `no-store` on the ads + brands queries because they're user-scoped
  //     (brandPageId filter) and cache-staleness would show stale ads.
  //   - /api/ad-library/filters is stable (categories / format options); we
  //     let Next's default fetch cache it with a 60s revalidate.
  const adsQuery = buildInitialAdsQuery(sp);

  const [adsResponse, brandsResponse, filtersResponse] = await Promise.all([
    fetch(await apiUrl(`/api/ad-library/ads?${adsQuery}`), {
      cache: 'no-store',
    }).catch(() => null),
    fetch(await apiUrl('/api/ad-library/brands?page=1&limit=5&sortBy=activeAdCount&sortOrder=desc'), {
      next: { revalidate: 60 },
    }).catch(() => null),
    fetch(await apiUrl('/api/ad-library/filters'), {
      next: { revalidate: 300 },
    }).catch(() => null),
  ]);

  const adsData = adsResponse && adsResponse.ok ? await adsResponse.json() : null;
  const brandsData = brandsResponse && brandsResponse.ok ? await brandsResponse.json() : null;
  const filtersData = filtersResponse && filtersResponse.ok ? await filtersResponse.json() : null;

  const initialAds: Ad[] = adsData?.ads ?? [];
  const initialPagination: PaginationData | null = adsData?.pagination ?? null;
  const initialFilteredStats: FilteredStats | null = adsData?.filteredStats ?? null;
  const initialTopBrands: TopBrand[] = (brandsData?.brands ?? []).slice(0, 5);
  const initialCategories: FilterOption[] = filtersData?.categories ?? [];
  const initialFormatOptions: FilterOption[] = filtersData?.formats ?? [];

  return (
    // Suspense wrapper preserved for any client-side Suspense boundaries that
    // may fire during client navigation. The server fetch is already done.
    <Suspense fallback={<V2Shell title="Ads"><V2Skeleton rows={4} /></V2Shell>}>
      <AdsClient
        initialAds={initialAds}
        initialPagination={initialPagination}
        initialFilteredStats={initialFilteredStats}
        initialTopBrands={initialTopBrands}
        initialCategories={initialCategories}
        initialFormatOptions={initialFormatOptions}
        initialBrandFilter={initialBrandFilter}
      />
    </Suspense>
  );
}
