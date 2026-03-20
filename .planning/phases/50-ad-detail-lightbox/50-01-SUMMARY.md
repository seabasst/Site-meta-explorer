---
phase: 50-ad-detail-lightbox
plan: 01
subsystem: ui
tags: [react, typescript, ad-card, lightbox-prep, event-propagation]

# Dependency graph
requires:
  - phase: 46-component-extraction
    provides: AdCard component extracted to separate file
provides:
  - Expanded Ad interface with all detail fields (spend, impressions, targeting, dates, CTA, link)
  - Clickable AdCard with onSelect prop and propagation guards
affects: [50-02 lightbox component, any future ad detail views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "stopPropagation on interactive child elements to prevent parent click handler"

key-files:
  created: []
  modified:
    - src/app/dashboard/v2/ad-library/types.ts
    - src/app/dashboard/v2/ad-library/components/ad-card.tsx

key-decisions:
  - "Use unknown type for targetingJson since shape varies across ads"
  - "Conditional cursor-pointer only when onSelect provided to preserve existing card appearance"

patterns-established:
  - "Event propagation: interactive children (video, links, buttons) call stopPropagation to avoid triggering parent click"

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 50 Plan 01: Types & AdCard Clickability Summary

**Expanded Ad interface with 12 detail fields matching API response, plus clickable AdCard with propagation-safe onSelect prop**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T08:16:12Z
- **Completed:** 2026-03-20T08:20:12Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Ad interface now includes endDate, adDurationDays, impressions, spend, currency, targetingJson, linkUrl, linkDescription, ctaText, ctaType
- AdCard accepts optional onSelect callback with cursor-pointer styling
- Click propagation stopped on video controls, save button, View on Meta link, and brand name link

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand Ad interface with all API detail fields** - `9748997` (feat)
2. **Task 2: Add onSelect prop to AdCard with click propagation handling** - `2612fee` (feat)

## Files Created/Modified
- `src/app/dashboard/v2/ad-library/types.ts` - Added 12 detail fields to Ad interface
- `src/app/dashboard/v2/ad-library/components/ad-card.tsx` - Added onSelect prop with propagation guards on all interactive elements

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ad type and AdCard are ready for lightbox consumption in 50-02
- onSelect callback can be wired to open a lightbox/detail panel
- All detail fields (spend, impressions, targeting, CTA) available for lightbox display

---
*Phase: 50-ad-detail-lightbox*
*Completed: 2026-03-20*
