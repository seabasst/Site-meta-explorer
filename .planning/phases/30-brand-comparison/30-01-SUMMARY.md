---
phase: 30-brand-comparison
plan: 01
subsystem: ui
tags: [recharts, butterfly-chart, comparison, demographics, bar-chart]

# Dependency graph
requires:
  - phase: 28-hook-extraction
    provides: AggregatedDemographics type and demographic data in snapshots
provides:
  - ButterflyChart component for age-gender butterfly visualization
  - CountryComparison component for paired country bar chart
  - MetricsTable component for side-by-side brand metrics
affects: [30-02 comparison page assembly]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recharts BarChart with layout=vertical and negative values for butterfly chart"
    - "Country merging with top-8 cutoff and Other grouping"

key-files:
  created:
    - src/components/comparison/butterfly-chart.tsx
    - src/components/comparison/country-comparison.tsx
    - src/components/comparison/metrics-table.tsx
  modified: []

key-decisions:
  - "Used Recharts negative-value technique for butterfly chart rather than custom CSS bars"
  - "Duplicated COUNTRY_NAMES subset rather than importing from country-chart.tsx to keep components decoupled"

patterns-established:
  - "Butterfly chart: negate Brand A values, positive Brand B values, stackOffset=sign"
  - "Country merge: union of both brands, sort by combined percentage, top 8 + Other"

# Metrics
duration: 2min
completed: 2026-02-02
---

# Phase 30 Plan 01: Comparison Visualization Components Summary

**Three Recharts-based comparison components: butterfly chart (age-gender with negative/positive bars), paired country bar chart (top 8 merged), and metrics table (8 key stats from latest snapshots)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-02T19:56:41Z
- **Completed:** 2026-02-02T19:58:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- ButterflyChart renders age-gender data for two brands with Brand A extending left (negative values) and Brand B extending right (positive values) using Recharts BarChart with vertical layout
- CountryComparison merges country data from both brands, takes top 8 by combined percentage, groups rest as "Other", renders paired horizontal bars
- MetricsTable displays 8 formatted metrics side-by-side (active ads, reach, spend, demographics, video %, ad age) with em-dash placeholders for missing data

## Task Commits

Each task was committed atomically:

1. **Task 1: Create ButterflyChart and CountryComparison components** - `b05a628` (feat)
2. **Task 2: Create MetricsTable component** - `ff4b890` (feat)

## Files Created/Modified
- `src/components/comparison/butterfly-chart.tsx` - Age-gender butterfly chart using Recharts BarChart with negative Brand A values and positive Brand B values
- `src/components/comparison/country-comparison.tsx` - Paired horizontal bar chart for country distribution comparison with top 8 + Other grouping
- `src/components/comparison/metrics-table.tsx` - Side-by-side summary metrics table with 8 key stats from latest snapshots

## Decisions Made
- Used Recharts negative-value technique for butterfly chart (consistent with TrendChart Recharts usage, handles axes/tooltips automatically)
- Duplicated COUNTRY_NAMES mapping subset in country-comparison.tsx rather than importing from country-chart.tsx (keeps comparison components self-contained)
- Used CSS variable styling (var(--text-muted), var(--border-subtle)) matching existing dashboard component patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter type signatures**
- **Found during:** Task 1 (ButterflyChart and CountryComparison)
- **Issue:** Recharts v3.6.0 Tooltip formatter expects `value: number | undefined` and `name: string | undefined`, not strict types
- **Fix:** Updated formatter parameter types to accept undefined, added nullish coalescing defaults
- **Files modified:** butterfly-chart.tsx, country-comparison.tsx
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** b05a628 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Type fix necessary for compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three comparison components ready for composition by the comparison page in Plan 02
- Components accept props (brand names + AggregatedDemographics or TrackedBrand) and are fully self-contained
- No blockers for Plan 02

---
*Phase: 30-brand-comparison*
*Completed: 2026-02-02*
