---
phase: 51-demographic-peek
plan: 01
subsystem: ad-library-ui
tags: [recharts, demographics, charts, api]
dependency-graph:
  requires: []
  provides: [demographic-peek-component, demographics-api-field]
  affects: [51-02]
tech-stack:
  added: []
  patterns: [collapsible-chart-panel, per-cell-bar-colors]
key-files:
  created:
    - src/app/dashboard/v2/ad-library/components/demographic-peek.tsx
  modified:
    - src/app/api/ad-library/brands/[pageId]/route.ts
decisions:
  - id: dp-01
    decision: "Use collapsible panel with chevron toggle rather than always-visible charts"
    rationale: "Keeps the browse view clean; demographics are secondary to ad content"
metrics:
  duration: ~2 min
  completed: 2026-03-20
---

# Phase 51 Plan 01: Demographic Peek API + Component Summary

**One-liner:** Brand API now returns demographicsJson; DemographicPeek component renders age/gender/region mini bar charts with dark/light mode support.

## What Was Done

### Task 1: Add demographicsJson to brand API serialization
- Added `demographicsJson: unknown` to `SerializedBrand` interface
- Added optional `demographicsJson` to `serializeBrand` function input type
- Pass-through with null fallback: `brand.demographicsJson ?? null`
- No changes to PATCH or DELETE handlers

### Task 2: Create DemographicPeek component with mini charts
- Created `demographic-peek.tsx` (236 lines) with 3 mini Recharts charts:
  - **Age:** Vertical bar chart, blue (#1235e2), sorted by age bracket
  - **Gender:** Horizontal bar chart, per-gender colors (blue/pink/gray via Cell)
  - **Region:** Vertical bar chart, green (#22c55e), top 5 only
- Collapsible panel with ChevronDown/ChevronUp toggle
- Full dark/light mode theming (container, axes, tooltips, labels)
- Returns null when all breakdowns are empty
- Imports NormalizedDemographics from `@/lib/demographics-normalizer`

## Commits

| Hash | Message |
|------|---------|
| 4b9e878 | feat(51-01): add demographicsJson to brand API serialization |
| 13545d4 | feat(51-01): create DemographicPeek component with mini charts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter type**
- **Found during:** Task 2
- **Issue:** Recharts `Tooltip` `formatter` callback receives `number | undefined`, not `number`
- **Fix:** Changed parameter type to `number | undefined` with `?? 0` fallback
- **Files modified:** demographic-peek.tsx

## Verification

- [x] `npx tsc --noEmit` passes with no errors
- [x] Brand API endpoint returns `demographicsJson` in response
- [x] `demographic-peek.tsx` exports `DemographicPeek` component
- [x] Component imports from `@/lib/demographics-normalizer` and `recharts`

## Next Phase Readiness

Plan 51-02 can wire DemographicPeek into the ad library page.tsx with:
- Brand detail fetch already returns `demographicsJson`
- Component accepts `NormalizedDemographics` (use `normalizeDemographicsJson()` to convert)
- Collapsed state management needed in page.tsx
