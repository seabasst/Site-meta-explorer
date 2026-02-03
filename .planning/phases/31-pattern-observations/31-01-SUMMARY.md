---
phase: 31-pattern-observations
plan: 01
subsystem: observation-engine
tags: [pattern-detection, rule-engine, observations, demographics, hooks]
dependency_graph:
  requires: [phase-28-hooks, phase-24-brand-tracking]
  provides: [observation-engine, observation-card-components]
  affects: [31-02-integration]
tech_stack:
  added: []
  patterns: [pure-function-rule-engine, conditional-null-rendering]
key_files:
  created:
    - src/lib/observation-engine.ts
    - src/components/dashboard/observation-card.tsx
    - src/components/dashboard/observation-list.tsx
  modified: []
decisions:
  - Used Intl.DisplayNames for country code to name mapping (no custom lookup)
  - Magnitude normalization per-type for cross-type ranking
  - ObservationList returns null when empty (OBSV-06)
metrics:
  duration: 64s
  completed: 2026-02-03
---

# Phase 31 Plan 01: Observation Engine and Card Components Summary

**Pure function observation engine with 4 threshold-based detectors and compact card UI components**

## What Was Done

### Task 1: Create observation engine
Created `src/lib/observation-engine.ts` as a pure function module with four independent detector functions:

- **detectDemographicSkew** -- triggers when dominantAgePct >= 25% with both age and gender data present. Magnitude equals the raw percentage.
- **detectGenderImbalance** -- triggers when dominantGenderPct > 60%. Magnitude normalized as distance from threshold: `(pct - 60) / 40 * 100`.
- **detectGeoConcentration** -- triggers when top 2 countries exceed 50% of reach. Uses `Intl.DisplayNames` to convert ISO country codes to full names. Handles single-country and two-country cases.
- **detectHookPattern** -- triggers when top hook frequency >= 3 and total ads >= 5. Truncates hook text to 50 chars. Magnitude is frequency as percentage of total ads.

The `generateObservations()` function collects non-null results, sorts by magnitude descending, and caps at 5.

### Task 2: Create observation card components
Created two client components:

- **ObservationCard** -- renders a compact card with Lucide icon (type-mapped: Users, Scale, Globe, MessageSquare), uppercase title, and description. Uses existing CSS variable system.
- **ObservationList** -- renders section header "Key Observations" plus cards in a `space-y-2` container. Returns `null` when observations array is empty.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| `Intl.DisplayNames` for country names | Built-in browser API, no custom lookup table needed |
| `== null` checks instead of `!value` | Handles both null and undefined while allowing 0 as valid |
| Separate magnitude formulas per type | Each detector normalizes differently for fair cross-type ranking |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx tsc --noEmit` passes with no errors
- `generateObservations`, `Observation`, `ObservationType` exported from observation-engine.ts
- `ObservationCard` exported from observation-card.tsx
- `ObservationList` exported from observation-list.tsx
- ObservationList returns null for empty array (confirmed via grep)

## Commits

| Hash | Message |
|------|---------|
| a464965 | feat(31-01): create observation engine with 4 pattern detectors |
| 964827b | feat(31-01): create observation card and list components |

## Next Phase Readiness

The observation engine and card components are ready for integration into the brand detail page (31-02). The `generateObservations` function accepts `TrackedBrandSnapshot` and `HookGroupDisplay[]` which are already available on the brand detail page. Integration requires calling `generateObservations` in a `useMemo` and rendering `ObservationList` in the page layout.
