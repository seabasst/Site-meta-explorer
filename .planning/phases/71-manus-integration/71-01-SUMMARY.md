---
phase: 71-manus-integration
plan: 01
subsystem: api
tags: [manus, deep-research, async-tasks, prisma, rest-api]

# Dependency graph
requires:
  - phase: 69-brand-context
    provides: BrandProfile model and compileBrandContext utility
provides:
  - Manus API v2 typed client wrapper (create, poll, getMessages)
  - ManusTask Prisma model with full lifecycle tracking
  - POST /api/manus/create endpoint
  - GET /api/manus/[taskId] polling endpoint
  - Keyword-based message routing (Claude vs Manus)
affects: [71-02 chat UI integration, website enrichment via Manus]

# Tech tracking
tech-stack:
  added: [Manus API v2 (external REST API, no npm package)]
  patterns: [async task polling, keyword-based routing, defensive unknown-type handling]

key-files:
  created:
    - src/lib/manus/types.ts
    - src/lib/manus/client.ts
    - src/lib/manus/router.ts
    - src/app/api/manus/create/route.ts
    - src/app/api/manus/[taskId]/route.ts
  modified:
    - prisma/schema.prisma

key-decisions:
  - "No userId on ManusTask -- app is open-access, follows BrandProfile pattern"
  - "extractAssistantResponse handles string, array, and object content shapes defensively"
  - "Poll endpoint returns cached DB result for completed/failed tasks (no redundant Manus API calls)"
  - "Manus API errors during polling don't corrupt DB state -- reported as still running"

patterns-established:
  - "Async task pattern: create -> persist -> poll -> cache on completion"
  - "Keyword routing: pure string matching, no LLM classification"

# Metrics
duration: 2min
completed: 2026-04-06
---

# Phase 71 Plan 01: Manus API Backend Summary

**Manus API v2 typed client, ManusTask Prisma model, keyword router, and create/poll API routes for async deep research**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-05T23:13:11Z
- **Completed:** 2026-04-05T23:15:27Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Three library files (types, client, router) provide typed, testable Manus API integration
- ManusTask model deployed to production database with lifecycle tracking
- Two API routes handle full task lifecycle: create and poll with result caching
- Router correctly classifies messages as Claude vs Manus based on 16 keywords plus toggle override

## Task Commits

Each task was committed atomically:

1. **Task 1: Manus types, client wrapper, and routing logic** - `e214bfe` (feat)
2. **Task 2: Prisma ManusTask model + API routes** - `37f8b3c` (feat)

## Files Created/Modified
- `src/lib/manus/types.ts` - TypeScript types for Manus API v2 (create, detail, messages responses)
- `src/lib/manus/client.ts` - Thin wrapper around Manus REST API with error handling and response extraction
- `src/lib/manus/router.ts` - Keyword-based routing to decide Claude vs Manus
- `src/app/api/manus/create/route.ts` - POST endpoint to create Manus tasks and persist to DB
- `src/app/api/manus/[taskId]/route.ts` - GET endpoint to poll status and cache completed results
- `prisma/schema.prisma` - Added ManusTask model with BrandProfile relation

## Decisions Made
- No userId on ManusTask -- the app is open-access with no auth gates on v2 routes, consistent with BrandProfile pattern
- extractAssistantResponse handles multiple content shapes (string, array of text parts, object with text field) since Manus listMessages format is not fully documented
- Poll endpoint returns cached DB result for completed/failed tasks to avoid redundant Manus API calls
- Manus API errors during polling don't update DB status -- prevents false state corruption, just reports as still running
- Used encodeURIComponent for task IDs in query params for safety

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration:**
- `MANUS_API_KEY` environment variable must be set (get from https://manus.im > Settings > Integration > Build with Manus API)
- Add to both `.env.local` and Vercel environment variables

## Next Phase Readiness
- Backend infrastructure complete for Plan 02 (chat UI integration)
- API routes ready for client-side polling from Hikaru chat
- Router ready to be wired into Hikaru POST handler for message routing
- MANUS_API_KEY must be configured before any live testing

---
*Phase: 71-manus-integration*
*Completed: 2026-04-06*
