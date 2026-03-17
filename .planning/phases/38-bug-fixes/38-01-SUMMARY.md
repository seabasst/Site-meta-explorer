---
phase: 38-bug-fixes
plan: 01
subsystem: ui, api
tags: [next-auth, useSession, prisma, categories, slug-normalization]

# Dependency graph
requires:
  - phase: v2-dashboard
    provides: V2Shell, V2Card components, useV2 context
  - phase: auth
    provides: NextAuth session infrastructure
provides:
  - Auth-aware Saved Ads page with sign-in prompt
  - Normalized category slug pipeline (listing to detail)
affects: [39-nav-restructure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Auth-gated pages: useSession + early return with sign-in prompt"
    - "Category slugs: lowercase underscored in URLs, spaces in DB, case-insensitive lookup"

key-files:
  created: []
  modified:
    - src/app/dashboard/v2/saved/page.tsx
    - src/app/api/categories/route.ts
    - src/app/api/categories/[slug]/route.ts

key-decisions:
  - "Show sign-in prompt (not login modal) for unauthenticated Saved Ads visitors"
  - "Normalize slugs to lowercase+underscores at listing API, reverse at detail API"

patterns-established:
  - "Auth fallback: useSession status check, skeleton while loading, prompt when unauthenticated"
  - "Slug normalization: toLowerCase().replace(/\\s+/g, '_') outbound, .replace(/_/g, ' ') + mode insensitive inbound"

# Metrics
duration: 10min
completed: 2026-03-17
---

# Phase 38 Plan 01: Bug Fixes Summary

**Auth-aware Saved Ads page with sign-in prompt and normalized category slugs fixing detail page 404s**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-17T06:46:50Z
- **Completed:** 2026-03-17T06:57:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Saved Ads page now shows "Sign in to view your saved ads" prompt for unauthenticated users instead of misleading empty state
- Category listing API returns normalized lowercase underscored slugs, eliminating 404s when navigating to detail pages
- Category detail API converts underscored slugs back to spaces with case-insensitive DB lookup

## Task Commits

Each task was committed atomically:

1. **Task 1: Add auth awareness to Saved Ads page** - `0735c48` (fix)
2. **Task 2: Normalize category slugs to fix 404s** - `031fe57` (fix)

## Files Created/Modified
- `src/app/dashboard/v2/saved/page.tsx` - Added useSession, sign-in prompt for unauthenticated users, skip fetch when no session
- `src/app/api/categories/route.ts` - Slug output normalized to lowercase with underscores
- `src/app/api/categories/[slug]/route.ts` - Slug input converted from underscores to spaces for case-insensitive DB query

## Decisions Made
- Used `signIn()` button (not inline login modal) for the Saved Ads auth prompt -- simpler and consistent with how other auth-gated features work
- Slug normalization applied at API boundary (listing output / detail input) rather than in the database -- avoids migration and keeps DB category names human-readable

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both FIX-01 and FIX-03 resolved
- Ready for remaining bug fix plans or Phase 39 nav restructure

---
*Phase: 38-bug-fixes*
*Completed: 2026-03-17*
