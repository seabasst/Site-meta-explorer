# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** Help brands and agencies see what competitors are running — browse, save, analyze, compare.
**Current focus:** Phase 63 — Classification Pipeline

## Current Position

Phase: 62 of 67 (Classification Foundation) — ✓ VERIFIED
Plan: Ready for Phase 63
Status: Phase 62 verified, proceeding to Phase 63
Last activity: 2026-03-27 — Phase 62 verified (9/9 must-haves passed)

Progress: █░░░░░░░░░ ~17%

## Performance Metrics

**Velocity:**
- Total plans completed: 123
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

- (v8.0): Start with ~8-10 categories, not 46 formats (Motion-aligned)
- (v8.0): Persist classifications in indexed columns, not JSON blobs
- (v8.0): Batch API + cron polling, not Inngest
- (62-01): 8 classification categories with 71 values, indexed Prisma columns
- (62-01): @db.Date works on Neon for ApiCostLog daily aggregation
- (62-01): schemaVersion field on AdClassification for taxonomy evolution
- (62-02): Dynamic prompt building from TAXONOMY (stays in sync automatically)
- (62-02): Fire-and-forget cost logging (never breaks classification)

### Existing Infrastructure

- Creative Lab page at `/dashboard/v2/creative-lab/page.tsx`
- AnalysisView at `/dashboard/v2/creative-lab/analysis-view.tsx`
- Diversity analysis API at `/api/analyze/diversity` (caches to BrandAnalysisCache)
- Benchmark API at `/api/analyze/benchmark`
- Brand search API at `/api/search-pages`
- Anthropic SDK already integrated (Claude Haiku/Sonnet)
- Classification taxonomy at `src/lib/classification/taxonomy.ts` (8 categories, 71 values)
- Classification Zod schema at `src/lib/classification/schemas.ts`
- AdClassification, ClassificationJob, ApiCostLog Prisma models (in Neon DB)
- Classification prompt at `src/lib/classification/prompt.ts` (buildClassificationPrompt, buildAdContext)
- Cost tracker at `src/lib/classification/cost-tracker.ts` (logApiCost, getDailySpend, getSpendByOperation)

### Motion Framework Reference

- 46 Visual Formats, 8 Creative Mechanics, 5 Awareness Stages (Schwartz), 8 Psychological Triggers, 35 Hook Tactics
- Replaces Five Pillars with Motion classification dimensions

### Blockers/Concerns

- TOKEN2 expires 2026-04-24, TOKEN3 expires 2026-04-25 — schedule refresh mid-April
- Claude Vision classification cost — batch + caching strategy required
- Taxonomy accuracy at scale — needs validation spike in Phase 62

## Session Continuity

Last session: 2026-03-27
Stopped at: Completed 62-02-PLAN.md — Phase 62 complete, ready for Phase 63
Resume file: None
