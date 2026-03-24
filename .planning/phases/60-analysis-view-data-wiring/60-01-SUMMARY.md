---
phase: 60
plan: 01
subsystem: creative-lab
tags: [bugfix, data-wiring, analysis-view, benchmark, diversity-scores]
dependency-graph:
  requires: [55, 56, 57, 58, 59]
  provides: [working-analysis-view-data-display, category-aware-benchmark]
  affects: [60-02]
tech-stack:
  added: []
  patterns: [interface-api-alignment, guard-clause-for-optional-data]
key-files:
  created: []
  modified:
    - src/app/dashboard/v2/creative-lab/analysis-view.tsx
    - src/app/dashboard/v2/creative-lab/page.tsx
    - src/app/api/search-pages/route.ts
decisions:
  - id: D60-01
    description: "Use loose Record<string, unknown> for andromedaMetrics type since the component does not render those fields directly"
  - id: D60-02
    description: "Skip benchmark call entirely when brand.category is falsy (Facebook API brands) rather than passing empty string"
metrics:
  duration: ~2min
  completed: 2026-03-24
---

# Phase 60 Plan 01: Analysis View Data Wiring Summary

**Fixed two cross-phase wiring bugs: DiversityResult interface mismatch causing undefined/NaN score pills, and brand.source being passed as category to benchmark API instead of the actual product category.**

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Fix DiversityResult interface to match API response | 74af114 | Updated interface fields, changed scores[key] to diversityScores[key] |
| 2 | Add category to search results and fix benchmark API call | 147eb4c | Added category to search-pages API, SearchResult type, and benchmark fetch |

## What Changed

### Task 1: DiversityResult Interface Fix
The `/api/analyze/diversity` endpoint returns `diversityScores` (not `scores`), `andromedaScore` as a top-level number, and `andromedaMetrics` as a complex nested object. The client interface expected `scores`, a simplified `andromedaMetrics` with `{ andromedaScore, uniqueCombinations, totalAds, maxPossible }`. Updated the interface to match reality and changed pill rendering to access `diversity.diversityScores[key]`.

### Task 2: Category Wiring Fix
The benchmark API requires the brand's product category (e.g., "E-commerce") but received `brand.source` which is `'local'` or `'api'` -- the search result origin, not the product category. Fixed by:
- Adding `category` to the Prisma select in search-pages API
- Including `category` in local search results mapping
- Adding `category: null` for Facebook API results (which lack category data)
- Adding `category` field to `SearchResult` interface
- Changing benchmark fetch from `brand.source` to `brand.category`
- Adding guard to skip benchmark entirely when category is unavailable

## Verification Results

1. `npx tsc --noEmit` -- zero errors
2. `npx next build` -- succeeds
3. `diversity.scores[` in analysis-view.tsx -- zero matches (replaced)
4. `brand.source` in analysis-view.tsx fetch body -- zero matches (replaced)
5. `brand.category` in analysis-view.tsx -- appears in guard and fetch body
6. `category` in search-pages route.ts -- appears in Prisma select and results mapping

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **D60-01:** Used `Record<string, unknown>` for `andromedaMetrics` type rather than fully typing the complex nested structure, since the AnalysisView component does not render any andromedaMetrics fields directly.
2. **D60-02:** When a brand has no category (Facebook API results), the benchmark call is skipped entirely rather than passing an empty/null category, since the benchmark API validates that category is required.
