# Phase 29: Hook Exploration UI - Research

**Researched:** 2026-02-02
**Domain:** React client components, Prisma data fetching, Tailwind CSS card layouts
**Confidence:** HIGH

## Summary

Phase 29 adds a hook exploration section to the brand detail page at `/dashboard/[brandId]`. The HookGroup data model and persistence are fully implemented in Phase 28 -- this phase is purely UI work: fetching hook groups for the latest snapshot, rendering them as cards sorted by reach-weighted frequency, adding text search/filter, and expanding a hook group to show the list of ad IDs that use that hook.

The existing codebase provides clear patterns to follow. The brand detail page (`src/app/dashboard/[brandId]/page.tsx`) is a client component that fetches data via `useTrackedBrands` hook and a separate `/api/dashboard/snapshots` call. All dashboard sections use `glass rounded-2xl p-6` containers with `var(--text-*)` and `var(--accent-green)` CSS variables. There are no existing API endpoints that return hook groups -- a new endpoint or extension of the snapshots endpoint is needed.

**Primary recommendation:** Add a dedicated `/api/dashboard/hooks` GET endpoint that returns hook groups for a snapshot, then build a `HookExplorer` client component that renders inside the brand detail page below the existing metrics sections.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (client component) | 19.2.3 | Component rendering | Already used throughout app |
| Tailwind CSS v4 | ^4 | Styling | All existing components use Tailwind |
| lucide-react | ^0.563.0 | Icons (Search, ChevronDown, etc.) | Already installed, used in dashboard |
| Prisma Client | ^7.3.0 | Database queries for HookGroup | Already used for all data access |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | ^2.0.7 | Toast notifications | Error states on fetch failure |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New /api/dashboard/hooks endpoint | Include hookGroups in overview API | Overview API serves the dashboard list page -- adding hook data would bloat it for all brands. Separate endpoint is cleaner. |
| Client-side search filter | Server-side search | Hook groups per snapshot are small (typically <100). Client-side `Array.filter` is simpler and instant. |

**Installation:**
No new packages needed. Everything required is already installed.

## Architecture Patterns

### Data Flow
```
Browser
  |
  v
/dashboard/[brandId]/page.tsx (client component)
  |-- useTrackedBrands() -> /api/dashboard/overview (brand + latest snapshot)
  |-- fetchHistory() -> GET /api/dashboard/snapshots (history list)
  |-- NEW: fetchHooks() -> GET /api/dashboard/hooks?snapshotId=XXX
  |
  v
HookExplorer component (receives hookGroups array)
  |-- useState for searchQuery (client-side filter)
  |-- useState for expandedGroupId (toggle ad list)
```

### Recommended Component Structure
```
src/
  components/
    dashboard/
      hook-explorer.tsx         # Main section: search bar + hook card list
      hook-card.tsx             # Individual hook group card (expandable)
  app/
    api/
      dashboard/
        hooks/
          route.ts              # GET endpoint returning hook groups for a snapshot
    dashboard/
      [brandId]/
        page.tsx                # Modified to include HookExplorer section
```

### Pattern 1: Glass Section Container (existing pattern)
**What:** Every section on the brand detail page uses a consistent container pattern.
**When to use:** The hook explorer section wrapper.
**Example:**
```tsx
// Source: src/app/dashboard/[brandId]/page.tsx lines 222-243
<div className="glass rounded-2xl p-6">
  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Opening Hooks</h3>
  {/* content */}
</div>
```

### Pattern 2: Search Input (existing pattern from dashboard)
**What:** The competitors section already has a search input with icon.
**When to use:** For the hook text search/filter.
**Example:**
```tsx
// Source: src/app/dashboard/page.tsx lines 265-273
<div className="relative w-full sm:w-64">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
  <input
    type="text"
    placeholder="Search hooks..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)] w-full"
  />
</div>
```

### Pattern 3: MetricBox (existing pattern)
**What:** Small stat boxes used in the brand detail page.
**When to use:** Showing frequency and reach stats on each hook card.
**Example:**
```tsx
// Source: src/app/dashboard/[brandId]/page.tsx lines 341-348
function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4">
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
```

### Pattern 4: Expandable Card (new but follows existing styling)
**What:** A hook card that shows the hook text, frequency, and reach at a glance, with a click-to-expand section showing the ad IDs.
**When to use:** Each hook group row.
**Example:**
```tsx
<div className="rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
  <button
    onClick={() => setExpanded(prev => prev === id ? null : id)}
    className="w-full flex items-center justify-between p-4 text-left"
  >
    <div className="flex-1 min-w-0">
      <p className="text-sm text-[var(--text-primary)] font-medium truncate">{hookText}</p>
      <div className="flex gap-4 mt-1 text-xs text-[var(--text-muted)]">
        <span>{frequency} ads</span>
        <span>{formatReach(totalReach)} reach</span>
      </div>
    </div>
    <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-180' : ''}`} />
  </button>
  {expanded && (
    <div className="border-t border-[var(--border-subtle)] p-4">
      {/* List of ad IDs */}
    </div>
  )}
</div>
```

### Anti-Patterns to Avoid
- **Do NOT fetch hooks in the overview API:** The overview endpoint serves the dashboard listing page. Adding hookGroups there would send unnecessary data for all brands when only one is viewed.
- **Do NOT use server components for this page:** The brand detail page is already a client component with interactive state. Adding the hook explorer as a server component would require restructuring. Keep it client-side.
- **Do NOT paginate hook groups:** Typical hook group counts are well under 100 per snapshot. Client-side filtering is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Search/filter | Custom search algorithm | Simple `Array.filter` with `String.includes` | Hook groups are small arrays (<100), no need for fuzzy search |
| Sorting | Custom sort logic | `Array.sort` by `totalReach` descending | Data is already sorted from the API (Prisma orderBy), but client re-sort after filter is trivial |
| Number formatting | Custom formatter | Reuse the existing `formatReach()` function from brand detail page | Already exists at line 350 of the brand detail page |
| BigInt serialization | Custom handler | Reuse the existing `serializeSnapshot` pattern | Already used in snapshots route.ts line 151-156 |

**Key insight:** This is standard CRUD UI work. The data model is complete. The visual patterns exist. No new libraries or complex logic needed.

## Common Pitfalls

### Pitfall 1: BigInt JSON Serialization
**What goes wrong:** HookGroup.totalReach is `BigInt` in Prisma. `JSON.stringify` throws on BigInt values.
**Why it happens:** Prisma returns BigInt for the field type. The API route must convert before sending.
**How to avoid:** Use the same serialize pattern from the snapshots route: `JSON.parse(JSON.stringify(data, (_k, v) => typeof v === 'bigint' ? Number(v) : v))`
**Warning signs:** Runtime error "Do not know how to serialize a BigInt"

### Pitfall 2: Missing Snapshot ID for Hook Fetch
**What goes wrong:** The brand detail page loads brand data via `useTrackedBrands` which includes the latest snapshot, but the snapshot ID is needed to fetch hooks.
**Why it happens:** Hook groups are linked to a specific snapshot, not directly to the brand.
**How to avoid:** Extract `snapshot.id` from the already-loaded brand data, then pass it to the hooks API call. Ensure the hook fetch waits until brand data is available (useEffect dependency).
**Warning signs:** Hooks API called with undefined snapshotId.

### Pitfall 3: adIds Contains Facebook Ad Archive IDs, Not Internal IDs
**What goes wrong:** Trying to link ad IDs to internal database records that don't exist.
**Why it happens:** The `adIds` field in HookGroup stores the Facebook ad archive IDs (from the API response). These are external identifiers, not Prisma record IDs.
**How to avoid:** Display ad IDs as external references. Link them to the Facebook Ad Library URL pattern: `https://www.facebook.com/ads/library/?id={adId}`
**Warning signs:** Trying to query a local `Ad` model that doesn't exist.

### Pitfall 4: Empty Hook Groups
**What goes wrong:** Showing an empty or broken hook section when no hooks were extracted.
**Why it happens:** Older snapshots (pre-Phase-28) will not have any hook groups. Some brands may have ads with no text bodies.
**How to avoid:** Add an empty state: "No opening hooks found for this snapshot." Guard the entire section with a `hookGroups.length > 0` check, or show the section with an informative empty state.
**Warning signs:** Blank section or missing heading when no hooks exist.

### Pitfall 5: Sorting Must Be by totalReach (Reach-Weighted), Not Just Frequency
**What goes wrong:** Sorting by frequency alone may show high-frequency but low-reach hooks at the top.
**Why it happens:** Requirement HOOK-04 says "ranked by reach-weighted frequency." The `totalReach` field already encodes this -- it's the sum of `eu_total_reach` across all ads using that hook.
**How to avoid:** Sort by `totalReach` descending as the default. The Prisma index `@@index([snapshotId, totalReach])` already supports this.
**Warning signs:** Low-impact hooks appearing at the top.

## Code Examples

### API Endpoint: GET /api/dashboard/hooks
```typescript
// Source: Pattern from src/app/api/dashboard/snapshots/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const snapshotId = searchParams.get('snapshotId');

  if (!snapshotId) {
    return NextResponse.json({ error: 'Missing snapshotId' }, { status: 400 });
  }

  // Verify ownership through snapshot -> brand -> user
  const snapshot = await prisma.brandSnapshot.findFirst({
    where: {
      id: snapshotId,
      OR: [
        { user: { id: session.user.id } },
      ],
    },
  });

  if (!snapshot) {
    return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
  }

  const hookGroups = await prisma.hookGroup.findMany({
    where: { snapshotId },
    orderBy: { totalReach: 'desc' },
  });

  return NextResponse.json({
    hookGroups: serialize(hookGroups),
  });
}

function serialize(obj: unknown) {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}
```

### Client-Side Hook Type
```typescript
export interface HookGroupDisplay {
  id: string;
  hookText: string;
  normalizedText: string;
  frequency: number;
  totalReach: number;
  avgReachPerAd: number;
  adIds: string[];
}
```

### Client-Side Filtering
```typescript
const filteredHooks = useMemo(() => {
  if (!searchQuery.trim()) return hookGroups;
  const q = searchQuery.toLowerCase();
  return hookGroups.filter(g =>
    g.hookText.toLowerCase().includes(q)
  );
}, [hookGroups, searchQuery]);
```

### Ad Library Link from Ad ID
```typescript
// adIds are Facebook Ad Archive IDs
function getAdLibraryUrl(adId: string): string {
  return `https://www.facebook.com/ads/library/?id=${adId}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ad copy analysis only (word counts, CTAs) | Extracted hook groups with reach weighting | Phase 28 (Feb 2026) | Hooks are now structured data, not ad-hoc text analysis |
| No hook display on brand detail page | HookGroup model ready for UI | Phase 28 | Just needs API endpoint + UI component |

**Key data points from Phase 28:**
- HookGroup model: `id, hookText, normalizedText, frequency, totalReach, avgReachPerAd, adIds (Json), snapshotId`
- Prisma indexes: `@@index([snapshotId])` and `@@index([snapshotId, totalReach])`
- Two write paths: (1) save-brand route, (2) snapshot POST route
- adIds is a JSON array of Facebook ad archive ID strings

## Open Questions

1. **How should the "expand to see ads" work when we only have ad IDs?**
   - What we know: adIds contains Facebook Ad Archive IDs (external). There is no local `Ad` model with full ad data.
   - What's unclear: Should we show just the IDs as links, or fetch additional ad info?
   - Recommendation: Show ad IDs as clickable links to Facebook Ad Library (`facebook.com/ads/library/?id=XXX`). This is simple, requires no additional API calls, and is immediately useful. Fetching ad details would require re-querying Facebook API which is expensive and rate-limited.

2. **Should the hook section appear for snapshots created before Phase 28?**
   - What we know: Pre-Phase-28 snapshots have no HookGroup records.
   - What's unclear: Should we hide the section entirely or show an empty state?
   - Recommendation: Show the section with an empty state message like "No hooks available. Re-analyze to extract opening hooks." This guides users to re-analyze for fresh data.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` - HookGroup model definition (lines 94-110)
- `src/app/dashboard/[brandId]/page.tsx` - Brand detail page structure (355 lines)
- `src/app/api/dashboard/snapshots/route.ts` - Snapshot API pattern (158 lines)
- `src/app/api/dashboard/overview/route.ts` - Overview API (does NOT include hookGroups)
- `src/lib/hook-extractor.ts` - Hook extraction types (HookGroupData interface)
- `src/app/dashboard/page.tsx` - Dashboard search/filter pattern (lines 264-273)
- `src/components/dashboard/competitor-card.tsx` - Card component pattern
- `src/components/analytics/ad-copy-analysis.tsx` - Analytics display patterns

### Secondary (MEDIUM confidence)
- Phase 28 verification report confirms all data infrastructure is complete

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed, all patterns exist in codebase
- Architecture: HIGH - Direct codebase investigation, clear extension points
- Pitfalls: HIGH - Identified from actual code (BigInt serialization, adIds type, etc.)

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (stable -- internal UI patterns unlikely to change)
