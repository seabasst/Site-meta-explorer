# Phase 48: Load-More Pagination - Research

**Researched:** 2026-03-20
**Domain:** Frontend pagination pattern (React state management, API integration)
**Confidence:** HIGH

## Summary

This phase replaces numbered page navigation with a "Load more" button that appends batches to an accumulating list. The codebase is well-structured for this change: the API already supports `page` and `limit` params and returns `hasNext`, the page component manages ads in a single `useState<Ad[]>`, and all filter/sort state resets to page 1 when changed.

The core change is small: instead of replacing `ads` on each fetch, append to it. Instead of rendering `<AdPagination>`, render a "Load more" button when `hasNext` is true. Filter/sort changes reset the accumulated list.

**Primary recommendation:** Convert the existing `fetchAds` function to support two modes -- "replace" (on filter/sort change) and "append" (on load-more click) -- and replace the `<AdPagination>` component with a simple load-more button.

## Standard Stack

No new libraries needed. This is purely a state management change using existing React primitives.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React useState | 19 | Accumulate ads array | Already in use, sufficient for this pattern |
| React useCallback | 19 | Memoize fetch function | Already in use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual state accumulation | React Query / SWR infinite | Adds dependency for a simple pattern; overkill here |
| Manual state accumulation | useReducer | More structured but unnecessary complexity for append-only |

## Architecture Patterns

### Current State (What Exists)

```
page.tsx state:
  - ads: Ad[]              -- replaced entirely on each fetch
  - page: number           -- tracks current page (1-indexed)
  - pagination: PaginationData -- { page, limit, total, totalPages }

fetchAds():
  - builds URLSearchParams with limit=24, page=N
  - calls /api/ad-library/ads?...
  - setAds(data.ads)       -- REPLACES ads array
  - setPagination(data.pagination)

Filter change effect:
  - setPage(1)             -- resets to page 1

API response shape:
  {
    ads: Ad[],
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number,
      hasNext: boolean,    // Already exists in API!
      hasPrev: boolean
    }
  }
```

### Pattern: Load-More Accumulation

**What:** Ads accumulate in state as user clicks "Load more". Filter/sort changes reset the list.

**Key state changes:**
```typescript
// REMOVE: const [page, setPage] = useState(1);
// ADD:
const [loadedAds, setLoadedAds] = useState<Ad[]>([]);
const [nextPage, setNextPage] = useState(1);
const [hasMore, setHasMore] = useState(false);
const [isLoadingMore, setIsLoadingMore] = useState(false);

// fetchAds becomes two functions:
// 1. fetchInitialAds() -- called on filter/sort change, replaces everything
// 2. loadMore() -- called on button click, appends to existing
```

**Fetch logic:**
```typescript
// On filter/sort change: reset and fetch page 1
const fetchAds = useCallback(async () => {
  setAdsLoading(true);
  const params = buildParams({ page: 1, limit: 48 }); // initial batch 48
  const data = await fetchFromApi(params);
  setLoadedAds(data.ads);          // REPLACE
  setHasMore(data.pagination.hasNext);
  setNextPage(2);
  setAdsLoading(false);
}, [/* filter deps */]);

// On "Load more" click: fetch next page and append
const loadMore = useCallback(async () => {
  setIsLoadingMore(true);
  const params = buildParams({ page: nextPage, limit: 24 }); // subsequent batches 24
  const data = await fetchFromApi(params);
  setLoadedAds(prev => [...prev, ...data.ads]); // APPEND
  setHasMore(data.pagination.hasNext);
  setNextPage(prev => prev + 1);
  setIsLoadingMore(false);
}, [nextPage, /* filter deps */]);
```

**Load-more button (replaces AdPagination):**
```typescript
{hasMore && (
  <div className="flex justify-center mt-8">
    <button
      onClick={loadMore}
      disabled={isLoadingMore}
      className="px-6 py-3 rounded-xl font-medium transition-colors ..."
    >
      {isLoadingMore ? 'Loading...' : `Load more (${loadedAds.length} of ${total})`}
    </button>
  </div>
)}
```

### Batch Sizes

Per requirement BRWS-04: initial batch 40-60 cards. Recommendation:
- **Initial load:** `limit=48` (divisible by 1, 2, 3, 4, 5, 6 columns -- clean grid)
- **Subsequent loads:** `limit=24` (half batch, quick load)
- **API max:** Already capped at 100 per request (line 149 of API route)

### Anti-Patterns to Avoid
- **Duplicating ads on append:** If user somehow triggers a fetch while one is in-flight, could get duplicates. Use a loading guard.
- **Not resetting on filter change:** Every filter/sort dependency MUST trigger a full reset (replace, not append). The existing `useEffect` that sets `page(1)` on filter change is the right pattern -- adapt it to reset `loadedAds` and `nextPage`.
- **Scroll-to-top on load-more:** Do NOT scroll to top when appending. Only scroll to top on filter/sort change (optional).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Infinite scroll | Intersection Observer auto-loading | Simple "Load more" button | Requirement says button, not infinite scroll |
| Deduplication logic | Complex ID tracking | Loading guard (disable button during fetch) | Prevents the problem entirely |
| Virtual scrolling | Custom windowing for large lists | Native DOM rendering | Even 200-300 cards render fine; premature optimization |

## Common Pitfalls

### Pitfall 1: Saved-ads check on load-more
**What goes wrong:** The current `fetchAds` checks saved status for ALL fetched ads. On load-more, it should only check the NEW batch, not re-check all accumulated ads.
**How to avoid:** After appending new ads, only call `/api/ad-library/saved/check` with the new batch's IDs, then merge into the existing `savedAdIds` set.

### Pitfall 2: Stale filter state in loadMore closure
**What goes wrong:** If `loadMore` captures stale filter values, the appended page could use different filters than the initial load.
**How to avoid:** Include all filter dependencies in `loadMore`'s useCallback dependency array, OR store current filter params in a ref that loadMore reads.

### Pitfall 3: "Page X of Y" display breaks
**What goes wrong:** The current header shows "Page {page} of {totalPages}" which no longer makes sense.
**How to avoid:** Replace with "Showing {loadedAds.length} of {total}" counter.

### Pitfall 4: Memory growth with many loads
**What goes wrong:** User loads 500+ ads, page becomes sluggish.
**How to avoid:** Not a real concern for this use case (users rarely load beyond 200). But optionally cap at ~300 ads and show "Refine your filters" message.

### Pitfall 5: Loading skeleton shows on load-more
**What goes wrong:** The current loading state shows skeleton placeholders that REPLACE the entire grid. On load-more, existing ads should stay visible.
**How to avoid:** Use separate loading states: `adsLoading` for initial/filter-change loads (shows skeletons), `isLoadingMore` for append loads (shows spinner on button only).

## Code Examples

### Updated types.ts -- PaginationData becomes optional/simplified
```typescript
// The PaginationData type can stay but add hasMore convenience:
export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;  // API already returns this
}
```

### Load-more button component
```typescript
export function LoadMoreButton({
  onClick,
  loading,
  loadedCount,
  totalCount,
  darkMode,
}: {
  onClick: () => void;
  loading: boolean;
  loadedCount: number;
  totalCount: number;
  darkMode: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 mt-8">
      {/* Progress indicator */}
      <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Showing {loadedCount} of {totalCount.toLocaleString()}
      </span>

      <button
        onClick={onClick}
        disabled={loading}
        className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all ${
          darkMode
            ? 'bg-[#1235e2]/15 text-[#1235e2] hover:bg-[#1235e2]/25 border border-[#1235e2]/20'
            : 'bg-[#1235e2]/10 text-[#1235e2] hover:bg-[#1235e2]/15 border border-[#1235e2]/20'
        } disabled:opacity-50`}
      >
        {loading ? 'Loading...' : 'Load more'}
      </button>
    </div>
  );
}
```

### Saved-ads check for appended batch only
```typescript
// After appending new ads:
const newAdIds = newAds.map((a: Ad) => a.id);
try {
  const checkRes = await fetch('/api/ad-library/saved/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adIds: newAdIds }),
  });
  if (checkRes.ok) {
    const { savedAdIds: ids } = await checkRes.json();
    setSavedAdIds(prev => new Set([...prev, ...ids]));
  }
} catch { /* Non-critical */ }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Numbered pagination | Load-more / infinite scroll | Industry standard since ~2018 | Better UX for visual browsing |
| Replace state on page change | Accumulate state | N/A | Core of this phase |

## Files to Modify

| File | Change | Complexity |
|------|--------|------------|
| `src/app/dashboard/v2/ad-library/page.tsx` | Refactor state: accumulate ads, split loading states, add loadMore function, replace AdPagination with LoadMoreButton | Medium |
| `src/app/dashboard/v2/ad-library/components/pagination.tsx` | Replace with load-more-button.tsx (or repurpose) | Low |
| `src/app/dashboard/v2/ad-library/types.ts` | Ensure PaginationData includes hasNext | Trivial (already has it in API, just needs client type) |

**Files NOT to modify:**
- API route (`/api/ad-library/ads/route.ts`) -- already supports page/limit/hasNext perfectly
- AdCard, FilterBar, StatsBar -- no changes needed

## Open Questions

1. **Scroll behavior on filter change**
   - What we know: Load-more should NOT scroll. Filter change resets the list.
   - What's unclear: Should filter/sort change scroll to top of grid?
   - Recommendation: Yes, scroll to top of grid section on filter/sort reset for UX consistency.

2. **Progress bar vs text**
   - What we know: Need to show "X of Y" somewhere
   - What's unclear: Visual treatment (text only, or progress bar)
   - Recommendation: Start with text ("Showing 48 of 1,234"), add progress bar later if desired.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `page.tsx` (lines 127-194) -- current fetchAds implementation
- Direct code inspection of API route (lines 329-416) -- pagination response shape with hasNext/hasPrev
- Direct code inspection of `pagination.tsx` -- current numbered pagination component
- Direct code inspection of `types.ts` -- PaginationData interface

### Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, pure React state
- Architecture: HIGH -- direct code inspection, clear transformation path
- Pitfalls: HIGH -- identified from actual code patterns (saved-ads check, loading states, filter reset)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable pattern, no external dependencies)
