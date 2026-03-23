---
phase: 57-ai-creative-generation
plan: 01
subsystem: api
tags: [anthropic, replicate, flux-schnell, ai-generation, creative-lab, zod, jszip]

# Dependency graph
requires:
  - phase: 55-creative-lab
    provides: "BrandAnalysisCache model, diversity analysis API, brand guidelines CRUD"
provides:
  - "POST /api/creative-lab/generate-config -- synthesizes analysis gaps into 5-7 generation suggestions via Claude"
  - "POST /api/creative-lab/generate-batch -- generates single image via Replicate Flux Schnell"
  - "Shared TypeScript types: GenerationSuggestion, GenerationConfig, GenerationResult"
  - "jszip installed for zip download in Plan 02"
affects: [57-02, 57-03, 57-04, 57-05]

# Tech tracking
tech-stack:
  added: [jszip]
  patterns: ["Claude structured JSON generation for creative suggestions", "Replicate Flux Schnell polling pattern for image generation"]

key-files:
  created:
    - src/lib/creative-lab-types.ts
    - src/app/api/creative-lab/generate-config/route.ts
    - src/app/api/creative-lab/generate-batch/route.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Used individual BrandAnalysisCache fields instead of scoresJson (schema stores scores as separate columns)"
  - "Cap brand voice to 200 chars in prompt to avoid bloating Claude calls"
  - "generate-batch is intentionally a thin Replicate wrapper scoped to creative-lab namespace"

patterns-established:
  - "creative-lab API namespace: /api/creative-lab/* for generation endpoints"
  - "Brand guidelines fetch is auth-gated but non-blocking (graceful degradation)"

# Metrics
duration: 3min
completed: 2026-03-23
---

# Phase 57 Plan 01: Backend APIs & Shared Types Summary

**generate-config API synthesizes BrandAnalysisCache + BrandGuidelines into Claude-powered suggestions; generate-batch wraps Replicate Flux Schnell for image generation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T20:08:06Z
- **Completed:** 2026-03-23T20:10:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Shared type definitions (GenerationSuggestion, GenerationConfig, GenerationResult) for frontend-backend contract
- generate-config API reads cached analysis scores + distribution, identifies gap pillars below 60, and asks Claude for 5-7 targeted suggestions with image prompts
- generate-batch API wraps Replicate Flux Schnell with proper rate limit handling (429) and polling
- jszip installed for future zip download feature

## Task Commits

Each task was committed atomically:

1. **Task 1: Shared types + jszip + generate-config API** - `0ab916c` (feat)
2. **Task 2: generate-batch API endpoint** - `81b5e2d` (feat)

## Files Created/Modified
- `src/lib/creative-lab-types.ts` - Shared interfaces for generation pipeline
- `src/app/api/creative-lab/generate-config/route.ts` - Synthesizes analysis + guidelines into suggestions via Claude
- `src/app/api/creative-lab/generate-batch/route.ts` - Flux Schnell image generation with rate limit handling
- `package.json` - Added jszip dependency
- `package-lock.json` - Lock file updated

## Decisions Made
- Used individual BrandAnalysisCache column fields (formatScore, toneScore, etc.) rather than a single JSON field -- matches the actual Prisma schema
- Brand guidelines are fetched only when user is authenticated; generation works fine without them
- generate-batch mirrors the exact Replicate fetch pattern from /api/analyze/generate-image for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Stale .next/types reference to deleted editor page caused a phantom type error -- resolved by clearing .next/types cache (pre-existing issue, not related to this plan)

## User Setup Required
None - no external service configuration required (REPLICATE_API_TOKEN and ANTHROPIC_API_KEY already configured).

## Next Phase Readiness
- Both API routes ready for frontend integration in Plan 02
- Types importable from `@/lib/creative-lab-types` for UI components
- jszip available for zip download feature

---
*Phase: 57-ai-creative-generation*
*Completed: 2026-03-23*
