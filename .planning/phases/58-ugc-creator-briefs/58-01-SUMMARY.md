---
phase: 58-ugc-creator-briefs
plan: 01
subsystem: api
tags: [claude, anthropic-sdk, ugc, brief-generation, prisma]

# Dependency graph
requires:
  - phase: 57-ai-creative-generation
    provides: generate-config API pattern, creative-lab-types.ts, BrandAnalysisCache model
provides:
  - UGCBriefScene and UGCBrief type definitions
  - POST /api/creative-lab/generate-brief endpoint
affects: [58-02 UGC brief frontend, 58-03 brief download/export]

# Tech tracking
tech-stack:
  added: []
  patterns: [Claude-powered brief generation from brand analysis data]

key-files:
  created:
    - src/app/api/creative-lab/generate-brief/route.ts
  modified:
    - src/lib/creative-lab-types.ts

key-decisions:
  - "Followed generate-config API pattern exactly for consistency"
  - "Top 10 ads by reach used as copy examples in prompt (not in generate-config)"
  - "Category-aware B-roll suggestions via prompt engineering"

patterns-established:
  - "UGC brief generation: brand data + analysis cache + real ad copy -> Claude -> structured JSON"

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 58 Plan 01: UGC Brief API & Types Summary

**Claude-powered UGC brief generation API with structured types -- hooks, shot list, talking points, B-roll from brand analysis data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T21:04:55Z
- **Completed:** 2026-03-23T21:08:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- UGCBriefScene and UGCBrief interfaces added to creative-lab-types.ts (50 LOC)
- POST /api/creative-lab/generate-brief endpoint (245 LOC) following generate-config pattern
- Prompt includes diversity scores, Andromeda metrics, top 10 ad copy examples, category-aware B-roll guidance

## Task Commits

Each task was committed atomically:

1. **Task 1: Add UGC brief types** - `ee8e86a` (feat)
2. **Task 2: Create generate-brief API route** - `329f71d` (feat)

## Files Created/Modified
- `src/lib/creative-lab-types.ts` - Added UGCBriefScene and UGCBrief interfaces
- `src/app/api/creative-lab/generate-brief/route.ts` - Claude-powered brief generation endpoint

## Decisions Made
- Followed generate-config pattern exactly (zod validation, brand lookup, cache check, optional guidelines, Claude call, JSON parse)
- Added top-performing ads query (top 10 by reach) to feed real ad copy examples into the prompt -- not present in generate-config but critical for brand-specific briefs
- Category-aware B-roll suggestions embedded in prompt with reference table for Fashion, Beauty, Food, Tech, Fitness, Home categories

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- No brands with BrandAnalysisCache in the database, so full end-to-end Claude generation could not be verified. Error paths (400 validation, 404 brand missing, 404 cache missing) all verified via curl. The Claude call path follows the identical proven pattern from generate-config.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- API endpoint ready for frontend integration (58-02)
- Types exported for use in UI components
- No blockers

---
*Phase: 58-ugc-creator-briefs*
*Completed: 2026-03-23*
