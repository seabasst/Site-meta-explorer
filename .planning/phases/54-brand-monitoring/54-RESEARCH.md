# Phase 54: Brand Monitoring - Research

**Researched:** 2026-03-21
**Domain:** Brand monitoring persistence, per-brand dashboard with demographics
**Confidence:** HIGH

## Summary

Research focused on understanding the existing brand monitoring infrastructure in the codebase, identifying what is broken about persistence (BMON-01), and what components exist to support a per-brand dashboard (BMON-02).

The monitoring backend is fully functional -- API endpoints for POST/DELETE/GET/check all exist and work correctly with Prisma + auth. The persistence issue is on the **frontend side**: the monitor button only exists on the `/dashboard/v2/brands` page, not on the brand detail page (`/dashboard/v2/ad-library/[pageId]`) or the main ad-library browse page. When users navigate away from the brands page, there is no visual indicator of monitoring state. The brands page itself correctly fetches and displays monitored brands with optimistic updates.

For BMON-02, the brand detail page (`/dashboard/v2/ad-library/[pageId]`) already shows a brand header with stats and a paginated ad grid, but has **no demographics section and no monitor button**. Demographics data is available on `AdLibraryBrand.demographicsJson` and the `DemographicPeek` component (using Recharts) already renders age/gender/region charts. The per-brand dashboard needs to combine the existing brand detail page with a monitor button and demographic charts.

**Primary recommendation:** Extend the existing brand detail page at `/dashboard/v2/ad-library/[pageId]` with a monitor toggle button and a demographics section using the existing `DemographicPeek` component. The `/api/ad-library/brands/[pageId]` endpoint already returns `demographicsJson`.

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | App framework with App Router | Project framework |
| React | 19 | UI rendering | Project framework |
| Prisma | current | ORM for PostgreSQL | Project ORM |
| Recharts | ^3.6.0 | Charting (bar charts for demographics) | Already used in DemographicPeek |
| NextAuth | current | Authentication | Already integrated |
| Tailwind CSS | v4 | Styling | Project styling |
| Lucide React | current | Icons | Project icon library |

### Supporting (already available)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `demographics-normalizer.ts` | Normalize demographicsJson variations | When rendering demographic charts |
| `V2Shell`, `V2Card`, `V2SectionTitle` | Shared UI components | All dashboard pages |
| `useV2` context | Dark mode state | All v2 components |

### No New Dependencies Needed

Everything required is already in the project. No new packages to install.

## Architecture Patterns

### Existing File Structure (relevant)
```
src/
  app/
    dashboard/v2/
      brands/page.tsx              # Brands list + monitor toggle (working)
      ad-library/
        page.tsx                   # Main ad browse (no monitor button)
        [pageId]/page.tsx          # Brand detail (needs monitor + demographics)
        components/
          ad-card.tsx              # Reusable ad card
          demographic-peek.tsx     # Age/gender/region charts (reusable)
  app/api/
    ad-library/
      brands/
        route.ts                   # List brands
        [pageId]/route.ts          # Brand detail + ads (returns demographicsJson)
        monitor/
          route.ts                 # GET/POST/DELETE monitored brands
          check/route.ts           # Batch check monitored status
  lib/
    demographics-normalizer.ts     # NormalizedDemographics type + normalizer
```

### Pattern 1: Monitor Button with Optimistic Updates
**What:** The brands page already implements this pattern correctly.
**When to use:** Replicate this for the brand detail page.
**Example from `src/app/dashboard/v2/brands/page.tsx`:**
```typescript
const toggleMonitor = async (brandId: string) => {
  const isMonitored = monitoredIds.has(brandId);
  // Optimistic update
  setMonitoredIds((prev) => {
    const next = new Set(prev);
    if (isMonitored) next.delete(brandId);
    else next.add(brandId);
    return next;
  });
  try {
    await fetch('/api/ad-library/brands/monitor', {
      method: isMonitored ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId }),
    });
  } catch {
    // Revert on error
  }
};
```

### Pattern 2: Demographics Rendering
**What:** Use `normalizeDemographicsJson()` to normalize the JSON, then pass to `DemographicPeek`.
**When to use:** When brand detail page has `demographicsJson` from the API.
**Example:**
```typescript
import { normalizeDemographicsJson } from '@/lib/demographics-normalizer';
import { DemographicPeek } from '../components/demographic-peek';

const demographics = brand.demographicsJson
  ? normalizeDemographicsJson(brand.demographicsJson)
  : null;

{demographics && (
  <DemographicPeek
    demographics={demographics}
    darkMode={darkMode}
    collapsed={false}
    onToggleCollapse={() => setDemCollapsed(prev => !prev)}
  />
)}
```

### Pattern 3: Auth-Gated Features with Graceful Fallback
**What:** Monitor features require auth, but the page itself should work without auth.
**When to use:** The brand detail page is public; the monitor button should only appear when authenticated.
**Example:**
```typescript
// Check monitor status only if authenticated
const checkRes = await fetch('/api/ad-library/brands/monitor/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ brandIds: [brandId] }),
});
// Returns { monitoredBrandIds: [] } for unauthenticated users (no 401)
```

### Anti-Patterns to Avoid
- **Duplicating the ad card component:** The brand detail page has its own `BrandAdCard` inline component that is nearly identical to `AdCard` from `components/ad-card.tsx`. The per-brand dashboard should reuse the shared `AdCard` or the existing inline one, not create a third version.
- **Creating a separate route for the "dashboard":** The brand detail page at `/dashboard/v2/ad-library/[pageId]` IS the natural home for the per-brand dashboard. Do not create a separate `/dashboard/v2/brands/[pageId]` route.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Demographics normalization | Custom JSON parsing | `normalizeDemographicsJson()` from `src/lib/demographics-normalizer.ts` | Handles old and new JSON formats, edge cases |
| Demographic charts | Custom SVG/Canvas charts | `DemographicPeek` component with Recharts | Already styled, dark mode aware, handles empty data |
| BigInt serialization | Manual toString | Existing `serializeBrand()` helper in API routes | Handles BigInt -> number conversion for JSON |
| Optimistic toggle state | Custom state management | Copy pattern from `brands/page.tsx` `toggleMonitor` | Proven pattern with error rollback |
| Auth check for monitor | Custom session hook | `/api/ad-library/brands/monitor/check` POST endpoint | Returns empty array for unauthenticated (no 401) |

## Common Pitfalls

### Pitfall 1: Monitor Button Not Showing Brand Internal ID vs PageId
**What goes wrong:** The monitor API uses `brandId` (internal cuid), but the brand detail page routes by `pageId` (Facebook page ID). Mixing these up will cause monitor toggle failures.
**Why it happens:** Two different ID systems: `brand.id` (cuid) vs `brand.pageId` (Facebook ID).
**How to avoid:** The `/api/ad-library/brands/[pageId]` endpoint returns `brand.id` in its response. Use that `brand.id` for monitor API calls, NOT the URL param `pageId`.
**Warning signs:** 404 or silent failures when toggling monitor.

### Pitfall 2: DemographicsJson May Be Null
**What goes wrong:** Not all brands have demographics data. Rendering charts without null checks causes crashes.
**Why it happens:** Demographics are fetched separately and may not exist for all brands.
**How to avoid:** Always check `brand.demographicsJson` before normalizing. `DemographicPeek` handles empty breakdowns by returning null, but `normalizeDemographicsJson` must receive a non-null value.
**Warning signs:** Runtime errors on brand pages without demographic data.

### Pitfall 3: Monitor Check Endpoint Returns Empty for Unauthenticated
**What goes wrong:** The `/api/ad-library/brands/monitor/check` endpoint returns `{ monitoredBrandIds: [] }` (200 OK) when not authenticated, NOT a 401. This is by design for graceful degradation.
**Why it happens:** Intentional design to allow public browsing with optional auth features.
**How to avoid:** Don't conditionally call the check endpoint based on session state. Just call it and handle the empty response gracefully.

### Pitfall 4: BigInt Serialization in Brand API Response
**What goes wrong:** `totalReach` is a BigInt in the database but serialized as a string in the API response.
**Why it happens:** JSON does not support BigInt natively.
**How to avoid:** Use `Number(brand.totalReach)` when displaying, as the brands page does with `formatNumber`.

## Code Examples

### Brand Detail Page API Response Shape
Source: `/api/ad-library/brands/[pageId]/route.ts`
```typescript
// Response includes demographicsJson at brand level
{
  brand: {
    id: string,           // Internal cuid - USE THIS for monitor API
    pageId: string,       // Facebook page ID - URL param
    pageName: string,
    demographicsJson: {   // May be null
      ageBreakdown: [{ age: string, percentage: number }],
      genderBreakdown: [{ gender: string, percentage: number }],
      regionBreakdown: [{ region: string, percentage: number }]
    } | null,
    totalReach: string,   // BigInt as string
    activeAdCount: number,
    // ... other fields
  },
  ads: [...],
  pagination: { page, pageSize, total, totalPages }
}
```

### Monitor API Endpoints
```typescript
// Check if brand is monitored (works for unauthenticated too)
POST /api/ad-library/brands/monitor/check
Body: { brandIds: ["cuid-here"] }
Response: { monitoredBrandIds: ["cuid-here"] } // or empty array

// Toggle monitor on
POST /api/ad-library/brands/monitor
Body: { brandId: "cuid-here" }
Response: { monitored: true, id: "monitor-cuid" }

// Toggle monitor off
DELETE /api/ad-library/brands/monitor
Body: { brandId: "cuid-here" }
Response: { monitored: false }

// List monitored brands
GET /api/ad-library/brands/monitor?limit=100
Response: { brands: [...], pagination: {...} }
```

### Shared UI Components Available
```typescript
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';       // { darkMode }
import { AdCard } from '../components/ad-card';
import { DemographicPeek } from '../components/demographic-peek';
import { normalizeDemographicsJson } from '@/lib/demographics-normalizer';
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Demographics as nested objects | Array-based breakdowns | v5.0 pipeline | `normalizeDemographicsJson` handles both |
| Separate TrackedBrand model | MonitoredBrand model (simpler) | v5.0 pipeline | Simpler schema, just userId + brandId |

**Key insight:** The `TrackedBrand` model is a legacy model from the old dashboard. The `MonitoredBrand` model is the v2 approach -- simpler, just a join table between User and AdLibraryBrand. All new code should use `MonitoredBrand`.

## Open Questions

1. **Should the "top ads" grid on the per-brand dashboard be sorted by reach or recency?**
   - What we know: The existing brand detail page sorts by `startDate` desc by default, but supports `reachEstimate` sort. The requirement says "top ads grid" which implies by reach.
   - Recommendation: Default sort by `reachEstimate` desc for the "top ads" section. The API already supports this via `?sortBy=reachEstimate&sortOrder=desc`.

2. **How many "top ads" to show in the mini dashboard?**
   - What we know: Current brand detail page shows 24 per page. A "mini dashboard" implies fewer.
   - Recommendation: Show 6-9 top ads (a single row or two on desktop) with a "View all" link to the full paginated list.

3. **Where should the monitor button appear beyond the brand detail page?**
   - What we know: Currently only on `/dashboard/v2/brands`. The main ad-library page does not have monitor buttons.
   - Recommendation: Focus on the brand detail page for BMON-01. Adding it to the ad-library browse page is a nice-to-have but not required by the spec.

## Sources

### Primary (HIGH confidence)
- Codebase analysis of all files listed in Architecture Patterns section
- `prisma/schema.prisma` -- MonitoredBrand model at lines 45-57
- `src/app/api/ad-library/brands/monitor/route.ts` -- Full CRUD API
- `src/app/api/ad-library/brands/monitor/check/route.ts` -- Batch check endpoint
- `src/app/dashboard/v2/brands/page.tsx` -- Monitor toggle implementation
- `src/app/dashboard/v2/ad-library/[pageId]/page.tsx` -- Brand detail page (no monitor, no demographics)
- `src/app/dashboard/v2/ad-library/components/demographic-peek.tsx` -- Reusable chart component
- `src/lib/demographics-normalizer.ts` -- JSON normalization utility
- `src/app/api/ad-library/brands/[pageId]/route.ts` -- Brand detail API (includes demographicsJson)
- `src/auth.ts` -- NextAuth configuration with demo credentials

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, verified in package.json and codebase
- Architecture: HIGH - All patterns observed directly in codebase
- Pitfalls: HIGH - Derived from direct code analysis of ID systems, null handling, BigInt serialization

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable internal codebase, no external dependencies to drift)
