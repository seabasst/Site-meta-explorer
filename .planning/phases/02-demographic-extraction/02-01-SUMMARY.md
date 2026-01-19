---
phase: 02-demographic-extraction
plan: 01
subsystem: data-types
tags: [typescript, types, demographics, selector]

dependency-graph:
  requires:
    - 01-foundation (rebrowser upgrade, existing scraper)
  provides:
    - DemographicBreakdown, RegionBreakdown, AdDemographics types
    - AdWithMetrics type for top performer selection
    - selectTopPerformers function
    - AdData.adArchiveId field for ad detail navigation
  affects:
    - 02-02 (demographic extraction will use these types)
    - 02-03 (aggregation will use AdDemographics)
    - 03-phase (display layer will consume these types)

tech-stack:
  added: []
  patterns:
    - Type-first design (define interfaces before implementation)
    - Composite scoring (reach primary, duration secondary)

key-files:
  created:
    - src/lib/demographic-types.ts
    - src/lib/top-performer-selector.ts
  modified:
    - src/lib/ad-library-scraper.ts

decisions:
  - id: reach-over-duration
    choice: Sort by reach first, then duration
    rationale: Higher-reach ads contribute more to weighted aggregation in Phase 3

metrics:
  duration: 3min
  completed: 2026-01-19
---

# Phase 02 Plan 01: Types and Top Performer Selector Summary

**One-liner:** Type definitions for demographic data plus reach-prioritized top performer selection for scraping budget management

## What Was Built

### Task 1: Demographic Type Definitions
Created `src/lib/demographic-types.ts` with four interfaces:
- `DemographicBreakdown` - age/gender percentage (e.g., "18-24", "male", 15.5%)
- `RegionBreakdown` - country/region percentage (e.g., "DE", 25%)
- `AdDemographics` - complete demographics for a single ad (archive ID, age/gender array, region array, optional reach/impressions)
- `AdWithMetrics` - minimal ad data needed for top performer selection

### Task 2: AdData Interface Extension
Extended `AdData` interface in `src/lib/ad-library-scraper.ts`:
- Added `adArchiveId: string | null` field
- Populated from tracked ad archive IDs (first ID from the set)
- Required for navigating to ad detail pages for demographic extraction

### Task 3: Top Performer Selector
Created `src/lib/top-performer-selector.ts` with `selectTopPerformers()`:
- Filters to ads with archive IDs only (required for scraping)
- Calculates duration score (days running from start date)
- Calculates reach score (midpoint of reach range)
- Sorts by reach (descending) then duration (descending)
- Limits to maxAds (default 10) for timeout budget

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Reach over duration | Primary sort by reach, secondary by duration | Higher-reach ads contribute more to weighted demographic aggregation |
| First archive ID | Use first ID from set for adArchiveId | Simpler than tracking all IDs; one is sufficient for detail page navigation |

## Deviations from Plan

None - plan executed exactly as written.

## Commit Log

| Commit | Type | Description |
|--------|------|-------------|
| a38a7f8 | feat | Create demographic type definitions |
| a7f7cc5 | feat | Add adArchiveId field to AdData interface |
| cdf48cf | feat | Implement top performer selector |

## Verification Results

- TypeScript compiles without errors (`npx tsc --noEmit` passes)
- All three files exist with correct exports
- Four interfaces exported from demographic-types.ts
- selectTopPerformers exported from top-performer-selector.ts
- AdData.adArchiveId field present and populated

## Next Phase Readiness

Ready for Plan 02 (demographic extraction):
- Types are defined and exported
- adArchiveId available for ad detail page navigation
- Top performer selector ready to identify which ads to scrape
- No blockers identified
