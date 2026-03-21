---
phase: 54-brand-monitoring
plan: 01
subsystem: ui
tags: [react, recharts, demographics, monitoring, brand-detail]

# Dependency graph
requires:
  - phase: 53-infrastructure-cleanup
    provides: "Working Facebook token refresh and build fixes"
provides:
  - "Monitor toggle button on brand detail page with optimistic updates"
  - "Demographics section (age, gender, region charts) on brand detail page"
  - "Ads sorted by reach on brand detail page"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Monitor toggle with optimistic update and error rollback on brand detail page"
    - "Demographics rendering via normalizeDemographicsJson + DemographicPeek"

key-files:
  created: []
  modified:
    - "src/app/dashboard/v2/ad-library/[pageId]/page.tsx"

key-decisions:
  - "Used IIFE pattern for demographics rendering to handle null checks cleanly"
  - "Fixed TypeScript unknown-as-ReactNode issue by restructuring IIFE to avoid short-circuit with unknown type"

patterns-established:
  - "Monitor button pattern: check endpoint on load, optimistic toggle, error rollback"

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 54 Plan 01: Brand Detail Monitor + Demographics Summary

**Monitor toggle button with optimistic updates and demographics charts (age/gender/region) on brand detail page, ads sorted by reach**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T08:45:39Z
- **Completed:** 2026-03-21T08:48:18Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Monitor toggle button on brand detail page header with Eye/EyeOff icons and pill styling
- Demographics section with age, gender, and region bar charts using existing DemographicPeek component
- Ads grid now sorted by reach (highest first) with updated section title "Top Ads by Reach"
- Graceful degradation: unauthenticated users see page without monitor functionality, brands without demographics show no charts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add monitor toggle button to brand detail header** - `10484e9` (feat)
2. **Task 2: Add demographics section below brand header** - `29dbc70` (feat)

## Files Created/Modified
- `src/app/dashboard/v2/ad-library/[pageId]/page.tsx` - Added monitor toggle, demographics section, reach-sorted ads

## Decisions Made
- Used IIFE with early returns instead of short-circuit `&&` to avoid TypeScript `unknown` type not assignable to `ReactNode` error
- Placed monitor button with `ml-auto` in the name/category row for right-alignment on desktop

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript unknown-as-ReactNode error**
- **Found during:** Task 2 (Demographics section)
- **Issue:** Plan used `brand.demographicsJson && (() => {...})()` pattern, but `demographicsJson` is typed as `unknown`, which when used with `&&` short-circuit produces `unknown` -- not assignable to `ReactNode`
- **Fix:** Restructured IIFE to use early `return null` instead of `&&` short-circuit
- **Files modified:** src/app/dashboard/v2/ad-library/[pageId]/page.tsx
- **Verification:** `npx next build` passes without type errors
- **Committed in:** 29dbc70 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor TypeScript fix, no scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BMON-01 (monitor persistence) and BMON-02 (per-brand dashboard) are complete
- Brand detail page at `/dashboard/v2/ad-library/[pageId]` now serves as the per-brand dashboard
- Phase 54 may have additional plans for monitoring alerts or notifications

---
*Phase: 54-brand-monitoring*
*Completed: 2026-03-21*
