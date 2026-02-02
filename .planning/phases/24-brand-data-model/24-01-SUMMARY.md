# Phase 24 Plan 01: Save Brand Endpoint + Button Summary

**One-liner:** POST /api/brands/save with transactional TrackedBrand + BrandSnapshot creation, plus emerald Save Brand button in results header with saved state.

## What Was Done

### Task 1: Create POST /api/brands/save endpoint
- **Commit:** e656c60
- **File created:** `src/app/api/brands/save/route.ts`
- Auth check (401), body validation (400), tier limit enforcement (403, free: 3 / pro: 10), duplicate check (409)
- Creates TrackedBrand + BrandSnapshot atomically via `prisma.$transaction`
- Converts `totalReach` to BigInt, handles null JSON fields with `Prisma.JsonNull`
- Follows exact pattern from competitors/route.ts for consistency

### Task 2: Add Save Brand button and handler to analysis page
- **Commit:** e12b5ed
- **File modified:** `src/app/page.tsx`
- Added `buildSnapshotFromApiResult` import from snapshot-builder
- Added `saving` / `brandSaved` state variables
- `handleSaveBrand` constructs snapshot from apiResult, sends to /api/brands/save
- Emerald-styled button in results header (before Export dropdown), shown only for authenticated users
- "Saved" state with checkmark after success, resets on new analysis
- Error toast for duplicates ("Brand already saved") and tier limits

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use trackerId (not ownerId) for brand ownership | Composite unique constraint supports duplicate detection; 1:many relation for multiple brands |
| Convert totalReach to Number for JSON, back to BigInt on server | BigInt not JSON-serializable; Number safe for reach values |
| Emerald color scheme for Save button | Distinguishes from existing gray action buttons; consistent with comparison "Saved" state |
| Button hidden for unauthenticated users | Brand saving requires auth; avoids confusing UX |

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes with no errors after both tasks
- Route file at correct Next.js App Router path for POST /api/brands/save

## Key Files

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/brands/save/route.ts` | Created | POST endpoint for saving brand + snapshot |
| `src/app/page.tsx` | Modified | Save Brand button + handleSaveBrand handler |

## Duration

~3 minutes
