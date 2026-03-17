# Phase 38: Bug Fixes - Research

**Researched:** 2026-03-17
**Domain:** Next.js app bug investigation (auth, routing, API error handling)
**Confidence:** HIGH

## Summary

This phase addresses four bugs across the v2 dashboard. After investigating the actual source code, each bug has been traced to its root cause. Importantly, only FIX-01 has a genuine architectural gap (missing auth-awareness in the Saved Ads page UI). FIX-02 and FIX-03 are likely NOT routing bugs but rather a misunderstanding of the existing link structure -- brand cards link to `/dashboard/v2/ad-library/${pageId}` which is a nonexistent route (no `[pageId]` dynamic segment exists under `v2/ad-library/`). FIX-04 was partially fixed in commit `5a1bbd2` but the frontend still silently swallows demographics failures.

**Primary recommendation:** Fix the missing dynamic route for brand detail, add auth-awareness to the Saved Ads page, and add user-visible error states for demographics failures.

## Bug Analysis: Root Causes and Fixes

### FIX-01: Saved Ads Auth

**Confidence:** HIGH -- fully traced through code

**Current Implementation:**
- API routes (`/api/ad-library/saved`) correctly require auth via `auth()` session check
- API returns 401 when unauthenticated
- Save/check endpoints work correctly with `SavedAd` model (userId + adId composite unique)
- Ad Library page (`v2/ad-library/page.tsx`) has a login modal that shows when unauthenticated user tries to save
- The `toggleSaveAd` callback checks `session?.user` and shows login modal if missing

**The Bug:**
The Saved Ads listing page (`v2/saved/page.tsx`) does NOT check auth state at all. It:
1. Calls `GET /api/ad-library/saved` which returns 401
2. The `res.ok` check silently fails
3. User sees "No saved ads yet" with no indication they need to sign in

**Root Cause:** Missing auth awareness in the Saved Ads page component. The page should detect unauthenticated state and show a "Sign in to view your saved ads" message instead of the empty state.

**Fix Required:**
1. Add `useSession()` hook to `SavedAdsPage`
2. When `!session?.user`, show an auth prompt (similar to the login modal in ad-library page)
3. The API layer is already correct -- no backend changes needed

**Files to Change:**
- `src/app/dashboard/v2/saved/page.tsx` -- add auth check and fallback UI

### FIX-02: Brand Detail 404s

**Confidence:** HIGH -- fully traced through code

**Current Implementation:**
- Brand cards in multiple places link to `/dashboard/v2/ad-library/${brand.pageId}`
  - `v2/brands/page.tsx` line 330: `href={/dashboard/v2/ad-library/${brand.pageId}}`
  - `v2/ad-library/page.tsx` line 888: `href={/dashboard/v2/ad-library/${ad.brand.pageId}}`
  - `v2/saved/page.tsx` line 247: `href={/dashboard/v2/ad-library/${ad.brand.pageId}}`
- But the file system only has: `src/app/dashboard/v2/ad-library/page.tsx`
- There is NO `src/app/dashboard/v2/ad-library/[pageId]/page.tsx` dynamic route

**Root Cause:** The dynamic route `[pageId]` does not exist under the v2 ad-library folder. The v1 dashboard has `src/app/dashboard/ad-library/[pageId]/page.tsx` but v2 never got this page created.

**The API exists:** `/api/ad-library/brands/[pageId]/route.ts` is fully implemented and returns brand details with paginated ads. The missing piece is the v2 frontend page.

**Fix Required:**
1. Create `src/app/dashboard/v2/ad-library/[pageId]/page.tsx` -- a brand detail page
2. It should fetch from `/api/ad-library/brands/${pageId}` (API already exists and works)
3. Display brand info header + paginated ad grid (can reuse AdCard pattern from ad-library page)

**Files to Create:**
- `src/app/dashboard/v2/ad-library/[pageId]/page.tsx`

**Files for Reference:**
- `src/app/api/ad-library/brands/[pageId]/route.ts` -- the existing API
- `src/app/dashboard/v2/ad-library/page.tsx` -- for AdCard and UI patterns to reuse

### FIX-03: Category Detail 404s

**Confidence:** HIGH -- fully traced through code

**Current Implementation:**
- Category list page links to `/dashboard/v2/categories/${cat.slug}` (line 134)
- The dynamic route `src/app/dashboard/v2/categories/[slug]/page.tsx` EXISTS
- The API route `src/app/api/categories/[slug]/route.ts` EXISTS and works
- The category detail page fetches from `/api/categories/${slug}` and displays data

**NOT a routing bug.** The dynamic route and API both exist. The 404 issue is likely one of:

1. **Category slug mismatch:** The categories API returns `slug` as the raw `category` field from the database (e.g., "fashion", "airline"). The detail API queries with `category: { equals: slug, mode: 'insensitive' }`. If a brand has category "Fashion" (capital F), the listing returns slug "Fashion" but the detail looks for an exact match. However, `mode: 'insensitive'` should handle this.

2. **Empty category returns 404:** The detail API returns 404 when `brands.length === 0`. If the category listing filters to only show categories with `brandsIngested > 0` but the detail page counts ALL brands, a race condition or data change could cause this.

3. **The real issue:** The categories listing API filters: `stats.brandsIngested > 0`. But the detail API queries `where: { category: { equals: slug, mode: 'insensitive' } }` with no ingestion filter. If categories show up in the list but their brands have no ads yet, the detail page would still find brands and show them. This path seems fine.

**Most Likely Root Cause:** Investigate whether the slug in the URL matches what the database stores. The listing API uses `brand.category!` directly as the slug, and the detail API searches for `category: { equals: slug }`. If categories contain spaces or special characters (e.g., "car_rental" vs "Car Rental"), the URL encoding could cause a mismatch.

**Fix Required:**
1. Normalize category slugs consistently (lowercase, underscores) in both the listing and detail APIs
2. Add a user-friendly "Category not found" state (already exists in the UI but may need improvement)
3. Test with actual data to confirm the exact mismatch

**Files to Change:**
- `src/app/api/categories/route.ts` -- ensure slug normalization
- `src/app/api/categories/[slug]/route.ts` -- ensure matching normalization
- Possibly: `src/app/dashboard/v2/categories/[slug]/page.tsx` -- better error state

### FIX-04: Demographics Fallback

**Confidence:** HIGH -- fully traced through code

**Current Implementation:**
- The v1 homepage (`src/app/page.tsx`) calls `/api/facebook-ads` to get brand data
- The API checks for stored demographics in `brand.demographicsJson`
- If no stored demographics, it tries to fetch live from Facebook API using `fetchDemographicsOnly()`
- `getAccessToken()` resolves tokens by checking `FACEBOOK_ACCESS_TOKEN1` through `FACEBOOK_ACCESS_TOKEN10`, then `FACEBOOK_ACCESS_TOKEN`
- The recent fix (commit `5a1bbd2`) fixed a typo where `FACEBOOK_ACCESS_TOKEN11` was hardcoded instead of using `getAccessToken()`

**Remaining Bug:**
When tokens are expired, `fetchDemographicsOnly()` catches the error and returns `null`. The API then returns data without `aggregatedDemographics`. On the frontend:
1. The v1 page checks `apiResult.aggregatedDemographics` and shows a generic "No demographic data available" box
2. But this message does NOT tell the user WHY (token expired vs. no data exists)
3. There is no distinction between "demographics unavailable because of API error" vs "this brand genuinely has no demographics"

**What "user-visible error state" means:**
The API should communicate whether demographics failed due to token issues vs. simply being unavailable. The frontend should show a specific message like "Demographics temporarily unavailable - Facebook access token expired" rather than the generic "no data" message.

**Fix Required:**
1. In `/api/facebook-ads/route.ts`: Add a `demographicsError` field to the response when the fallback fails (distinguish token-expired from no-data)
2. In the v1 page (`src/app/page.tsx`): Check for `demographicsError` and show a user-friendly error state with specific messaging
3. In the ingestion cron (`/api/ad-library/cron/ingest/route.ts`): The token manager already handles expired tokens well -- no changes needed there

**Files to Change:**
- `src/app/api/facebook-ads/route.ts` -- add `demographicsError` field to response
- `src/app/page.tsx` -- show specific error message for token expiry
- Possibly: `src/components/demographics/demographics-summary.tsx` -- new error state component

## Architecture Patterns

### Recommended Approach
All four bugs follow a consistent pattern: small, targeted changes to existing files. No new libraries or architectural changes needed.

### Pattern 1: Auth-Aware Page Component
**What:** Client components that show different UI based on session state
**When to use:** Any page that requires or benefits from authentication
**Example:**
```typescript
// Already used in v2/ad-library/page.tsx
const { data: session } = useSession();

// Show auth prompt when needed
if (!session?.user) {
  return <AuthPrompt message="Sign in to view your saved ads" />;
}
```

### Pattern 2: API Error Propagation
**What:** API returns structured error context alongside data
**When to use:** When frontend needs to distinguish error types
**Example:**
```typescript
// API response with error context
return NextResponse.json({
  ...localData.result,
  source: 'local',
  demographicsError: 'token_expired', // or null if no error
});
```

### Pattern 3: Dynamic Route Page (Next.js App Router)
**What:** `[param]/page.tsx` for detail views
**When to use:** Brand detail, category detail, etc.
**Example:**
```typescript
// src/app/dashboard/v2/ad-library/[pageId]/page.tsx
'use client';
import { useParams } from 'next/navigation';

export default function BrandDetailPage() {
  const { pageId } = useParams();
  // Fetch from /api/ad-library/brands/${pageId}
}
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth state in client | Custom auth context | `useSession()` from next-auth | Already used throughout the app |
| URL slug normalization | Custom slug logic | Consistent lowercase + underscore in both API endpoints | Simpler than a library |
| Error state UI | New component library | Existing `V2Card` + `V2Shell` patterns | Maintain visual consistency |

## Common Pitfalls

### Pitfall 1: Testing Auth Flows Without Demo Credentials
**What goes wrong:** Saved ads feature can't be tested without signing in
**How to avoid:** Use demo credentials: `demo@example.com` / `demo123`. The login modal in the ad-library page already pre-fills these.

### Pitfall 2: Brand Detail Page Breaking the Shell Layout
**What goes wrong:** New pages under v2 must use the V2Shell layout
**How to avoid:** Always wrap page content in `<V2Shell title="...">`. The layout at `v2/layout.tsx` provides the context, but each page renders its own shell.

### Pitfall 3: BigInt Serialization
**What goes wrong:** Prisma returns `BigInt` for `totalReach`, which can't be JSON.stringify'd
**How to avoid:** The existing brand detail API already has `serializeBrand()` that converts BigInt to string. Use this pattern for any new code that touches `totalReach`.

### Pitfall 4: Category Slug Case Sensitivity
**What goes wrong:** Category stored as "Fashion" in DB, but URL has "Fashion" or "fashion"
**How to avoid:** Always normalize to lowercase before comparison. The detail API already uses `mode: 'insensitive'` but the listing API should normalize the slug it outputs.

## File Map (All Files Involved)

### FIX-01
- `src/app/dashboard/v2/saved/page.tsx` (MODIFY - add auth check)

### FIX-02
- `src/app/dashboard/v2/ad-library/[pageId]/page.tsx` (CREATE - new brand detail page)
- `src/app/api/ad-library/brands/[pageId]/route.ts` (REFERENCE - existing API, no changes)

### FIX-03
- `src/app/api/categories/route.ts` (MODIFY - normalize slug output)
- `src/app/api/categories/[slug]/route.ts` (VERIFY - ensure case-insensitive match works)
- `src/app/dashboard/v2/categories/[slug]/page.tsx` (POSSIBLY MODIFY - better error state)

### FIX-04
- `src/app/api/facebook-ads/route.ts` (MODIFY - add demographicsError to response)
- `src/app/page.tsx` (MODIFY - show specific error for token expiry)

## Open Questions

1. **Category 404s need live testing:** The route structure looks correct. The 404 may only reproduce with specific category values in the database. Need to verify with actual data which categories are 404ing.
   - Recommendation: Add console logging to the category detail API to capture the exact slug being queried, then compare against database values.

2. **Token expiry detection on v2 dashboard:** The demographics fallback is only used in the v1 page (`/`). The v2 dashboard (`/dashboard/v2/`) uses pre-ingested data from the database. FIX-04 only affects the v1 entry point.
   - Recommendation: Confirm with product owner whether v2 also needs a demographics error state, or if FIX-04 is v1-only.

3. **Brand detail page scope:** Creating the `[pageId]` page under v2/ad-library is potentially a mini-feature, not just a bug fix. It needs brand header, ad grid, pagination, and possibly filters.
   - Recommendation: Start with a minimal version (brand info + ad grid) and iterate later.

## Sources

### Primary (HIGH confidence)
- Direct source code inspection of all files listed above
- Git history: commit `5a1bbd2` (demographics fallback fix), commit `978ba44` (login modal for saves)
- Prisma schema: `prisma/schema.prisma` (SavedAd, MonitoredBrand, AdLibraryBrand models)

### File System Analysis (HIGH confidence)
- Confirmed no `[pageId]` route exists under `src/app/dashboard/v2/ad-library/`
- Confirmed `[slug]` route DOES exist under `src/app/dashboard/v2/categories/`

## Metadata

**Confidence breakdown:**
- FIX-01 (Saved Ads auth): HIGH - root cause confirmed, fix is straightforward
- FIX-02 (Brand 404s): HIGH - missing route confirmed, API exists
- FIX-03 (Category 404s): MEDIUM - route exists, root cause needs live verification
- FIX-04 (Demographics): HIGH - code path traced, frontend gap identified

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable codebase, no external dependencies changing)
