---
phase: 64-diversity-refactor
plan: 01
subsystem: analysis-backend
tags: [diversity, classification, prisma, taxonomy, cost-reduction]
dependency-graph:
  requires: [63-classification-pipeline]
  provides: [diversity-reads-from-adclassification, 8-category-brandanalysiscache]
  affects: [64-02-frontend-refactor, benchmark-route, creative-lab-routes]
tech-stack:
  added: []
  patterns:
    - "DB-read classification instead of per-request Claude call"
    - "Schwartz awareness stages mapped to funnel buckets"
    - "TAXONOMY-driven distribution building via CATEGORY_KEYS iteration"
key-files:
  created: []
  modified:
    - prisma/schema.prisma
    - src/app/api/analyze/diversity/route.ts
decisions:
  - id: "64-01-a"
    decision: "Add @default(0) to new BrandAnalysisCache columns for safe migration"
    reason: "7 existing cache rows blocked adding required columns without defaults; cache is regenerated on next analysis so defaults are harmless"
  - id: "64-01-b"
    decision: "Map 5 Schwartz awareness stages to 3 funnel buckets (awareness/consideration/conversion)"
    reason: "Funnel balance metric needs 3 buckets; unaware+problem-aware=awareness, solution-aware+product-aware=consideration, most-aware=conversion"
  - id: "64-01-c"
    decision: "Return 422 with needsClassification flag when <3 ads classified"
    reason: "Clear error instead of silent fallback; frontend can show classification prompt"
metrics:
  duration: "3m 51s"
  completed: "2026-03-27"
---

# Phase 64 Plan 01: Diversity Backend Refactor Summary

**Refactored diversity analysis to read stored AdClassification rows instead of calling Claude for classification, cutting per-analysis cost from ~$0.10-0.50 to $0 for classification (only recommendation call remains).**

## What Changed

### Task 1: BrandAnalysisCache Schema Migration
- Replaced 5 Five Pillars score columns (`formatScore`, `toneScore`, `journeyPhaseScore`, `visualStyleScore`, `messengerScore`) with 8 taxonomy score columns (`assetTypeScore` through `intendedAudienceScore`)
- Added `@default(0)` to new columns for safe migration with existing rows
- Ran `prisma db push --accept-data-loss` (cache-only data loss, regenerated on next analysis)
- Regenerated Prisma client

### Task 2: Diversity Route Refactor
- Removed Claude Call 1 (classification) entirely -- replaced with `prisma.adClassification.findMany`
- Removed video asset query and `enrichedSummaries` construction (only needed for Claude prompt)
- Built 8-category distribution from stored classifications using `CATEGORY_KEYS` iteration
- Updated diversity score calculation to use `TAXONOMY[key].values.length` for max categories
- Mapped Schwartz awareness stages to funnel buckets for funnel balance metric
- Updated Claude Call 2 (recommendations) prompt to reference 8-category taxonomy
- Updated `BrandAnalysisCache` upsert with new column names
- Added `classifiedCount` and `totalAds` to response for coverage visibility
- Removed per-ad `classifications` array from response (data lives in DB now)
- Added 422 error with `needsClassification: true` when fewer than 3 ads classified

## Decisions Made

1. **@default(0) on new columns** -- 7 existing BrandAnalysisCache rows blocked adding required columns. Since cache is regenerated on next analysis, defaults are harmless.
2. **Schwartz-to-funnel mapping** -- unaware + problem-aware = awareness, solution-aware + product-aware = consideration, most-aware = conversion.
3. **Minimum 3 classified ads** -- Returns clear 422 error instead of attempting analysis with insufficient data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @default(0) to BrandAnalysisCache columns**
- **Found during:** Task 1
- **Issue:** `prisma db push` failed because 7 existing rows had no values for new required columns
- **Fix:** Added `@default(0)` to all 8 new score columns
- **Files modified:** `prisma/schema.prisma`
- **Commit:** c6448e5

## Known Cascading Effects

The schema migration breaks TypeScript in 4 other files that read old BrandAnalysisCache columns:
- `src/app/api/analyze/benchmark/route.ts` -- reads `formatScore`, `toneScore`, etc.
- `src/app/api/creative-lab/generate-config/route.ts` -- reads old column names
- `src/app/api/creative-lab/generate-brief/route.ts` -- reads old column names
- `src/app/api/creative-lab/generate-strategy/route.ts` -- reads old column names

These are expected and will be addressed in Plan 02 (frontend/downstream refactor).

## Verification Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | Pass |
| Diversity route TS errors | 0 |
| `client.messages.create` count in diversity route | 1 (recommendations only) |
| `prisma.adClassification.findMany` present | Yes |
| `Five Pillars` references in diversity route | 0 |
| `assetTypeScore` in diversity route | Yes (cache upsert) |
| Old column names in diversity route | 0 |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | c6448e5 | feat(64-01): migrate BrandAnalysisCache to 8-category taxonomy |
| 2 | dbebb92 | feat(64-01): refactor diversity route to read from AdClassification |

## Next Phase Readiness

Plan 64-02 can proceed immediately. It will need to:
- Update the frontend `analysis-view.tsx` to display 8-category scores instead of 5 pillars
- Update benchmark, generate-config, generate-brief, generate-strategy routes to use new column names
- Update `page.tsx` text from "Five Pillars" to new taxonomy terminology
