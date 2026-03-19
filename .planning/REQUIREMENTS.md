# Requirements: v6.0 Ad Library UX Overhaul

## Overview

Transform the ad library from a basic browse grid into a fast, analytical tool — bringing V1 dashboard depth into the V2 ad library while keeping it slim and quick to scan.

## Requirements

### Analytics (ANLYT)

- **ANLYT-01**: Inline analytics bar — quick stats strip above the ad grid showing total reach, active ad count, format breakdown, top categories
- **ANLYT-02**: Demographic peek — per-brand or per-category mini demographic charts visible while browsing the ad grid

### Browse Experience (BRWS)

- **BRWS-01**: Ad detail lightbox — centered modal overlay on ad click with large media preview, full ad copy, stats, targeting info, dates
- **BRWS-02**: Sort controls — sort by spend/reach/days active/date with clear UI
- **BRWS-03**: View controls — grid density toggle (compact/standard) and optional list view
- **BRWS-04**: Load-more pagination — replace numbered pagination with initial 40-60 card batch + "Load more" button appending next batch

### Filters (FLTR)

- **FLTR-01**: Filter UX streamline — cleaner, more intuitive filter bar layout
- **FLTR-02**: Partnership/bylines filter — filter ads by partnership/collaboration status
- **FLTR-03**: Improved active filter chips — better visual treatment and interaction
- **FLTR-04**: Sticky filter bar — filter bar sticks to top on scroll

### Foundation (FNDN)

- **FNDN-01**: Component extraction — break 1044-line monolith into composable components (AdCard, FilterBar, AdGrid, Pagination, StatsBar) to enable clean feature development

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FNDN-01 | Phase 46 | Complete |
| FLTR-01 | Phase 47 | Pending |
| FLTR-02 | Phase 47 | Pending |
| FLTR-03 | Phase 47 | Pending |
| FLTR-04 | Phase 47 | Pending |
| BRWS-02 | Phase 47 | Pending |
| BRWS-03 | Phase 47 | Pending |
| BRWS-04 | Phase 48 | Pending |
| ANLYT-01 | Phase 49 | Pending |
| BRWS-01 | Phase 50 | Pending |
| ANLYT-02 | Phase 51 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0
