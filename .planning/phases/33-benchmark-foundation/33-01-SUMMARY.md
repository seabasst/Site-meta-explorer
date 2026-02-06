---
phase: 33-benchmark-foundation
plan: 01
subsystem: api, database
tags: [prisma, batch-fetch, rate-limiting, benchmarks, facebook-api]

# Dependency graph
requires:
  - phase: 03-aggregation
    provides: buildSnapshotFromApiResult, SnapshotData
  - phase: 25-brand-dashboard
    provides: TrackedBrand, BrandSnapshot patterns
provides:
  - BenchmarkReport and BenchmarkBrand Prisma models
  - batchFetchPages utility for rate-limited multi-page fetching
  - POST /api/benchmarks endpoint for creating benchmarks
  - GET /api/benchmarks endpoint for listing benchmarks
  - GET /api/benchmarks/[id] endpoint for single benchmark
affects: [33-02-benchmark-ui, 34-benchmark-charts, benchmark-comparison]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sequential batch fetching with Promise.allSettled
    - Rate limiting with delays between batches
    - Partial success handling for batch operations

key-files:
  created:
    - src/lib/batch-fetch.ts
    - src/app/api/benchmarks/route.ts
    - src/app/api/benchmarks/[id]/route.ts
  modified:
    - prisma/schema.prisma
    - src/lib/facebook-api.ts

key-decisions:
  - "batchSize=2 with 2s delay for safe rate limiting"
  - "Promise.allSettled for partial success handling"
  - "Minimum 2 successful brands required (1 baseline + 1 competitor)"
  - "Export EU_COUNTRIES from facebook-api.ts for batch-fetch"

patterns-established:
  - "Batch fetch with rate limiting: batchFetchPages(urls, token, options)"
  - "BenchmarkBrand stores snapshot metrics inline (same fields as BrandSnapshot)"

# Metrics
duration: 12min
completed: 2026-02-06
---

# Phase 33 Plan 01: Benchmark Foundation Summary

**Prisma models for BenchmarkReport/BenchmarkBrand, batch-fetch utility with rate limiting, and API endpoints for creating/listing benchmarks**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-06T12:34:00Z
- **Completed:** 2026-02-06T12:46:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- BenchmarkReport and BenchmarkBrand models added to Prisma schema with proper relations
- Database tables created with unique constraint on benchmarkId + facebookPageId
- batchFetchPages utility handles rate-limited multi-page fetching with Promise.allSettled
- API endpoints for creating, listing, and retrieving benchmark reports

## Task Commits

Each task was committed atomically:

1. **Task 1: Add BenchmarkReport and BenchmarkBrand models** - `df76fb5` (feat)
2. **Task 2: Create batch-fetch utility with rate limiting** - `c22c4d7` (feat)
3. **Task 3: Create benchmark API endpoints** - `84fe7e6` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added BenchmarkReport and BenchmarkBrand models, benchmarks relation to User
- `src/lib/batch-fetch.ts` - Batch fetch utility with rate limiting and partial success handling
- `src/lib/facebook-api.ts` - Exported EU_COUNTRIES constant
- `src/app/api/benchmarks/route.ts` - POST and GET endpoints for benchmarks
- `src/app/api/benchmarks/[id]/route.ts` - GET endpoint for single benchmark

## Decisions Made
- batchSize = 2 and delayBetweenBatches = 2000ms to stay under Facebook API rate limits
- Promise.allSettled used so one failed page doesn't stop the entire batch
- Baseline brand must succeed for benchmark creation to proceed
- Minimum 2 successful brands required (fail fast if < 2)
- BigInt fields serialized to string in JSON responses

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Export EU_COUNTRIES from facebook-api.ts**
- **Found during:** Task 2 (batch-fetch utility implementation)
- **Issue:** EU_COUNTRIES was a private const, batch-fetch.ts couldn't import it
- **Fix:** Changed `const EU_COUNTRIES` to `export const EU_COUNTRIES`
- **Files modified:** src/lib/facebook-api.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** c22c4d7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary export to enable batch-fetch utility. No scope creep.

## Issues Encountered
- Prisma Json null handling required importing Prisma.JsonNull for demographicsJson field (standard pattern from brands/save)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Database ready with BenchmarkReport and BenchmarkBrand tables
- API endpoints ready for frontend integration (Phase 33-02)
- batchFetchPages utility ready for use in benchmark creation flow
- No blockers for Phase 33-02 (Benchmark UI)

---
*Phase: 33-benchmark-foundation*
*Completed: 2026-02-06*
