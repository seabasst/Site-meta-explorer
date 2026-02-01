---
phase: 17-mobile-polish
plan: 01
subsystem: ui-responsive
tags: [tailwind, responsive, mobile, touch-targets]
dependency-graph:
  requires: []
  provides: ["responsive-main-page", "mobile-touch-targets", "tap-export-dropdown"]
  affects: ["17-02", "17-03"]
tech-stack:
  added: []
  patterns: ["flex-col sm:flex-row stacking", "hidden sm:block for mobile simplification", "overflow-x-auto for horizontal scroll", "click-outside-to-close with useRef+useEffect", "min-h-[48px] touch target pattern"]
key-files:
  created: []
  modified: ["src/app/page.tsx"]
decisions:
  - id: "17-01-d1"
    decision: "Hide options bar dividers on mobile rather than restyling them"
    rationale: "Dividers look broken when flex-wrap causes them to appear between wrapped rows"
  - id: "17-01-d2"
    decision: "Keep hover behavior for export dropdown alongside tap-to-toggle"
    rationale: "Desktop users expect hover dropdowns; mobile gets tap; both work simultaneously"
  - id: "17-01-d3"
    decision: "Hide tab icons on mobile instead of shrinking tabs"
    rationale: "Text-only tabs fit 375px reliably; icons are decorative not functional"
metrics:
  duration: "~3 minutes"
  completed: "2026-02-01"
---

# Phase 17 Plan 01: Main Page Responsive Summary

Responsive layout fixes and 48px touch targets for page.tsx on 375px mobile viewports, plus tap-to-toggle export dropdown for touch devices.

## What Was Done

### Task 1: Fix layout overflow and touch targets
- **Options bar:** Added `hidden sm:block` to three vertical divider elements so they hide on mobile when flex-wrap causes line breaks
- **Media type breakdown:** Changed container from `flex items-center gap-8` to `flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-8`; dividers switch from vertical to horizontal on mobile (`h-px w-full sm:h-12 sm:w-px`); buttons get `min-h-[48px]`
- **All-ads table:** Wrapped existing scroll container in `overflow-x-auto` div; added `min-w-[640px]` to table element for horizontal scroll on mobile
- **Tab navigation:** Added `max-w-full overflow-x-auto` to container; hid SVG icons on mobile with `hidden sm:block`; reduced padding to `px-3 sm:px-4`; added `whitespace-nowrap`
- **ActiveChartFilter close button:** Changed from `p-0.5` to `p-2.5 -m-2` for 48px touch target while preserving visual size
- **Example brand pills:** Changed from `py-1.5` to `py-3 min-h-[48px]` for touch target compliance

### Task 2: Add tap-to-toggle for export dropdown
- Added `exportOpen` state and `exportRef` ref to the component
- Export button triggers `onClick={() => setExportOpen(prev => !prev)}`
- Dropdown visibility: `${exportOpen ? 'opacity-100 visible' : 'opacity-0 invisible'} group-hover:opacity-100 group-hover:visible`
- `useEffect` with `mousedown` listener on document closes dropdown when clicking outside the ref
- Each export item calls `setExportOpen(false)` in its onClick handler
- Export button gets `min-h-[48px]` for touch target

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 17-01-d1 | Hide dividers on mobile | Flex-wrap breaks vertical divider layout; hiding is cleaner than restyling |
| 17-01-d2 | Dual hover+tap for export | Desktop hover preserved; mobile gets tap; no conflict |
| 17-01-d3 | Hide tab icons on mobile | Text-only tabs fit 375px; icons are decorative |

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 9578473 | feat(17-01): fix layout overflow and touch targets in page.tsx |
| 2 | 21412a7 | feat(17-01): add tap-to-toggle for export dropdown |

## Verification

- `npx next build` succeeds after both tasks
- Options bar dividers hidden on mobile (hidden sm:block)
- Media type section stacks vertically on mobile (flex-col sm:flex-row)
- All-ads table scrolls horizontally with min-w-[640px]
- Tab navigation fits with hidden icons and overflow-x-auto
- ActiveChartFilter close button has expanded 48px touch target
- Brand pills have min-h-[48px] touch targets
- Export dropdown opens on tap and closes on outside click

## Next Phase Readiness

No blockers. The main page layout is now responsive. Remaining mobile work in 17-02 (component-level responsive) and 17-03 (viewport meta/testing) can proceed.
