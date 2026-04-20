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
 *
 * Returns two URL query strings:
 *   - adsQuery — includes `includeStats=false` so the ads endpoint skips
 *     the 5 heavy stats queries.
 *   - statsQuery — same filters, no pagination (stats endpoint ignores it).
 *
 * Splitting lets the two endpoints run in parallel on the server; the
 * slower one (stats) no longer blocks the ads list from streaming.
 */
function buildInitialQueries(
  searchParams: Record<string, string | string[] | undefined>,
): { adsQuery: string; statsQuery: string } {
  const shared = new URLSearchParams();
  shared.set('isActive', 'true');
  shared.set('excludeFormats', 'carousel,dpa');
  const brandPageId =
    typeof searchParams.brandPageId === 'string'
      ? searchParams.brandPageId
      : undefined;
  if (brandPageId) shared.set('brandPageId', brandPageId);

  const ads = new URLSearchParams(shared);
  ads.set('sortBy', 'reachEstimate');
  ads.set('sortOrder', 'desc');
  ads.set('page', '1');
  ads.set('limit', '48');
  ads.set('includeStats', 'false');

  return { adsQuery: ads.toString(), statsQuery: shared.toString() };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdsPage({ searchParams }: AdsPageProps) {
  const sp = await searchParams;
  const initialBrandFilter = typeof sp.brandPageId === 'string' ? sp.brandPageId : '';

  // Fetch the four initial payloads in parallel on the server.
  //
  // - ads: the grid. Fastest now (only 2 Prisma queries — list + count —
  //   because `includeStats=false` skips the 5 stats queries).
  // - stats: totalReach / activeCount / format+category breakdowns. 5
  //   queries, but runs in parallel with the rest.
  // - brands: top 5 for the jump nav.
  // - filters: categories + format options for the filter bar.
  //
  // Cache notes:
  //   - `no-store` on ads + stats — user-scoped via brandPageId.
  //   - brands revalidates every 60s (cheap, mostly stable).
  //   - filters revalidates every 300s (very stable).
  const { adsQuery, statsQuery } = buildInitialQueries(sp);

  const [adsResponse, statsResponse, brandsResponse, filtersResponse] =
    await Promise.all([
      fetch(await apiUrl(`/api/ad-library/ads?${adsQuery}`), {
        cache: 'no-store',
      }).catch(() => null),
      fetch(await apiUrl(`/api/ad-library/ads/stats?${statsQuery}`), {
        cache: 'no-store',
      }).catch(() => null),
      fetch(
        await apiUrl(
          '/api/ad-library/brands?page=1&limit=5&sortBy=activeAdCount&sortOrder=desc',
        ),
        { next: { revalidate: 60 } },
      ).catch(() => null),
      fetch(await apiUrl('/api/ad-library/filters'), {
        next: { revalidate: 300 },
      }).catch(() => null),
    ]);

  const adsData = adsResponse && adsResponse.ok ? await adsResponse.json() : null;
  const statsData =
    statsResponse && statsResponse.ok ? await statsResponse.json() : null;
  const brandsData =
    brandsResponse && brandsResponse.ok ? await brandsResponse.json() : null;
  const filtersData =
    filtersResponse && filtersResponse.ok ? await filtersResponse.json() : null;

  const initialAds: Ad[] = adsData?.ads ?? [];
  const initialPagination: PaginationData | null = adsData?.pagination ?? null;
  const initialFilteredStats: FilteredStats | null =
    statsData?.filteredStats ?? null;
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
