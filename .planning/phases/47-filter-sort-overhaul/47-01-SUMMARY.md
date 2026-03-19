---
phase: 47-filter-sort-overhaul
plan: 01
subsystem: api
tags: [prisma, sorting, filtering, ads-api, bylines]

# Dependency graph
requires:
  - phase: 46-component-extraction
    provides: "Extracted ad library components ready for enhanced filtering"
provides:
  - "API sort support for spendLower and adDurationDays fields"
  - "API hasBylines filter for partnership ad filtering"
  - "SortField type, SORT_OPTIONS constant, GridDensity type for frontend"
affects: [47-02-PLAN, 47-filter-sort-overhaul]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-nullable fields use plain SortOrder; nullable fields use { sort, nulls: 'last' } in Prisma orderBy"

key-files:
  created: []
  modified:
    - src/app/api/ad-library/ads/route.ts
    - src/app/dashboard/v2/ad-library/types.ts

key-decisions:
  - "Fixed buildOrderByClause to distinguish nullable vs non-nullable fields for Prisma 7 query compiler"
  - "Exported GridDensity type alongside SortField for Plan 02/03 consumption"

patterns-established:
  - "Sort field validation: non-nullable fields (createdAt) use plain SortOrder, nullable fields use extended { sort, nulls } syntax"

# Metrics
duration: 17min
completed: 2026-03-19
---

# Phase 47 Plan 01: API Sort & Filter Extensions Summary

**Extended ads API with spendLower/adDurationDays sort fields, hasBylines partnership filter, and SortField type exports for frontend**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-19T16:31:56Z
- **Completed:** 2026-03-19T16:48:29Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- 5 sort fields now work: reachEstimate, spendLower, adDurationDays, startDate, createdAt
- hasBylines=true/false filter correctly returns partnership/non-partnership ads
- SortField, SORT_OPTIONS, and GridDensity types exported for Plan 02 frontend consumption
- Fixed Prisma 7 orderBy validation for non-nullable fields

## Task Commits

Each task was committed atomically:

1. **Task 1: Add spendLower and adDurationDays sort fields** - `3705ac2` (feat)
2. **Task 2: Add hasBylines filter and export SortField type** - `7df41d2` (feat)

## Files Created/Modified
- `src/app/api/ad-library/ads/route.ts` - Extended sort fields, hasBylines filter, fixed orderBy for non-nullable fields
- `src/app/dashboard/v2/ad-library/types.ts` - SortField type, SORT_OPTIONS constant, GridDensity type

## Decisions Made
- Fixed `buildOrderByClause` to use plain `SortOrder` for non-nullable fields (`createdAt`) instead of the `{ sort, nulls }` extended syntax. Prisma 7's query compiler requires plain SortOrder for non-nullable columns. Nullable fields continue using `{ sort: order, nulls: 'last' }`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed buildOrderByClause for non-nullable fields**
- **Found during:** Task 2 (hasBylines filter implementation)
- **Issue:** Prisma 7 query compiler rejects `{ sort: 'desc', nulls: 'last' }` for non-nullable fields like `createdAt`. The existing code used this extended syntax for ALL sort fields, which worked with the previously cached Prisma client but broke after regeneration.
- **Fix:** Added non-nullable field detection in `buildOrderByClause` -- uses plain `SortOrder` for `createdAt`, extended syntax for nullable fields.
- **Files modified:** `src/app/api/ad-library/ads/route.ts`
- **Verification:** All 5 sort fields return correct results via API
- **Committed in:** `7df41d2` (Task 2 commit)

**2. [Rule 3 - Blocking] Regenerated Prisma client for bylines field**
- **Found during:** Task 2 (hasBylines filter implementation)
- **Issue:** The `bylines` field existed in the Prisma schema and database but the generated Prisma client had not been regenerated to include it.
- **Fix:** Ran `npx prisma generate` to regenerate the client with the bylines field.
- **Files modified:** node_modules/.prisma/client/ (generated)
- **Verification:** Prisma client types include bylines, queries compile and execute correctly
- **Committed in:** Not committed (generated files)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary for correct operation. The orderBy bug was pre-existing but only surfaced after Prisma client regeneration. No scope creep.

## Issues Encountered
- Prisma client regeneration + Turbopack dev server caching caused significant debugging time. The real error ("Expected SortOrder, provided Object" for createdAt) was obscured by Prisma's error formatting which highlighted the `bylines` field in the query, misleading initial diagnosis.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API backend fully ready for Plan 02 frontend implementation
- SortField, SORT_OPTIONS, and GridDensity types available for import
- All 5 sort fields and hasBylines filter tested and working

---
*Phase: 47-filter-sort-overhaul*
*Completed: 2026-03-19*
