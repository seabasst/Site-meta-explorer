---
phase: 45-v1-theme-update
plan: 01
subsystem: frontend-theme
tags: [css, design-system, color-palette, typography, spacing]
dependency-graph:
  requires: [44-navigation-brand-identity]
  provides: [v1-blue-theme, unified-design-system]
  affects: []
tech-stack:
  added: []
  patterns: ["CSS custom properties for theme tokens", "direct hex values in Tailwind arbitrary values"]
key-files:
  created: []
  modified:
    - src/app/globals.css
    - src/app/analyser/page.tsx
decisions:
  - id: "45-01-D1"
    choice: "Direct hex values (#1235e2) in Tailwind classes instead of CSS var references"
    reason: "Cleaner than adding new var() indirection; V2 already uses direct hex"
  - id: "45-01-D2"
    choice: "Preserve --accent-green CSS vars for backward compat"
    reason: "Other pages (coming-soon, auth, dashboard v1) still reference them"
  - id: "45-01-D3"
    choice: "Amber warning boxes keep rounded-xl"
    reason: "Intentionally distinct radius differentiates system alerts from content cards"
metrics:
  duration: "4m"
  completed: "2026-03-18"
---

# Phase 45 Plan 01: V1 Theme Update Summary

**Blue accent palette (#1235e2) replaces green across V1 analyser, with rounded-lg cards, rounded-full pills, and smooth surface transitions**

## What Was Done

### Task 1: CSS Variables and Utility Classes (298b841)

Added new `--accent-blue` (#1235e2), `--accent-blue-light` (#3a5ce8), and `--accent-blue-dark` (#0f2bc0) CSS custom properties to `:root`. Updated utility classes:

- `.btn-primary` background from `var(--accent-green)` to `#1235e2`
- `.btn-primary:hover` to `#3a5ce8` with blue-tinted shadow
- `.input-field:focus` border and shadow to blue
- `.spinner` border-top to blue
- `.glow-gold`, `.glow-gold-sm`, `.glass` box-shadows to blue-tinted rgba values

Old `--accent-green` and `--accent-green-light` vars preserved for pages outside the V1 analyser.

### Task 2: Analyser Page Color, Typography, Spacing, Transitions (44c0224)

**THEME-01 (Color):** Replaced all 39 green/emerald accent references with `#1235e2` blue family. LoadingSpinner, ActiveChartFilter, hero heading, toggle buttons, date inputs, example brands, comparison panel, export button, format filters, tab navigation, section headings, chart highlights, ad links -- all now use blue.

**THEME-02 (Typography):** Verified existing scale is aligned -- serif italic section headings, text-sm/text-xs labels, text-base body text. No changes needed.

**THEME-03 (Spacing/Radii):** Changed form card, comparison panel, analysis results, all glass sections, tooltip, comparison input, and upgrade card from `rounded-2xl`/`rounded-xl` to `rounded-lg`. Amber warning boxes at lines 1250/1261 intentionally retain `rounded-xl`.

**THEME-04 (Transitions):** Added `transition-colors duration-200` to `<main>` element for smooth background color transitions.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

| Check | Result |
|-------|--------|
| `accent-green` in page.tsx | 0 matches |
| `emerald` in page.tsx | 0 matches |
| `#1235e2` in page.tsx | 39 matches |
| `rounded-xl` in page.tsx | 2 matches (amber warnings only) |
| `transition-colors duration-200` | Present on main element |
| `--accent-green` in globals.css | Preserved (2 vars) |
| `--accent-blue` in globals.css | Present (#1235e2) |
| `--accent-blue-light` in globals.css | Present (#3a5ce8) |
| `--accent-blue-dark` in globals.css | Present (#0f2bc0) |
| page.tsx line count | 1588 (above 1500 minimum) |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 298b841 | style(45-01): update CSS variables and utility classes from green to blue |
| 2 | 44c0224 | feat(45-01): update analyser page colors, spacing, and transitions |
