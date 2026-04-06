# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-02)

**Core value:** Help brands and agencies see what competitors are running — browse, save, analyze, compare.
**Current focus:** Phase 71 complete — ready for Phase 72

## Current Position

Phase: 71 of 72 (Manus Integration & Deep Research) — COMPLETE ✓
Plan: 2/2 complete
Status: Verified, ready for Phase 72
Last activity: 2026-04-06 — Phase 71 executed and verified (Manus backend + Deep Research UI + website enrichment)

Progress: ████████░░ 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 140
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- (v9.0): Manus API for async deep analysis, Claude for streaming chat
- (v9.0): BrandProfile as multi-table Prisma model (not JSON blob, not single table)
- (v9.0): Context injection into system prompts with ~2K token budget
- (v9.0): Onboarding wizard — soft prompt, never blocking
- (v9.0): Keyword-based message routing, not LLM-classified
- (69-01): compileBrandContext() as shared utility for all AI routes, character-based budgeting (7500 chars)
- (69-01): BrandGuidelines model kept as dead code, all routes now read from BrandProfile
- (69-02): Removed auth gates from OnboardingPrompt and brand-profiles GET — v2 is open-access
- (69-01): Hikaru tool loop limit bumped to 15 (was 8, too low for brand-aware queries)
- (70-01): Haiku 4.5 for enrichment synthesis (cheap, sufficient for structured extraction)
- (70-01): Hash-based change detection for enrichment (SHA-256 of input data)
- (70-01): Fill-empty + append-deduplicate merge strategy (user edits preserved)
- (71-01): No userId on ManusTask — open-access, follows BrandProfile pattern
- (71-01): Poll endpoint caches completed results, avoids redundant Manus API calls
- (71-01): Manus API errors during polling don't corrupt DB state

### Blockers/Concerns

- MANUS_API_KEY configured ✓ (Phase 71 complete)
- TOKEN2 expires 2026-04-24, TOKEN3 expires 2026-04-25

## Session Continuity

Last session: 2026-04-06
Stopped at: Phase 71 complete — ready to plan Phase 72
Resume file: None
