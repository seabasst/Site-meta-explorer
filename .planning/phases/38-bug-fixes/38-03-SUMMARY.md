---
phase: 38-bug-fixes
plan: 03
subsystem: api, ui
tags: [facebook-api, demographics, error-handling, token-expiry, v1-page]

# Dependency graph
requires:
  - phase: 38-bug-fixes
    provides: Research identifying FIX-04 demographics token expiry issue
provides:
  - demographicsError field in facebook-ads API response
  - User-visible error states for demographics failures on v1 page
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Error context propagation: API returns typed error fields alongside null data"

key-files:
  created: []
  modified:
    - src/lib/facebook-api.ts
    - src/app/api/facebook-ads/route.ts
    - src/app/page.tsx

key-decisions:
  - "demographicsError is optional field on FacebookApiResult, not a separate response shape"
  - "Error detection uses regex on error messages for token/OAuth keywords plus Facebook error code 190"
  - "Three-state error: token_expired, api_error, null (no error)"

patterns-established:
  - "Error context pattern: supplement null data with typed error field for frontend differentiation"

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 38 Plan 03: Demographics Error State Summary

**demographicsError field in facebook-ads API distinguishing token expiry from missing data, with amber warning UI on v1 page**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T06:55:29Z
- **Completed:** 2026-03-17T06:58:18Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- API now returns `demographicsError` field (`token_expired` | `api_error` | `null`) in all response paths
- V1 page shows amber warning box when demographics fail due to token expiry or API errors
- Existing "No demographic data" message preserved for genuinely missing data

## Task Commits

Each task was committed atomically:

1. **Task 1: Add demographicsError field to facebook-ads API** - `842c050` (fix)
2. **Task 2: Show specific error message on v1 page for demographics failures** - `25f2b74` (fix)

## Files Created/Modified
- `src/lib/facebook-api.ts` - Added `demographicsError` optional field to `FacebookApiResult` interface
- `src/app/api/facebook-ads/route.ts` - Modified `fetchDemographicsOnly` to return error context; added `demographicsError` to all JSON response paths (POST + GET)
- `src/app/page.tsx` - Added `AlertTriangle` icon, three conditional blocks for token_expired / api_error / no-data states with amber styling

## Decisions Made
- Used optional field (`demographicsError?`) rather than required to avoid breaking existing consumers
- Error detection via regex on error messages (`/token|OAuthException|oauth/i`) plus Facebook error code 190
- Amber/yellow styling chosen over red to signal "temporary issue" rather than "critical error"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FIX-04 complete, demographics error state is user-visible
- Token expiry is still a blocker for actual demographics data (noted in STATE.md concerns)

---
*Phase: 38-bug-fixes*
*Completed: 2026-03-17*
