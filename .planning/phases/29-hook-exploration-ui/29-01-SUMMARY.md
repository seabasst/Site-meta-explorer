---
phase: 29-hook-exploration-ui
plan: 01
subsystem: api
tags: [hooks, api, prisma, bigint, auth]
dependency-graph:
  requires: [28-hook-extraction-engine]
  provides: [GET /api/dashboard/hooks endpoint]
  affects: [29-02-hook-ui-components]
tech-stack:
  added: []
  patterns: [BigInt serialization, ownership-via-userId]
key-files:
  created:
    - src/app/api/dashboard/hooks/route.ts
  modified: []
decisions:
  - id: hooks-ownership-simple
    choice: "Direct userId check on BrandSnapshot (no OR/nested query)"
    reason: "BrandSnapshot has direct userId field, simpler than TrackedBrand ownership"
metrics:
  duration: "35s"
  completed: "2026-02-02"
---

# Phase 29 Plan 01: Hooks API Endpoint Summary

**GET /api/dashboard/hooks?snapshotId=XXX returning hook groups sorted by totalReach descending with BigInt-to-Number serialization**

## What Was Done

### Task 1: Create GET /api/dashboard/hooks endpoint
- **Commit:** c19fed7
- **File:** `src/app/api/dashboard/hooks/route.ts`
- Created read-only GET endpoint following the exact patterns from `snapshots/route.ts`
- Auth check via `auth()` returning 401 for unauthenticated requests
- snapshotId query param validation returning 400 if missing
- Ownership verification via `brandSnapshot.findFirst` with `userId` check, returning 404
- Hook groups fetched via `hookGroup.findMany` with `orderBy: { totalReach: 'desc' }` leveraging the `@@index([snapshotId, totalReach])` composite index
- BigInt serialization using JSON.parse/JSON.stringify replacer pattern

## Verification

- `npx tsc --noEmit` passes with no errors
- `npm run build` succeeds, route listed as `/api/dashboard/hooks`
- Route follows same auth/serialization patterns as snapshots/route.ts

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Plan 02 (Hook UI Components) can now consume `GET /api/dashboard/hooks?snapshotId=XXX` to render hook exploration UI.
