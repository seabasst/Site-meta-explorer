---
phase: 49-inline-analytics-bar
plan: 01
subsystem: ui, api
tags: [react, prisma, tailwind, analytics, stats-strip, filtered-stats]

# Dependency graph
requires:
  - phase: 48-load-more-pagination
    provides: Load-more pagination and ads API structure
  - phase: 47-filter-sort-overhaul
    provides: FilterBar component and filter state management
provides:
  - filteredStats field in ads API response (totalReach, activeCount, formatBreakdown, topCategories)
  - StatsStrip component (compact single-row analytics bar)
  - Stats that update on every filter change
affects: [50-lightbox-gallery, 51-demographic-peek]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Piggybacking aggregate stats on existing API response to avoid extra network requests"
    - "Two-step Prisma approach for cross-relation groupBy (distinct IDs -> groupBy on related model)"

key-files:
  created:
    - src/app/dashboard/v2/ad-library/components/stats-strip.tsx
  modified:
    - src/app/api/ad-library/ads/route.ts
    - src/app/dashboard/v2/ad-library/types.ts
    - src/app/dashboard/v2/ad-library/page.tsx

key-decisions:
  - "Piggybacked filteredStats on ads API response instead of separate stats API call"
  - "Used two-step Prisma approach for category aggregation (distinct brandIds -> brand groupBy) instead of raw SQL"
  - "Skip active count query when already filtering isActive=true (activeCount equals total)"
  - "Removed /api/ad-library/stats fetch from page mount (stats now come from ads response)"

patterns-established:
  - "Inline aggregate stats in paginated API responses for filter-aware analytics"

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 49 Plan 01: Inline Analytics Bar Summary

**Compact single-row StatsStrip with filtered stats (reach, active count, formats, categories) piggybacked on ads API response**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T07:39:16Z
- **Completed:** 2026-03-20T07:41:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended ads API with filteredStats computed in parallel (aggregate reach, active count, format groupBy, category groupBy via two-step approach)
- Created StatsStrip component -- compact single-row with active ads, total reach, format breakdown, and top categories
- Stats update on every filter change with no extra API calls
- Removed old 4-card StatsBar and eliminated the separate /api/ad-library/stats fetch on mount

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ads API with filteredStats response field** - `c565db1` (feat)
2. **Task 2: Create StatsStrip component and wire into page** - `c1d319f` (feat)

## Files Created/Modified
- `src/app/api/ad-library/ads/route.ts` - Added parallel queries for reach, active count, format groupBy, brand categories; added filteredStats to response
- `src/app/dashboard/v2/ad-library/types.ts` - Added FilteredStats interface
- `src/app/dashboard/v2/ad-library/components/stats-strip.tsx` - New compact single-row analytics strip component
- `src/app/dashboard/v2/ad-library/page.tsx` - Replaced StatsBar with StatsStrip, removed stats fetch from mount, extract filteredStats from ads response

## Decisions Made
- Used two-step Prisma approach for category aggregation instead of raw SQL (more maintainable, avoids duplicating WHERE clause)
- Skip active count query when isActive filter is already true (active count = total count in that case)
- Removed /api/ad-library/stats fetch from page mount entirely (no longer needed since stats come from ads API)
- Opacity reduction for loading state instead of skeleton (preserves layout, reduces visual noise)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Stats strip is live and updating with filters
- stats-bar.tsx still exists but is no longer imported (can be cleaned up in a future phase)
- Ready for Phase 50 (lightbox gallery) and Phase 51 (demographic peek)

---
*Phase: 49-inline-analytics-bar*
*Completed: 2026-03-20*
