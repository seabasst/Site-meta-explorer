---
phase: 25-dashboard
plan: 01
subsystem: dashboard-ui
tags: [nextjs, dashboard, demographics, search, sort, competitor-card]
dependency-graph:
  requires: [24-brand-data]
  provides: [enhanced-competitor-cards, brand-detail-page, search-sort-controls]
  affects: [26-reanalysis, 27-deletion]
tech-stack:
  added: []
  patterns: [dynamic-route-params-promise, client-side-filtering, demographic-bar-charts]
key-files:
  created:
    - src/app/dashboard/[brandId]/page.tsx
  modified:
    - src/components/dashboard/competitor-card.tsx
    - src/app/dashboard/page.tsx
decisions:
  - id: DASH-CARD-LINK
    summary: "Used Next.js Link wrapping entire card with stopPropagation on buttons"
  - id: DASH-DETAIL-CLIENT
    summary: "Brand detail page is client component reusing useTrackedBrands hook"
  - id: DASH-DEMOGRAPHICS-BARS
    summary: "Demographics displayed as horizontal percentage bars with accent-green fill"
metrics:
  duration: ~5min
  completed: 2026-02-02
---

# Phase 25 Plan 01: Dashboard Enhancements Summary

Enhanced competitor cards with top country and date, clickable brand detail pages with full demographics breakdown, and search/sort controls for the competitors grid.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Enhance CompetitorCard with top country, date, and link | cfcb3ee | Wrapped card in Link, added topCountry1Code display, snapshot date |
| 2 | Create brand detail page with full demographics | 214c27c | New /dashboard/[brandId] page with gender/age/country bars |
| 3 | Add search and sort controls to competitors grid | f762005 | Search input, Date/Name sort toggles, filtered count |

## Implementation Details

### Task 1: Enhanced CompetitorCard
- Wrapped the card in `next/link` Link component pointing to `/dashboard/${competitor.id}`
- Added hover state with `border-medium` transition
- Button container uses `e.preventDefault(); e.stopPropagation()` to prevent navigation on Refresh/Remove clicks
- Top country row shows country code and percentage when `topCountry1Code` is present
- Snapshot date formatted as short date (e.g. "Jan 28") at card bottom

### Task 2: Brand Detail Page
- Client component using `React.use(params)` for Next.js 15+ promise-based params
- Reuses `useTrackedBrands` hook to find brand by ID from ownBrand or competitors array
- Key metrics displayed in a responsive 2x4 grid of metric boxes
- Demographics breakdown from `demographicsJson` parsed defensively with fallbacks:
  - Gender distribution: horizontal bars sorted by percentage
  - Age range distribution: horizontal bars sorted by age range
  - Country distribution: top 3 countries from snapshot fields
- Includes loading skeleton, not-found state with back link, and external Ad Library link

### Task 3: Search and Sort Controls
- Search input with lucide-react `Search` icon, filters competitors by name in real-time
- Two toggle buttons (Date/Name) with active state using `accent-green` background
- Competitors count updates to show "N of M" when search is active
- Empty search state shows "No brands match your search" message
- Controls bar only renders when competitors array is non-empty

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| DASH-CARD-LINK | Wrap entire card in Link with stopPropagation on buttons | Simplest approach, keeps card fully clickable while preserving button functionality |
| DASH-DETAIL-CLIENT | Client component reusing useTrackedBrands | Avoids duplicating API call logic; brand data already fetched by existing hook |
| DASH-DEMOGRAPHICS-BARS | Horizontal percentage bars for demographics | Consistent with existing dashboard design patterns; simple and readable |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes with zero errors
- `npm run build` completes successfully
- `/dashboard/[brandId]` route registered as dynamic in build output

## Success Criteria Met

- [x] DASH-01: Cards show key metrics including top country and last analyzed date
- [x] DASH-02: Cards link to /dashboard/[brandId] with full demographic breakdown
- [x] DASH-03: Sort controls allow ordering by date or name
- [x] DASH-04: Search input filters brands by name in real-time
