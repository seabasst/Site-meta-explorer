---
phase: 40-dashboard-rework
plan: 01
subsystem: dashboard-ui
tags: [recharts, analytics, dashboard, kpi, charts]
dependency-graph:
  requires: [39-navigation-restructure]
  provides: [analytics-dashboard-widgets, dashboard-page-rework]
  affects: [40-02-dashboard-filters]
tech-stack:
  added: []
  patterns: [two-phase-data-loading, progressive-skeleton-loading]
key-files:
  created:
    - src/components/dashboard/kpi-card.tsx
    - src/components/dashboard/format-distribution-chart.tsx
    - src/components/dashboard/ads-timeline-chart.tsx
    - src/components/dashboard/platform-breakdown-chart.tsx
    - src/components/dashboard/top-brands-table.tsx
  modified:
    - src/app/dashboard/v2/page.tsx
decisions:
  - id: DASH-01
    decision: "Dashboard shows aggregated analytics (KPI cards, charts, table) instead of ad cards"
    rationale: "Dashboard duplicated Ad Library by showing top ad cards; analytics view provides unique value"
metrics:
  duration: "~3 minutes"
  completed: "2026-03-17"
---

# Phase 40 Plan 01: Analytics Widgets Summary

**One-liner:** Replaced ad-card dashboard with analytics overview using KPI cards, Recharts area/pie/bar charts, and sortable brands table with two-phase progressive loading.

## What Was Done

### Task 1: Create analytics widget components
Created 5 new dashboard widget components in `src/components/dashboard/`:

1. **KpiCard** - Reusable metric card with icon, formatted value, and optional trend indicator
2. **FormatDistributionChart** - Recharts donut chart showing ad format breakdown with dark mode Tooltip/Legend
3. **AdsTimelineChart** - Recharts area chart with two series (total/active ads) over time
4. **PlatformBreakdownChart** - Horizontal bar chart with dynamic height based on platform count
5. **TopBrandsTable** - Sortable HTML table with brand links, ad counts, and reach metrics

All components use `useV2()` for dark mode, `V2Card` wrapper, and consistent styling with the `#1235e2` brand color.

### Task 2: Rework dashboard page
Completely replaced `src/app/dashboard/v2/page.tsx`:

- **Removed:** Ad interface, AdCard component, TrackedBrand/DashboardData interfaces, benchmarking section, sort tabs, ad grid, `/api/ad-library/ads` fetch
- **Added:** Two-phase data loading pattern (fast stats for instant KPI display, full stats for charts)
- **Layout:** 4-column KPI row, 2-column charts grid (timeline + format distribution), 2-column grid (platform breakdown + filters placeholder), full-width brands table
- **Progressive loading:** KPIs show immediately from fast mode; charts and table show skeletons until full stats arrive; Total Reach shows "..." until full load completes

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| DASH-01 | Analytics dashboard replaces ad cards | Dashboard no longer duplicates Ad Library; shows aggregated metrics instead |

## Verification

- `npx tsc --noEmit` passes with no errors
- `npm run build` succeeds
- Dashboard page renders KPI cards, 3 charts, and brands table
- No individual ad cards appear on the dashboard
- All components support dark mode via `useV2()`

## Commits

| Hash | Message |
|------|---------|
| 11e8d46 | feat(40-01): create analytics widget components |
| fb47ba6 | feat(40-01): rework dashboard page with analytics widgets |
