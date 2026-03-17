# Phase 42 Plan 01: Route Prep and Stripe Fix Summary

**One-liner:** Moved V1 Ad Analyser to /analyser route and fixed Stripe checkout redirects to /dashboard/v2.

## What Was Done

### Task 1: Move V1 Ad Analyser to /analyser route
- Moved `src/app/page.tsx` to `src/app/analyser/page.tsx` via `git mv`
- Updated `src/app/coming-soon/page.tsx` links: "Back to Analyser" and "Try the free analyser" now point to `/analyser`
- Logo link in V1 page kept as `/` (will point to future landing page)
- Root `/` route is now clear for landing page (Plan 02)
- **Commit:** `0a77599`

### Task 2: Fix Stripe checkout redirect URLs
- Updated `success_url` to `/dashboard/v2?upgrade=success`
- Updated `cancel_url` to `/dashboard/v2?upgrade=cancelled`
- Updated portal `return_url` to `/dashboard/v2`
- **Commit:** `fcd8579`

## Verification

- Build (`npm run build`) passes with no errors
- `src/app/analyser/page.tsx` exists with full V1 component
- `src/app/page.tsx` does NOT exist (root route free)
- `src/app/actions/stripe.ts` contains `/dashboard/v2` in all three redirect URLs
- Type check (`npx tsc --noEmit`) passes clean

## Deviations from Plan

None -- plan executed exactly as written.

## Key Files

**Created:**
- `src/app/analyser/page.tsx` (moved from `src/app/page.tsx`)

**Modified:**
- `src/app/coming-soon/page.tsx` (updated 3 links from `/` to `/analyser`)
- `src/app/actions/stripe.ts` (updated 3 redirect URLs to `/dashboard/v2`)

## Decisions Made

- LANDING-01: V1 Ad Analyser moved to /analyser, root route cleared for landing page

## Next Phase Readiness

Plan 42-02 can proceed -- the `/` route has no `page.tsx` and is ready for the new landing page.
