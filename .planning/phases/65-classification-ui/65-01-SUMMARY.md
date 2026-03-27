---
phase: 65-classification-ui
plan: 01
subsystem: ui-brand-detail
tags: [classification, distribution-charts, coverage, taxonomy, brand-detail]
depends_on:
  requires: [62-classification-schema, 63-classification-pipeline]
  provides: [classification-distribution-ui, coverage-indicator]
  affects: [65-02-ad-detail-tags]
tech-stack:
  added: []
  patterns: [in-memory-aggregation, horizontal-bar-chart, taxonomy-label-lookup]
key-files:
  created: []
  modified:
    - src/app/api/ad-library/brands/[pageId]/route.ts
    - src/app/dashboard/v2/ad-library/[pageId]/page.tsx
decisions:
  - id: "65-01-d1"
    decision: "In-memory aggregation over 8 separate groupBy queries"
    rationale: "Single findMany + loop is more efficient for moderate classification counts"
  - id: "65-01-d2"
    decision: "totalBrandAds uses unfiltered count for coverage denominator"
    rationale: "Coverage should reflect all brand ads, not just filtered page results"
metrics:
  duration: "30m"
  completed: "2026-03-27"
---

# Phase 65 Plan 01: Classification Distribution Charts Summary

**One-liner:** Horizontal bar charts for 8 classification dimensions with coverage badge on brand detail page, powered by in-memory aggregation from AdClassification table.

## What Was Done

### Task 1: Add classification distribution data to brand detail API
- Added `classifiedCount` and `classifications` queries to the existing Promise.all in the GET handler
- Built 8-category distribution (value -> count maps) using in-memory aggregation over CATEGORY_KEYS
- Added `classificationCoverage` (classified/total) and `classificationDistribution` to JSON response
- Imported CATEGORY_KEYS from taxonomy for iteration
- Coverage denominator uses unfiltered brand ad count (not paginated/filtered count)

### Task 2: Render distribution charts and coverage badge on brand detail page
- Added `ClassificationSection` component with coverage pill badge showing "X of Y ads classified" with progress bar
- Added `DistributionChart` component rendering horizontal bar charts per category
- Charts show human-readable labels via `TAXONOMY[key].labels[slug]` with capitalize fallback
- Values sorted by count descending, capped at 8 per category
- Bar opacity scales with relative count for visual hierarchy
- Empty state shows when no classifications exist
- Full dark/light mode support using `#1235e2` primary

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **In-memory aggregation** - Single `findMany` + loop over CATEGORY_KEYS rather than 8 separate `groupBy` queries (matches diversity route pattern)
2. **Unfiltered total for coverage** - Separate `count({ where: { brandId } })` for coverage denominator so it reflects all brand ads, not just the filtered/paginated subset

## Commits

| Hash | Message |
|------|---------|
| dbf48f3 | feat(65-01): add classification distribution data to brand detail API |
| 22dfcf9 | feat(65-01): render distribution charts and coverage badge on brand detail page |

## Verification

1. Brand detail API returns `classificationCoverage` and `classificationDistribution` fields - PASS
2. Brand page renders distribution charts with human-readable labels from TAXONOMY - PASS
3. Coverage badge shows X of Y classified - PASS
4. Brands with 0 classifications show graceful empty state - PASS
5. Dark mode and light mode rendering correct - PASS
6. Type-check passes (`tsc --noEmit` shows no errors in modified files) - PASS
7. Build fails only on pre-existing `creators/route.ts` error (unrelated) - KNOWN
