---
phase: 69-context-injection-onboarding
plan: 01
subsystem: api
tags: [anthropic, prisma, brand-context, system-prompt, xml-injection]

# Dependency graph
requires:
  - phase: 68-brand-profile-schema-crud
    provides: BrandProfile model, CRUD API, brand-profile-types.ts
provides:
  - compileBrandContext() utility for XML-tagged system prompt injection
  - Brand-aware Hikaru chat (accepts brandProfileId, injects context)
  - Creative Lab routes migrated from BrandGuidelines to BrandProfile
affects: [69-02-onboarding, 70-creative-lab-v2, hikaru-improvements]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "XML-tagged brand context injection with character-based budgeting (7500 chars / ~2K tokens)"
    - "compileBrandContext() as shared utility imported by all AI routes"
    - "BrandProfile.findFirst with isActive flag for multi-profile support in Creative Lab"

key-files:
  created:
    - src/lib/brand-context.ts
  modified:
    - src/app/api/chat/hikaru/route.ts
    - src/app/api/creative-lab/generate-config/route.ts
    - src/app/api/creative-lab/generate-batch/route.ts
    - src/app/api/creative-lab/generate-brief/route.ts

key-decisions:
  - "Used character-based budgeting (7500 chars) instead of tokenizer dependency"
  - "Kept useBrandGuidelines API field name in generate-batch for backward compatibility"
  - "BrandGuidelines model left in schema as dead code (no deletion yet)"

patterns-established:
  - "compileBrandContext(profile) for all brand-aware AI routes"
  - "systemPrompt built once before agentic loop, not inside loop"

# Metrics
duration: 2min
completed: 2026-04-03
---

# Phase 69 Plan 01: Context Injection & Route Wiring Summary

**compileBrandContext() utility with XML-tagged sections under 2K tokens, wired into Hikaru chat and all 3 Creative Lab routes (migrated from BrandGuidelines to BrandProfile)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T20:54:09Z
- **Completed:** 2026-04-03T20:56:20Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created `compileBrandContext()` utility with priority-ordered XML sections and character-based budgeting
- Hikaru route now accepts `brandProfileId`, fetches profile, and injects compiled context into system prompt before the agentic loop
- All 3 Creative Lab routes (generate-config, generate-batch, generate-brief) migrated from BrandGuidelines to BrandProfile with isActive flag
- All routes degrade gracefully when no profile exists

## Task Commits

Each task was committed atomically:

1. **Task 1: Create compileBrandContext utility** - `79a76fd` (feat)
2. **Task 2: Wire brand context into Hikaru and Creative Lab routes** - `ec9aeb5` (feat)

## Files Created/Modified
- `src/lib/brand-context.ts` - compileBrandContext() utility with XML-tagged output and character budgeting
- `src/app/api/chat/hikaru/route.ts` - Accepts brandProfileId, fetches BrandProfile, builds dynamic systemPrompt
- `src/app/api/creative-lab/generate-config/route.ts` - Migrated from BrandGuidelines to BrandProfile.findFirst
- `src/app/api/creative-lab/generate-batch/route.ts` - Migrated from BrandGuidelines to BrandProfile, updated type annotations
- `src/app/api/creative-lab/generate-brief/route.ts` - Migrated from BrandGuidelines to BrandProfile, renamed variables

## Decisions Made
- Used character-based budgeting (7500 chars ~1875 tokens) instead of adding a tokenizer dependency -- the 2K token budget is approximate and chars/4 is sufficient
- Kept `useBrandGuidelines` API field name in generate-batch request schema for backward compatibility (frontend sends this field name)
- BrandGuidelines model left in Prisma schema -- it becomes dead code but is not removed to avoid migration complexity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing type errors in `hikaru/history/` routes (hikaruMessage/hikaruChat models) and `generate-strategy` route (brandStrategy model) -- these are unrelated to this plan and exist on the branch already

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- compileBrandContext() is ready for any future AI route that needs brand awareness
- Onboarding wizard (Plan 02) can build on this -- once users create a BrandProfile, all AI features automatically become brand-aware
- BrandGuidelines data migration script may be needed later for users with existing guidelines but no BrandProfile

---
*Phase: 69-context-injection-onboarding*
*Completed: 2026-04-03*
