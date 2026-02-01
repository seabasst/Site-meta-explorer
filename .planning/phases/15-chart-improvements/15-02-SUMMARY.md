---
phase: 15
plan: 02
subsystem: charts
tags: [click-to-filter, interactivity, chart-filtering, useMemo]

dependency-graph:
  requires: [15-01]
  provides: ["Click-to-filter interactivity for CountryChart and MediaTypeChart", "Visual highlighting for AgeGenderChart", "ActiveChartFilter clearable pill component", "filteredAds useMemo for ad list filtering"]
  affects: [15-03]

tech-stack:
  added: []
  patterns: ["Chart filter state with toggle behavior (click same to clear)", "useMemo-based ad filtering by chart selection", "Opacity dimming for non-active chart segments"]

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - src/components/demographics/country-chart.tsx
    - src/components/demographics/age-gender-chart.tsx
    - src/components/demographics/media-type-chart.tsx

decisions:
  - id: "15-02-D1"
    decision: "Use ad.demographics.regionBreakdown instead of plan's ad.demographicDistribution for country filtering"
    reason: "The actual FacebookAdResult type has demographics.regionBreakdown, not demographicDistribution"
  - id: "15-02-D2"
    decision: "Made inline video/image stat cards in page.tsx ads tab clickable in addition to MediaTypeChart component"
    reason: "MediaTypeChart component is not rendered in page.tsx; the ads tab uses inline stat cards for media type display, so those needed click-to-filter too"

metrics:
  duration: "~3 minutes"
  completed: "2026-02-01"
---

# Phase 15 Plan 02: Click-to-Filter Interactivity Summary

Chart click-to-filter with country/mediaType ad filtering, ageGender visual highlighting, clearable filter pill, and opacity dimming for non-active segments.

## What Was Done

### Task 1: Add chart filter state and ActiveChartFilter component to page.tsx
- **Commit:** `c0d5398`
- Added `chartFilter` state with type/value/label supporting country, mediaType, and ageGender
- Created `filteredAds` useMemo that filters `apiResult.ads` by region (demographics.regionBreakdown) or mediaType
- Built `ActiveChartFilter` component as a rounded pill with emerald accent border, label, and X dismiss button
- Rendered ActiveChartFilter in both audience and ads tabs
- Made video/image stat cards in ads tab clickable with ring highlight for active, opacity-40 for inactive
- Updated "All Active Ads" table to use `filteredAds` with filtered count indicator
- Added `setChartFilter(null)` to handleAdLibrarySubmit reset logic
- Passed `onSegmentClick` and `activeFilter` props to CountryChart and AgeGenderChart

### Task 2: Add click-to-filter to CountryChart, AgeGenderChart, and MediaTypeChart
- **Commit:** `0b191dd`
- **CountryChart:** Added cursor-pointer, onClick handler calling onSegmentClick with country originalName, opacity-40 dimming for non-matching countries when filter active
- **AgeGenderChart:** Added cursor-pointer, onClick handler for age group selection, opacity-40 dimming (visual only -- no ad filtering since demographics are aggregated)
- **MediaTypeChart:** Added onClick to Recharts Bar component with cursor="pointer", Cell opacity based on active filter, clickable stat cards with ring/border highlight and opacity dimming

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect field path for country filtering**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `ad.demographicDistribution?.some(d => d.region === chartFilter.value)` but the actual type uses `ad.demographics?.regionBreakdown`
- **Fix:** Used `ad.demographics?.regionBreakdown?.some(d => d.region === chartFilter.value)` matching the real FacebookAdResult type
- **Files modified:** src/app/page.tsx
- **Commit:** c0d5398

**2. [Rule 2 - Missing Critical] Added type check to toggle behavior**
- **Found during:** Task 1 implementation
- **Issue:** Plan's toggle logic `prev?.value === filter.value ? null : filter` could incorrectly clear a country filter when clicking a media type with the same value string
- **Fix:** Added type check: `prev?.value === filter.value && prev?.type === filter.type ? null : filter`
- **Files modified:** src/app/page.tsx
- **Commit:** c0d5398

## Verification

- Build passes with zero TypeScript errors
- Country click filters ad list to ads with demographic data in that region
- Media type click (stat cards or chart bar) filters ad list by video/image
- Age/gender click provides visual highlighting without ad filtering
- Active filter shown as clearable emerald-bordered pill
- Toggle behavior: clicking same element clears filter
- Filter auto-clears on new analysis
- Chart tooltips from Plan 01 still functional

## Next Phase Readiness

No blockers for Plan 03. The chartFilter state pattern is extensible if future charts need filtering support.
