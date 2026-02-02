---
phase: 28-hook-extraction-engine
plan: 02
subsystem: api
tags: [hooks, persistence, prisma, transaction, facebook-api, client-server]

# Dependency graph
requires:
  - phase: 28-hook-extraction-engine
    provides: "Hook extraction functions (extractHooksFromAds) and HookGroup Prisma model from Plan 01"
  - phase: 24-brand-storage
    provides: "BrandSnapshot persistence pattern, save-brand and re-analysis flows"
provides:
  - Hook persistence during re-analysis (snapshots POST route)
  - Hook persistence during initial brand save (save route)
  - rawAdBodies field on FacebookApiResult for hook extraction
affects: [29-hook-ui, 31-observations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel data path: rawAdBodies alongside existing ads conversion for hook extraction"
    - "Atomic transaction: snapshot + hookGroups created together in $transaction"

key-files:
  created: []
  modified:
    - src/lib/facebook-api.ts
    - src/app/api/dashboard/snapshots/route.ts
    - src/app/api/brands/save/route.ts
    - src/app/page.tsx

key-decisions:
  - "rawAdBodies as parallel data path on FacebookApiResult (does not modify existing ads conversion)"
  - "Client-side hook extraction in page.tsx (pure function, no server dependency)"
  - "Hook groups sent from client to save route (avoids duplicating Facebook API call)"
  - "Both flows use $transaction for atomic snapshot + hooks creation"

patterns-established:
  - "Parallel data exposure: add raw data field alongside transformed data for downstream consumers"

# Metrics
duration: 2min
completed: 2026-02-02
---

# Phase 28 Plan 02: Hook Persistence Wiring Summary

**Wired hook extraction into both save-brand and re-analysis flows with atomic transactions persisting HookGroup rows alongside BrandSnapshot**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-02T15:56:12Z
- **Completed:** 2026-02-02T15:58:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Re-analysis (snapshots POST) now extracts hooks server-side from rawAdBodies and persists HookGroups atomically with the snapshot
- Initial brand save now sends hookGroups from client and persists them inside the existing transaction
- Added rawAdBodies field to FacebookApiResult exposing all ad_creative_bodies for hook extraction without modifying the existing ads conversion

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire hooks into re-analysis flow** - `2c686e2` (feat)
2. **Task 2: Wire hooks into initial save-brand flow** - `f2b52cf` (feat)

## Files Created/Modified
- `src/lib/facebook-api.ts` - Added rawAdBodies field to FacebookApiResult interface and populated it from allAds array
- `src/app/api/dashboard/snapshots/route.ts` - Added extractHooksFromAds import, wrapped snapshot creation in $transaction with hookGroup.createMany
- `src/app/api/brands/save/route.ts` - Accepts hookGroups from client, persists via hookGroup.createMany inside existing transaction
- `src/app/page.tsx` - Imports extractHooksFromAds, extracts hooks from rawAdBodies, sends hookGroups in save request body

## Decisions Made
- Used rawAdBodies as a parallel data path on FacebookApiResult rather than modifying the existing `ads` array conversion -- this keeps the existing data flow unchanged and provides raw Facebook data specifically for hook extraction
- Client-side hook extraction: page.tsx calls extractHooksFromAds directly (pure function, safe for client bundle) and sends results to save route, avoiding a redundant server-side extraction
- Server-side hook extraction for re-analysis: snapshots route has direct access to rawAdBodies from fetchFacebookAds, no client round-trip needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Database migration from Plan 01 must be applied for HookGroup table to exist.

## Next Phase Readiness
- Hook data now persisted on every new snapshot (both save and re-analysis paths)
- Ready for Phase 29 (Hook UI) to query HookGroup rows and display them
- Ready for Phase 31 (Observations) to use hook frequency/reach data for insights

---
*Phase: 28-hook-extraction-engine*
*Completed: 2026-02-02*
