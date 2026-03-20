# Phase 49: Inline Analytics Bar - Research

**Researched:** 2026-03-20
**Domain:** UI component redesign (React, Tailwind CSS v4)
**Confidence:** HIGH

## Summary

This phase replaces the current 4-card stats grid (`StatsBar`) with a compact, single-row analytics strip. The current implementation shows Total Brands, Total Ads, Active Ads, and Inactive Ads in a `grid-cols-2 lg:grid-cols-4` layout using `V2Card` wrappers. These stats are fetched once on mount from `/api/ad-library/stats?fast=true` and never update when filters change.

The new strip needs to show: total reach, active ad count, format breakdown, and top categories. The critical change is that stats must reflect the **filtered subset**, not global totals. Currently the ads API returns `pagination.total` (filtered count) but no aggregated stats. The stats API is a separate endpoint that does accept filter params but is only called once on mount without filters.

**Primary recommendation:** Compute inline stats client-side from the loaded ads data and `pagination.total`, avoiding a second API call. For format breakdown and reach totals, extend the ads API response to include a lightweight `stats` object computed from the same `where` clause already built for the query.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | 19.x | Component rendering | Already in project |
| Tailwind CSS | v4 | Styling the strip | Already in project |
| lucide-react | latest | Icons | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| formatNumber (v2-shell) | N/A | Number formatting (1.2M, 3.4K) | All stat values |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side stat computation | Separate stats API call per filter change | Extra network request, latency; overkill for this use case |
| Extending ads API with stats | Dedicated `/api/ad-library/stats` with filter params | Stats API already supports filters but is heavy (many queries); better to piggyback on ads query |

## Architecture Patterns

### Data Flow: Filtered Stats

**Current flow (broken for this requirement):**
```
Mount -> fetch /api/ad-library/stats?fast=true -> global stats (never updates)
Mount + filter change -> fetch /api/ad-library/ads?filters -> ads + pagination
```

**Recommended flow:**
```
Mount + filter change -> fetch /api/ad-library/ads?filters -> ads + pagination + filteredStats
                                                                                    ^
                                              New: { totalReach, activeCount, formatBreakdown, topCategories }
```

### Pattern 1: Extend Ads API Response with `filteredStats`

**What:** Add a `filteredStats` field to the ads API response, computed from the same `where` clause used for the main query.

**When to use:** When stats need to reflect the exact same filter set as the ad results.

**Example:**
```typescript
// In /api/ad-library/ads/route.ts GET handler
// After building `where` clause, add parallel queries:

const [ads, total, reachAgg, formatCounts, categoryCounts] = await Promise.all([
  prisma.adLibraryAd.findMany({ where, orderBy, skip, take, include: { ... } }),
  prisma.adLibraryAd.count({ where }),
  prisma.adLibraryAd.aggregate({
    where,
    _sum: { reachEstimate: true },
  }),
  prisma.adLibraryAd.groupBy({
    by: ['displayFormat'],
    _count: { id: true },
    where,
  }),
  prisma.adLibraryAd.groupBy({
    by: ['brand'],  // Need to join through brand for category
    // Alternative: use raw query or separate approach
    _count: { id: true },
    where,
  }),
]);

// Return in response:
const response = {
  ads: ads.map(serializeAd),
  pagination: { ... },
  filteredStats: {
    totalReach: Number(reachAgg._sum.reachEstimate || 0),
    activeCount: activeCountFromWhere,
    formatBreakdown: formatCounts.map(r => ({
      format: r.displayFormat || 'unknown',
      count: r._count.id,
    })),
    topCategories: [...],  // Derived from brand categories in results
  },
};
```

### Pattern 2: Single-Row Strip Component

**What:** Replace `grid-cols-2 lg:grid-cols-4 gap-4 mb-8` card layout with a single `flex` row of inline stat segments separated by dividers.

**Example:**
```typescript
// Compact stats strip - single row, no card wrappers
<div className={`flex items-center gap-6 px-4 py-3 rounded-xl border mb-6 text-sm ${
  darkMode
    ? 'bg-[#1235e2]/5 border-[#1235e2]/10'
    : 'bg-white border-slate-200'
}`}>
  <StatSegment label="Active Ads" value={formatNumber(stats.activeCount)} />
  <Divider />
  <StatSegment label="Total Reach" value={formatNumber(stats.totalReach)} />
  <Divider />
  <FormatBreakdown formats={stats.formatBreakdown} />
  <Divider />
  <TopCategories categories={stats.topCategories} />
</div>
```

### Anti-Patterns to Avoid
- **Separate API call for filtered stats:** Doubles network requests on every filter change. Instead, extend the existing ads API response.
- **Computing reach from loaded ads only:** The page loads 48 ads at a time but pagination.total could be thousands. Client-side sums of loaded ads would be wrong. Must compute server-side across full filtered set.
- **Keeping global stats on mount:** The old StatsBar fetched once and never updated. The new strip must reflect current filters.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number formatting | Custom formatter | `formatNumber` from v2-shell | Already handles K/M/B suffixes |
| Dark/light mode styles | Inline conditional classes | Existing pattern from V2Card, FilterBar | Consistency with rest of UI |
| Format label display | Raw format strings | `formatFormatLabel` from types.ts | Already capitalizes format names |

## Common Pitfalls

### Pitfall 1: Category Aggregation Performance
**What goes wrong:** Getting top categories from the filtered ads requires joining through the `brand` relation. Prisma `groupBy` cannot directly group by a relation field.
**Why it happens:** `category` lives on `AdLibraryBrand`, not `AdLibraryAd`.
**How to avoid:** Either (a) use a raw SQL query with JOIN + GROUP BY, or (b) derive categories from the already-fetched ads page (limited but fast), or (c) add a separate lightweight query that counts ads per brand category within the filtered set.
**Recommended approach:** Use `prisma.$queryRaw` for the category aggregation since it requires a JOIN that Prisma's groupBy cannot express directly.

### Pitfall 2: Stats Strip Breaking on Small Screens
**What goes wrong:** A single flex row with 4+ segments overflows on mobile.
**Why it happens:** Fixed `flex-row` layout without responsive wrapping.
**How to avoid:** Use `flex flex-wrap` so segments wrap to a second line on mobile, or use a scrollable container. The strip should remain compact but not break the layout.

### Pitfall 3: Stats Flashing/Mismatch During Loading
**What goes wrong:** Stats from the previous filter set show while new ads load, creating a mismatch.
**Why it happens:** If stats and ads come from different sources or update at different times.
**How to avoid:** Since stats come bundled in the ads API response, they naturally update together. Show a subtle loading state (opacity reduction or skeleton) while fetching.

### Pitfall 4: BigInt Serialization for Reach
**What goes wrong:** `reachEstimate` aggregate sums may exceed JS number precision, or Prisma returns BigInt.
**Why it happens:** The stats API already handles this with `serializeBigInt`. The ads API uses a similar `serializeAd` approach.
**How to avoid:** Ensure the aggregate `_sum.reachEstimate` is converted to `Number()` or serialized properly. For the scale of this dataset (thousands of ads), standard Number should suffice.

## Code Examples

### Current StatsBar (to be replaced)
```typescript
// Source: src/app/dashboard/v2/ad-library/components/stats-bar.tsx
// Shows: Total Brands, Total Ads, Active Ads, Inactive Ads
// Layout: grid-cols-2 lg:grid-cols-4 gap-4 mb-8
// Data source: /api/ad-library/stats?fast=true (fetched once on mount, global totals)
// Problem: Does not reflect filtered subset
```

### Current Data Available from Stats API (fast mode)
```typescript
// Returns: totalBrands, totalAds, activeAds, inactiveAds, adsByFormat[]
// adsByFormat already has format breakdown: { format: string, count: number }[]
// In fast mode: skips totalReach, adsByPlatform, topBrands, adsByDate
```

### Proposed Filtered Stats Shape
```typescript
interface FilteredStats {
  totalReach: number;        // Sum of reachEstimate for filtered set
  activeCount: number;       // Count of active ads in filtered set
  totalCount: number;        // Already available as pagination.total
  formatBreakdown: {         // Group by displayFormat within filtered set
    format: string;
    count: number;
  }[];
  topCategories: {           // Top 3-5 brand categories in filtered set
    category: string;
    count: number;
  }[];
}
```

### Proposed API Extension (ads route)
```typescript
// Add to the parallel Promise.all in GET handler:
const [ads, total, reachAgg, formatGrouped] = await Promise.all([
  prisma.adLibraryAd.findMany({ where, orderBy, skip, take, include: { ... } }),
  prisma.adLibraryAd.count({ where }),
  prisma.adLibraryAd.aggregate({
    where,
    _sum: { reachEstimate: true },
  }),
  prisma.adLibraryAd.groupBy({
    by: ['displayFormat'],
    _count: { id: true },
    where,
    orderBy: { _count: { id: 'desc' } },
  }),
]);

// For categories, use raw query:
const topCategories = await prisma.$queryRaw`
  SELECT b.category, COUNT(a.id)::int as count
  FROM "AdLibraryAd" a
  JOIN "AdLibraryBrand" b ON a."brandId" = b.id
  WHERE b.category IS NOT NULL
  -- (apply same filters as 'where' clause)
  GROUP BY b.category
  ORDER BY count DESC
  LIMIT 5
`;
```

### Proposed Strip Component Structure
```typescript
// New stats-strip.tsx (replaces stats-bar.tsx)
interface StatsStripProps {
  stats: FilteredStats | null;
  loading: boolean;
  darkMode: boolean;
}

export function StatsStrip({ stats, loading, darkMode }: StatsStripProps) {
  // Single-row flex container with inline stat segments
  // Each segment: label (xs text, muted) + value (sm text, bold)
  // Dividers between segments (vertical line, 1px)
  // Format breakdown: small pills showing "Image: 234 | Video: 56"
  // Categories: top 3 as comma-separated text or small pills
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4 stat cards in grid | Single-row strip | This phase | Saves vertical space, more information-dense |
| Global stats (unfiltered) | Filtered stats from ads API | This phase | Stats always match visible ad set |
| Separate stats endpoint | Stats bundled in ads response | This phase | One fewer API call per filter change |

## Open Questions

1. **Category aggregation approach**
   - What we know: `category` is on `AdLibraryBrand`, not `AdLibraryAd`. Prisma `groupBy` can't join.
   - What's unclear: Whether to use raw SQL, derive from loaded ads, or skip categories entirely.
   - Recommendation: Use `prisma.$queryRaw` with a JOIN. It's a single additional query and gives accurate results. Alternatively, if the complexity is not worth it, show top categories from the brands of the loaded page of ads (approximate but zero extra queries).

2. **Active ad count computation**
   - What we know: Currently, most users filter to `isActive=true` by default (statusFilter is 'active').
   - What's unclear: When already filtering to active-only, showing "Active Ads: 1,234" is redundant with `pagination.total`.
   - Recommendation: Show active count when viewing "all" status. When filtering active-only, replace with a different stat (e.g., total brands in filtered set, or average reach per ad).

3. **Whether to keep the `/api/ad-library/stats` initial fetch**
   - What we know: The page currently fetches stats on mount for the 4 cards. The new strip gets stats from the ads API response.
   - What's unclear: Whether other parts of the app use the stats endpoint.
   - Recommendation: Remove the stats fetch from the page mount. The strip gets data from the ads response. The stats API can remain for other consumers.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection:
  - `src/app/dashboard/v2/ad-library/components/stats-bar.tsx` -- current implementation
  - `src/app/api/ad-library/ads/route.ts` -- ads API, filter/sort logic
  - `src/app/api/ad-library/stats/route.ts` -- stats API with aggregations
  - `src/app/api/ad-library/filters/route.ts` -- filter options API
  - `src/app/dashboard/v2/ad-library/page.tsx` -- page orchestration, data flow
  - `src/app/dashboard/v2/ad-library/types.ts` -- shared types

### Secondary (MEDIUM confidence)
- None needed -- this is a pure codebase-internal redesign

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - clear from reading current code how data flows and what needs to change
- Pitfalls: HIGH - identified from direct code analysis (BigInt, category JOIN, responsive layout)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- internal UI refactor, no external dependency changes)
