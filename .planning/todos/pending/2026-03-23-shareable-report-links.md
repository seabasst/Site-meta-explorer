---
created: 2026-03-23T00:00
title: Shareable report links
area: ui
files:
  - src/app/dashboard/v2/creative-lab/page.tsx
  - src/app/dashboard/v2/creative-lab/benchmark-comparison.tsx
---

## Problem

Users need to share creative analysis/benchmark reports with teammates or clients via a direct URL. Currently reports are only viewable within the logged-in dashboard session — there's no way to generate a permalink that opens the actual rendered report (not a PDF export).

This is a v1 requirement: the shared link should lead to the live rendered report page, not a static document.

## Solution

TBD — likely involves:
- Public/shareable route for reports (e.g. `/report/:id`)
- Report state persistence (which brand, category, analysis data) so the URL reconstructs the view
- Optional: access control (public link vs auth-required)
