---
phase: 14-ad-preview
plan: 01
subsystem: ui-components
tags: [ad-preview, media-type, badge, truncation]

dependency-graph:
  requires: [06-ad-preview-cards, 13-pro-features]
  provides: [working-media-badges, full-creative-text]
  affects: []

tech-stack:
  added: []
  patterns: [resolved-media-type-for-badges]

key-files:
  created: []
  modified:
    - src/components/ads/ad-preview-card.tsx

decisions:
  - id: PREV-BADGE
    choice: "Use resolvedMediaType from useAdMedia hook for badge display"
    reason: "ad.mediaType is always 'unknown' from the API; useAdMedia already resolves actual type from media URLs"
  - id: PREV-SNAPSHOT
    choice: "No badge shown for 'snapshot' media type"
    reason: "Snapshot is a Vercel fallback (iframe render), not a real media type distinction"

metrics:
  duration: ~1min
  completed: 2026-02-01
---

# Phase 14 Plan 01: Fix Ad Preview Card Summary

**One-liner:** Fix media type badge to use resolvedMediaType from useAdMedia hook and remove line-clamp-2 from creative body text.

## What Was Done

### Task 1: Fix media type badge and remove creative text truncation

**Changes to `src/components/ads/ad-preview-card.tsx`:**

1. **Added `badgeType` derivation** (after useAdMedia call): Computes badge type from `resolvedMediaType` returned by the existing `useAdMedia` hook. Falls back to `ad.mediaType` if not 'unknown', otherwise `null` (no badge).

2. **Updated badge JSX**: Replaced `ad.mediaType !== 'unknown'` condition with `badgeType` truthiness check. All badge rendering now uses `badgeType` instead of `ad.mediaType`.

3. **Updated fallback placeholder**: The placeholder icon and text now use `badgeType` instead of `ad.mediaType` for consistency.

4. **Removed `line-clamp-2` from creative body**: The `<p>` tag for `creativeBody` no longer truncates text, honoring the Phase 6 decision to show full ad creative text. The `line-clamp-2` on `linkTitle` was intentionally preserved (titles are short, truncation is reasonable).

**Commit:** `e655926` - feat(14-01): fix media type badge and remove creative text truncation

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- Build passes with no TypeScript or compilation errors (`npx next build`)
- `badgeType` variable derived from `resolvedMediaType` (not `ad.mediaType`)
- Badge JSX uses `badgeType` throughout
- `line-clamp-2` removed from creativeBody paragraph
- `line-clamp-2` preserved on linkTitle
- Only `ad-preview-card.tsx` modified

## Success Criteria

| Criterion | Status |
|-----------|--------|
| PREV-01: Click to view ad on Facebook | Already working, unchanged |
| PREV-02: Full creative text visible | Done - line-clamp-2 removed from body |
| PREV-03: Video/Image badges based on resolved type | Done - badgeType from resolvedMediaType |
| Build passes | Verified |
| No regressions | Only badge source and truncation changed |

## Next Phase Readiness

No blockers. Phase 14 is complete with all three success criteria met.
