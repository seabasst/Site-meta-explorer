---
phase: 32-trend-analysis
plan: 01
subsystem: api
tags: [demographics, normalization, time-series, recharts]

# Dependency graph
requires:
  - phase: 27-re-analysis-flow
    provides: BrandSnapshot.demographicsJson storage
provides:
  - demographics-normalizer utility for schema drift handling
  - GET /api/dashboard/trends endpoint for time-series data
affects: [32-02, trend-visualization, demographic-charts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSON schema normalization for legacy data compatibility
    - Union approach for dynamic country keys in trend data

key-files:
  created:
    - src/lib/demographics-normalizer.ts
    - src/app/api/dashboard/trends/route.ts
  modified: []

key-decisions:
  - "Use union of all top-5 countries across snapshots for consistent countryTrend keys"
  - "Return 0 for missing values instead of omitting keys (chart-friendly)"
  - "Sort age brackets by leading number, regions by percentage descending"

patterns-established:
  - "Schema normalization pattern: check array format first (new), fall back to object (old)"
  - "Trend API response shape: timestamp (epoch ms), date (string), snapshotId, plus flat data keys"

# Metrics
duration: 2min
completed: 2026-02-06
---

# Phase 32 Plan 01: Demographics Data Layer Summary

**JSON schema normalizer for demographicsJson drift + GET /api/dashboard/trends endpoint returning age/gender/country time-series data**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-06T07:54:10Z
- **Completed:** 2026-02-06T07:56:31Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Demographics normalizer handles both old (object-based) and new (array-based) JSON formats
- Trends API endpoint returns structured time-series data ready for Recharts
- Union approach for country trends ensures consistent keys across all snapshots

## Task Commits

Each task was committed atomically:

1. **Task 1: Create demographics normalizer utility** - `7362b32` (feat)
2. **Task 2: Create trends API endpoint** - `fa16305` (feat)

## Files Created/Modified
- `src/lib/demographics-normalizer.ts` - Normalizes demographicsJson from BrandSnapshot, handles schema drift
- `src/app/api/dashboard/trends/route.ts` - Returns ageTrend, genderTrend, countryTrend for tracked brands

## Decisions Made
- **Union approach for countryTrend:** Collect all countries appearing in top-5 of ANY snapshot, then include all in every data point (0 for missing). This ensures chart lines don't disappear/appear across snapshots.
- **Flat keys for age/gender:** Use '13-17', '18-24', etc. as direct object keys rather than nested arrays. This is what Recharts expects for multi-line charts.
- **Unix epoch milliseconds:** Timestamps are numbers (not Date objects) for Recharts `type="number"` + `scale="time"` compatibility.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data layer complete with normalizer and API endpoint
- Ready for 32-02: Frontend chart component implementation
- API returns all three trend types with proper timestamp format for Recharts

---
*Phase: 32-trend-analysis*
*Completed: 2026-02-06*
