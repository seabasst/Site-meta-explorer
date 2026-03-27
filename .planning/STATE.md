# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-27)

**Core value:** Help brands and agencies see what competitors are running — browse, save, analyze, compare.
**Current focus:** Phase 64 — Diversity Refactor

## Current Position

Phase: 64 of 67 (Diversity Refactor) — ✓ VERIFIED
Plan: Ready for Phase 65
Status: Phase 64 verified (4/4 must-haves passed), proceeding to Phase 65
Last activity: 2026-03-27 — Phase 64 complete (2 plans, 5 commits)

Progress: ████░░░░░░ ~50%

## Performance Metrics

**Velocity:**
- Total plans completed: 127
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
- (63-01): messages.parse() with zodOutputFormat for auto-parsed structured output
- (63-01): Cache-first pattern — check DB before calling Claude
- (63-01): Vision classification when image asset available, text-only otherwise
- (63-02): Fire-and-forget batch submission (POST returns immediately, job tracks progress)
- (63-02): 5-minute cron polling for batch results (*/5 * * * *)
- (63-02): skipDuplicates on createMany for idempotent result processing
- (64-01): @default(0) on new BrandAnalysisCache columns for safe migration with existing rows
- (64-01): Schwartz awareness stages mapped to 3 funnel buckets (awareness/consideration/conversion)
- (64-01): Return 422 with needsClassification flag when <3 ads classified
- (64-02): Renamed fivePillars to categories in strategy brandContext for consistent naming

### Existing Infrastructure

- Creative Lab page at `/dashboard/v2/creative-lab/page.tsx`
- AnalysisView at `/dashboard/v2/creative-lab/analysis-view.tsx`
- Diversity analysis API at `/api/analyze/diversity` (reads from AdClassification, caches to BrandAnalysisCache with 8-category scores)
- Benchmark API at `/api/analyze/benchmark` (uses 8-category scores from BrandAnalysisCache)
- Brand search API at `/api/search-pages`
- Anthropic SDK already integrated (Claude Haiku/Sonnet)
- Classification taxonomy at `src/lib/classification/taxonomy.ts` (8 categories, 71 values)
- Classification Zod schema at `src/lib/classification/schemas.ts`
- AdClassification, ClassificationJob, ApiCostLog Prisma models (in Neon DB)
- Classification prompt at `src/lib/classification/prompt.ts` (buildClassificationPrompt, buildAdContext)
- Cost tracker at `src/lib/classification/cost-tracker.ts` (logApiCost, getDailySpend, getSpendByOperation)
- Single classification at `src/lib/classification/classify-single.ts` (classifySingleAd with zodOutputFormat)
- Single classification API: POST `/api/classify/single` (cache-first, persists, logs cost)
- Batch classification at `src/lib/classification/classify-batch.ts` (submitBatchClassification, processBatchResults)
- Batch API: POST `/api/classify/batch` (start), GET `/api/classify/batch/status` (progress)
- Cron polling: GET `/api/ad-library/cron/classify-poll` (every 5 min, processes completed batches)
- BrandAnalysisCache: 8-category scores (assetTypeScore through intendedAudienceScore) + overallScore

### Motion Framework Reference

- 46 Visual Formats, 8 Creative Mechanics, 5 Awareness Stages (Schwartz), 8 Psychological Triggers, 35 Hook Tactics
- Replaces Five Pillars with Motion classification dimensions

### Blockers/Concerns

- TOKEN2 expires 2026-04-24, TOKEN3 expires 2026-04-25 — schedule refresh mid-April
- Claude Vision classification cost — batch + caching strategy required
- Older routes (analyze/route.ts, analyze/strategy/route.ts, strategy-view.tsx) still reference "Five Pillars" — not part of current refactor scope

## Session Continuity

Last session: 2026-03-27
Stopped at: Phase 64 verified — ready for Phase 65
Resume file: None
