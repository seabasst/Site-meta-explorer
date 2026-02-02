# Architecture Patterns

**Domain:** Competitive Intelligence features for Ad Library Demographics Analyzer
**Researched:** 2026-02-02
**Confidence:** HIGH (based on direct codebase analysis; no external sources needed)

## Existing Architecture Summary

The current system follows this pattern:

```
Facebook Graph API
      |
      v
facebook-api.ts (fetch + transform ads)
      |
      v
demographic-aggregator.ts (weighted combination)
      |
      v
snapshot-builder.ts (extract scalar + JSON fields)
      |
      v
Prisma (BrandSnapshot with scalar metrics + demographicsJson blob)
      |
      v
/api/dashboard/overview (combined payload: brands + snapshots + trends)
      |
      v
useTrackedBrands() hook (single fetch, single state object)
      |
      v
Dashboard page (OwnBrandCard, CompetitorCard, ComparisonTable, TrendChart, DemographicsComparison)
```

**Key architectural facts:**
- `BrandSnapshot.demographicsJson` stores the full `AggregatedDemographics` object (age, gender, ageGender, region breakdowns)
- `ad_creative_bodies` is fetched per ad but only the first entry is stored as `creativeBody` on `FacebookAdResult` -- it is NOT persisted to any snapshot or database model
- The existing `TrendChart` only tracks scalar metrics (totalReach, activeAdsCount, estimatedSpendUsd) over time
- The existing `DemographicsComparison` reads from `demographicsJson` on the latest snapshot only (no historical comparison)
- The existing `AdCopyAnalysis` component does client-side text analysis on raw ad results -- not on stored data

---

## Recommended Architecture for v3.1 Features

### Overall Approach

**Extend, don't replace.** The existing snapshot pipeline (fetch -> aggregate -> store -> display) is sound. Each v3.1 feature plugs into this pipeline at the right point:

| Feature | Extraction Point | Storage | Display |
|---------|-----------------|---------|---------|
| Creative hooks | snapshot-builder.ts (new extraction) | New `CreativeHook` model | New HooksPanel component |
| Trend charts | Already stored in `demographicsJson` per snapshot | No new model -- query existing snapshots | New DemographicTrendChart component |
| Brand comparison | Already stored in snapshots | No new model -- query two brands' snapshots | New BrandComparisonView component |
| Pattern observations | Computed at read-time from snapshots | No storage (derived) | New PatternObservations component |

---

## Data Model Changes

### New Prisma Model: `CreativeHook`

```prisma
model CreativeHook {
  id              String   @id @default(cuid())
  createdAt       DateTime @default(now())

  // The extracted hook text (first sentence or line of ad copy)
  hookText        String
  // Normalized form for grouping (lowercased, trimmed, punctuation stripped)
  normalizedText  String
  // How many ads used this exact normalized hook
  adCount         Int      @default(1)
  // Sum of reach across ads using this hook
  totalReach      BigInt   @default(0)
  // Weighted frequency score: adCount * log(totalReach)
  // Precomputed for sorting
  weightedScore   Float    @default(0)

  // Relation to snapshot (hooks are per-snapshot, not standalone)
  snapshotId      String
  snapshot        BrandSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@index([snapshotId, weightedScore])
  @@unique([snapshotId, normalizedText])
}
```

**Why a separate model instead of JSON blob:** Creative hooks need to be queried, sorted, and compared across brands. Storing them as structured rows enables SQL-level sorting by `weightedScore` and cross-brand queries without deserializing blobs.

### Schema Change: `BrandSnapshot`

Add relation to `CreativeHook`:

```prisma
model BrandSnapshot {
  // ... existing fields ...
  creativeHooks   CreativeHook[]
}
```

No other schema changes needed. The `demographicsJson` blob already contains the full breakdown data needed for trend charts and pattern observations.

---

## New Lib Modules

### 1. `src/lib/hook-extractor.ts` -- Creative Hook Extraction

**Purpose:** Extract the opening line/hook from `ad_creative_bodies` and group similar hooks.

**Data flow:**
```
FacebookAdResult[] (with creativeBody + euTotalReach)
      |
      v
extractHooks(ads) -> HookGroup[]
      |
      v
Each HookGroup: { hookText, normalizedText, adCount, totalReach, weightedScore }
```

**Extraction logic:**
1. For each ad with `creativeBody`, extract the first sentence (split on `.`, `!`, `?`, or `\n`, take first non-empty segment, max 150 chars)
2. Normalize: lowercase, strip leading/trailing punctuation and whitespace, collapse internal whitespace
3. Group by `normalizedText`, accumulate `adCount` and `totalReach`
4. Compute `weightedScore = adCount * Math.log10(Math.max(totalReach, 1))`
5. Sort by `weightedScore` descending, return top 50

**Interface:**
```typescript
export interface HookGroup {
  hookText: string;        // Original casing, first occurrence
  normalizedText: string;  // Grouping key
  adCount: number;
  totalReach: bigint;
  weightedScore: number;
}

export function extractHooks(ads: FacebookAdResult[]): HookGroup[];
```

### 2. `src/lib/pattern-observer.ts` -- Rule-Based Pattern Detection

**Purpose:** Generate factual, auto-generated observations from demographic data.

**Data flow:**
```
BrandSnapshot[] (ordered by date, for one brand)
      |
      v
observePatterns(snapshots) -> PatternObservation[]
```

**Rules engine (no ML, pure threshold-based):**

| Rule | Input | Trigger | Output |
|------|-------|---------|--------|
| Gender skew | Latest snapshot genderBreakdown | Any gender > 60% | "Skews {gender} ({pct}%)" |
| Age concentration | Latest snapshot ageBreakdown | Top age range > 35% | "Concentrated in {age} ({pct}%)" |
| Country dominance | Latest snapshot regionBreakdown | Top country > 50% | "Heavily focused on {country} ({pct}%)" |
| Gender shift | Compare latest vs previous snapshot | Gender delta > 5pp | "Gender mix shifting: {gender} {direction} {delta}pp" |
| Age shift | Compare latest vs previous | Top age range changed | "Audience aging/younging: top range moved {old} -> {new}" |
| Country shift | Compare latest vs previous | Top country changed | "Top country shifted {old} -> {new}" |
| Reach growth | Compare latest vs previous | Reach delta > 20% | "Reach {grew/declined} {pct}% since last snapshot" |
| Spend change | Compare latest vs previous | Spend delta > 25% | "Estimated spend {increased/decreased} {pct}%" |

**Interface:**
```typescript
export interface PatternObservation {
  type: 'skew' | 'concentration' | 'shift' | 'growth';
  category: 'gender' | 'age' | 'country' | 'reach' | 'spend';
  severity: 'notable' | 'significant';  // notable = informational, significant = large change
  message: string;                       // Human-readable summary
  data: Record<string, unknown>;         // Supporting data for tooltip/detail
}

export function observePatterns(snapshots: BrandSnapshot[]): PatternObservation[];
```

**Why no storage:** Patterns are cheap to compute (< 1ms for typical data) and change every time a new snapshot is taken. Storing them would create staleness issues. Compute on read.

---

## New API Endpoints

### 1. `POST /api/dashboard/snapshots` -- MODIFY existing

**Change:** After creating `BrandSnapshot`, also extract hooks and store as `CreativeHook` rows.

```
Existing flow:
  fetchFacebookAds() -> buildSnapshotFromApiResult() -> prisma.brandSnapshot.create()

New flow:
  fetchFacebookAds() -> buildSnapshotFromApiResult() -> prisma.brandSnapshot.create()
                     -> extractHooks(result.ads) -> prisma.creativeHook.createMany()
```

This happens inside the existing transaction. No new endpoint needed for hook creation.

### 2. `GET /api/dashboard/snapshots` -- MODIFY existing

**Change:** Add optional `?include=hooks` query parameter. When present, include `creativeHooks` in snapshot response (sorted by weightedScore desc, limit 30).

**Change:** Add optional `?include=demographics` query parameter. When present, include full `demographicsJson` for each snapshot (currently only returned for latest snapshot via overview endpoint).

### 3. `GET /api/dashboard/overview` -- MODIFY existing

**Change:** Include `creativeHooks` from the latest snapshot for each brand (top 10 per brand, for dashboard preview). Add to the existing overview payload.

### 4. `GET /api/dashboard/compare` -- NEW endpoint

**Purpose:** Return side-by-side data for two brands optimized for comparison view.

**Parameters:** `?brandA={id}&brandB={id}`

**Response:**
```typescript
{
  brandA: {
    brand: TrackedBrand;
    latestSnapshot: BrandSnapshot;     // with demographicsJson
    topHooks: CreativeHook[];          // top 15
  };
  brandB: {
    brand: TrackedBrand;
    latestSnapshot: BrandSnapshot;
    topHooks: CreativeHook[];
  };
  patterns: {
    brandA: PatternObservation[];
    brandB: PatternObservation[];
  };
}
```

**Why a dedicated endpoint:** The comparison view needs both brands' full demographic JSON + hooks + patterns in a single request. Fetching this through the overview endpoint would over-fetch (all brands) or under-fetch (missing demographicsJson for non-latest snapshots). A dedicated endpoint keeps the response focused.

### 5. `GET /api/dashboard/trends` -- NEW endpoint

**Purpose:** Return demographic breakdown time series for one brand.

**Parameters:** `?brandId={id}&limit=20`

**Response:**
```typescript
{
  brand: { id, pageName };
  snapshots: Array<{
    id: string;
    snapshotDate: string;
    // Full breakdowns for charting
    ageBreakdown: { age: string; percentage: number }[];
    genderBreakdown: { gender: string; percentage: number }[];
    regionBreakdown: { region: string; percentage: number }[];
    // Scalar metrics (already available)
    totalReach: number;
    activeAdsCount: number;
    estimatedSpendUsd: number;
  }>;
}
```

**Implementation:** Query `BrandSnapshot` with `demographicsJson` included, parse and return the breakdowns. The `demographicsJson` blob already contains everything needed.

---

## Component Hierarchy

### Dashboard Page Integration

```
DashboardPage (existing)
  |-- OwnBrandCard (existing)
  |-- CompetitorGrid (existing)
  |-- ComparisonTable (existing)
  |-- TrendChart (existing -- scalar metrics)
  |-- DemographicTrendChart (NEW -- age/gender/country over time)
  |-- DemographicsComparison (existing)
  |-- HooksPanel (NEW -- top hooks across all tracked brands)
  |-- PatternObservations (NEW -- auto-generated insights)
```

### Brand Detail Page Integration

```
BrandDetailPage (existing /dashboard/[brandId])
  |-- MetricBoxes (existing)
  |-- GenderDistribution (existing)
  |-- AgeRangeDistribution (existing)
  |-- CountryDistribution (existing)
  |-- HooksList (NEW -- this brand's hooks from latest snapshot)
  |-- DemographicTrendChart (NEW -- this brand's demographic trends)
  |-- PatternObservations (NEW -- this brand's patterns)
  |-- SnapshotHistory (existing)
```

### New Comparison Page

```
/dashboard/compare?a={brandId}&b={brandId} (NEW page)
  |-- ComparisonHeader (brand names, links)
  |-- SideBySideMetrics (scalar comparison -- reuse MetricBox)
  |-- SideBySideDemographics (NEW -- mirrored bar charts)
  |   |-- MirroredAgeChart (two Recharts BarCharts, one reversed)
  |   |-- MirroredGenderChart
  |   |-- MirroredCountryChart
  |-- SideBySideHooks (NEW -- two columns of hooks)
  |-- ComparisonPatterns (NEW -- patterns for both brands)
```

### New Components Detail

#### `HooksPanel` (dashboard-level, all brands)
- **Props:** `brands: TrackedBrand[]` (with hooks attached to latest snapshot)
- **Displays:** Horizontal scrollable cards, one per brand. Each card shows top 5 hooks with adCount and reach.
- **Interaction:** Click hook to see all ads using it (future -- for now, just display)

#### `HooksList` (brand-level, single brand)
- **Props:** `hooks: CreativeHook[]`
- **Displays:** Vertical list sorted by weightedScore. Each row: hook text, ad count badge, reach bar.
- **Interaction:** None initially (static display)

#### `DemographicTrendChart` (reusable for dashboard + detail)
- **Props:** `snapshots: TrendDemographicSnapshot[]`, `metric: 'age' | 'gender' | 'country'`
- **Displays:** Recharts `AreaChart` (stacked areas) showing breakdown percentages over time
- **Metric toggle:** Buttons to switch between age/gender/country (same pattern as existing TrendChart's metric toggle)
- **For age:** Stacked areas, one per age bracket (18-24, 25-34, 35-44, 45-54, 55-64, 65+)
- **For gender:** Stacked areas, male/female/unknown
- **For country:** Stacked areas, top 5 countries + "other"

#### `MirroredAgeChart` / `MirroredGenderChart` / `MirroredCountryChart`
- **Props:** `brandA: DemographicBreakdown`, `brandB: DemographicBreakdown`
- **Displays:** Two `BarChart` components positioned to mirror each other (brand A bars go left, brand B bars go right, shared Y axis labels in the middle)
- **Pattern:** This is a common comparison visualization. Recharts supports this via negative values on one side.

#### `PatternObservations`
- **Props:** `observations: PatternObservation[]`
- **Displays:** Card list. Each card has an icon by type (skew/shift/growth), severity indicator (color), and the message text.
- **Ordering:** Significant observations first, then notable.

---

## Data Flow Per Feature

### Feature 1: Creative Hooks Extraction

```
[Snapshot creation time]
POST /api/dashboard/snapshots
  -> fetchFacebookAds() returns FacebookAdResult[] (each has .creativeBody)
  -> extractHooks(result.ads) returns HookGroup[]
  -> prisma.$transaction:
       brandSnapshot.create(snapshotData)
       creativeHook.createMany(hookGroups.map(h => ({ ...h, snapshotId })))

[Read time]
GET /api/dashboard/overview
  -> Include creativeHooks (top 10) on each brand's latest snapshot
  -> useTrackedBrands() hook gets hooks in the payload
  -> HooksPanel renders them
```

### Feature 2: Demographic Trend Charts

```
[No new write -- data already exists in demographicsJson per snapshot]

[Read time]
GET /api/dashboard/trends?brandId=X&limit=20
  -> Query BrandSnapshot with demographicsJson for this brand
  -> Parse JSON, extract age/gender/region breakdowns per snapshot
  -> Return structured time-series array

[Display]
DemographicTrendChart fetches via useSWR or useEffect
  -> Renders Recharts AreaChart with stacked breakdowns
```

### Feature 3: Side-by-Side Brand Comparison

```
[Navigation]
User clicks "Compare" button on CompetitorCard or dashboard
  -> router.push('/dashboard/compare?a=brandAId&b=brandBId')

[Read time]
GET /api/dashboard/compare?brandA=X&brandB=Y
  -> Parallel queries for both brands' latest snapshots + hooks
  -> Run observePatterns() for each brand
  -> Return combined payload

[Display]
ComparisonPage renders mirrored charts from both snapshots
```

### Feature 4: Pattern Observations

```
[No storage -- computed at read time]

[Compute]
observePatterns(snapshots) in pattern-observer.ts
  -> Called server-side in API handlers (compare endpoint, trends endpoint)
  -> Also callable client-side if snapshots are already loaded

[Display]
PatternObservations component renders cards
  -> Used on brand detail page (single brand)
  -> Used on comparison page (both brands)
```

---

## Build Order and Dependencies

```
Phase 1: Data Foundation (hooks extraction + storage)
  |-- hook-extractor.ts (new lib module, no dependencies)
  |-- CreativeHook Prisma model (schema change + migration)
  |-- Modify POST /api/dashboard/snapshots (depends on both above)
  |
  v
Phase 2: Trend Data Access (API endpoints for demographic time series)
  |-- GET /api/dashboard/trends (new endpoint, reads existing data)
  |-- Modify GET /api/dashboard/overview (include hooks in payload)
  |-- Modify GET /api/dashboard/snapshots (add ?include= params)
  |
  v
Phase 3: Pattern Engine (observation rules)
  |-- pattern-observer.ts (new lib module, no dependencies)
  |
  v
Phase 4: Comparison Infrastructure
  |-- GET /api/dashboard/compare (new endpoint, uses pattern-observer)
  |
  v
Phase 5: UI -- Hooks Display
  |-- HooksList component (brand detail page)
  |-- HooksPanel component (dashboard page)
  |-- Modify useTrackedBrands types to include hooks
  |
  v
Phase 6: UI -- Demographic Trend Charts
  |-- DemographicTrendChart component (Recharts AreaChart)
  |-- Custom hook: useDemographicTrends(brandId)
  |-- Integrate into brand detail page
  |-- Integrate into dashboard page
  |
  v
Phase 7: UI -- Pattern Observations
  |-- PatternObservations component
  |-- Integrate into brand detail page
  |
  v
Phase 8: UI -- Comparison Page
  |-- /dashboard/compare page
  |-- MirroredAgeChart, MirroredGenderChart, MirroredCountryChart
  |-- SideBySideHooks, ComparisonPatterns
  |-- Navigation: "Compare" buttons on dashboard
```

**Why this order:**
1. **Data first, UI second** -- hooks extraction must be in place before any UI can display them
2. **Trend endpoint before trend chart** -- the chart needs data to render
3. **Pattern engine before comparison page** -- comparison page shows patterns for both brands
4. **Independent UI phases** -- hooks display, trend charts, and patterns can be developed in parallel after their data dependencies are met
5. **Comparison page last** -- it composes all other features (hooks, demographics, patterns) into a single view

---

## Patterns to Follow

### Pattern 1: Extend Snapshot Pipeline
**What:** All new data extraction happens inside the existing snapshot creation flow. When `POST /api/dashboard/snapshots` runs, it already fetches all ads. Hook extraction runs on the same `FacebookAdResult[]` -- no second API call needed.
**Why:** Avoids rate limit issues, keeps data temporally consistent (hooks are from the same moment as demographics).

### Pattern 2: JSON Blob for Flexible Breakdowns, Rows for Queryable Data
**What:** Continue storing demographic breakdowns as JSON (they are always read as a unit). Store hooks as rows (they need sorting, filtering, cross-brand queries).
**Why:** JSON blobs are efficient for "read the whole thing" patterns. Rows are efficient for "sort by X, filter by Y" patterns.

### Pattern 3: Compute-on-Read for Derived Insights
**What:** Pattern observations are not stored. They are computed when the API endpoint is called.
**Why:** Observations depend on the relationship between snapshots and would go stale whenever a new snapshot is taken. Computing them is trivially fast (< 1ms).

### Pattern 4: Dedicated Endpoints for Complex Views
**What:** The comparison view gets its own endpoint (`/api/dashboard/compare`) rather than trying to compose from multiple existing endpoints.
**Why:** Reduces waterfall requests on the client. The comparison page would otherwise need 4+ sequential fetches (brand A snapshot, brand B snapshot, brand A hooks, brand B hooks, patterns for each).

### Pattern 5: Metric Toggle UI Pattern
**What:** Reuse the same toggle button strip pattern from the existing `TrendChart` for the new `DemographicTrendChart` (age | gender | country toggle).
**Why:** Visual consistency. Users already understand this interaction pattern.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Raw Ad Copy in the Database
**What:** Temptation to store all `ad_creative_bodies` for every ad in every snapshot.
**Why bad:** 500 ads x avg 200 chars = 100KB per snapshot. With 10 brands x 30 snapshots = 30MB of text data in SQLite. More importantly, raw ad copy is not useful for analytics -- extracted hooks are.
**Instead:** Extract hooks at snapshot time, store only the grouped/aggregated hooks.

### Anti-Pattern 2: Client-Side Demographic Trend Computation
**What:** Fetching all snapshots with full `demographicsJson` to the client and computing trends there.
**Why bad:** Each snapshot's `demographicsJson` can be 2-5KB. 20 snapshots x 10 brands = 200-500KB of JSON to parse client-side. And the data needs transformation (pivot from per-snapshot to per-date-series).
**Instead:** Server endpoint parses and pivots the data. Client receives chart-ready arrays.

### Anti-Pattern 3: Over-Normalizing Demographics into Separate Tables
**What:** Creating `AgeBreakdown`, `GenderBreakdown`, `CountryBreakdown` models with foreign keys to `BrandSnapshot`.
**Why bad:** These breakdowns are always read together, never queried individually. Normalizing them adds complexity (joins, N+1 risk) without query benefit.
**Instead:** Keep as JSON blob. The existing `demographicsJson` approach is correct.

### Anti-Pattern 4: Real-Time Pattern Computation on the Client
**What:** Sending all snapshot data to the client and running pattern rules in React.
**Why bad:** The pattern engine needs access to multiple snapshots and their parsed demographics. Sending all this data for client-side processing wastes bandwidth and exposes internal data structures.
**Instead:** Compute patterns server-side in the API endpoint. Return only the observation messages + metadata.

---

## Type System Extensions

### Extend `TrackedBrandSnapshot` (client-side type in use-tracked-brands.ts)

```typescript
export interface TrackedBrandSnapshot {
  // ... existing fields ...
  creativeHooks?: CreativeHookSummary[];  // Optional, included when fetched
}

export interface CreativeHookSummary {
  hookText: string;
  adCount: number;
  totalReach: number;
  weightedScore: number;
}
```

### New Types for Trend Data

```typescript
export interface DemographicTrendPoint {
  snapshotDate: string;
  ageBreakdown: { age: string; percentage: number }[];
  genderBreakdown: { gender: string; percentage: number }[];
  regionBreakdown: { region: string; percentage: number }[];
}

export interface DemographicTrendData {
  brandId: string;
  brandName: string;
  points: DemographicTrendPoint[];
}
```

### New Types for Comparison

```typescript
export interface BrandComparisonData {
  brandA: BrandComparisonSide;
  brandB: BrandComparisonSide;
}

export interface BrandComparisonSide {
  brand: { id: string; pageName: string; adLibraryUrl: string };
  snapshot: TrackedBrandSnapshot;
  hooks: CreativeHookSummary[];
  patterns: PatternObservation[];
}
```

---

## Scalability Considerations

| Concern | Current (< 100 users) | At 1K users | Mitigation |
|---------|----------------------|-------------|------------|
| Snapshot storage | ~10 snapshots/brand, fine | ~30 snapshots/brand, still fine with indexes | Index on `[trackedBrandId, snapshotDate]` (already exists) |
| CreativeHook rows | ~50 hooks/snapshot, negligible | ~50 hooks x 30 snapshots x 10 brands = 15K rows/user | Index on `[snapshotId, weightedScore]`. Consider pruning hooks from old snapshots. |
| demographicsJson parsing | Trivial | Server-side parsing of 20 JSON blobs per trends request | Keep limit parameter, default 20 snapshots |
| Pattern computation | < 1ms | < 1ms (pure arithmetic on small arrays) | No concern |
| Comparison endpoint | 2 parallel DB queries | Same | No concern |

---

## Migration Checklist

1. Add `CreativeHook` model to `prisma/schema.prisma`
2. Add `creativeHooks CreativeHook[]` relation to `BrandSnapshot`
3. Run `npx prisma migrate dev --name add-creative-hooks`
4. Existing snapshots will have no hooks (graceful: UI shows "No hooks available -- re-analyze to extract")
5. No data migration needed for trends or patterns (they read existing `demographicsJson`)

---

## Sources

- Direct codebase analysis (HIGH confidence): all files read directly from repository
- Prisma schema: `/Users/sebastian/Codingprojects/Sitemap-experiment/prisma/schema.prisma`
- Snapshot builder: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/lib/snapshot-builder.ts`
- Facebook API client: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/lib/facebook-api.ts`
- Dashboard overview endpoint: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/app/api/dashboard/overview/route.ts`
- Existing trend chart: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/components/dashboard/trend-chart.tsx`
- Existing ad copy analysis: `/Users/sebastian/Codingprojects/Sitemap-experiment/src/components/analytics/ad-copy-analysis.tsx`
- Existing comparison components: demographics-comparison.tsx, comparison-table.tsx
