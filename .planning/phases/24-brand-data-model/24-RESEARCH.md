# Phase 24: Brand Data Model & Storage - Research

**Researched:** 2026-02-02
**Domain:** Prisma schema extension, Next.js API routes, React UI integration
**Confidence:** HIGH

## Summary

Phase 24 adds a "Save Brand" button to the analysis results page that creates a `TrackedBrand` + initial `BrandSnapshot` in a single operation. The codebase already has the complete data model (`TrackedBrand`, `BrandSnapshot`), the snapshot builder (`buildSnapshotFromApiResult`), the API route patterns for brand CRUD, and the auth/subscription infrastructure. No schema changes are needed.

The existing `handleTrackBrand` function in `page.tsx` (line 176) already tracks brands as "own brand" or "competitor" but does NOT create an initial snapshot. The v3.0 "Save Brand" flow should: (1) create the `TrackedBrand` record, (2) immediately create a `BrandSnapshot` from the current `apiResult`, and (3) show success feedback.

**Primary recommendation:** Reuse the existing schema, snapshot builder, and API patterns. The work is a new API endpoint that combines brand creation + snapshot creation, a "Save Brand" button in the results header, and Pro-tier gating.

## Standard Stack

### Core (Already in Codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | (existing) | ORM for TrackedBrand + BrandSnapshot | Already used for all DB operations |
| NextAuth v5 | (existing) | Auth via `auth()` helper | Already used in all API routes |
| Next.js App Router | 16.1.2 | API routes in `src/app/api/` | Existing pattern |
| sonner | (existing) | Toast notifications | Used for all user feedback |

### Supporting (Already in Codebase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/lib/snapshot-builder` | N/A | `buildSnapshotFromApiResult()` | Converting `FacebookApiResult` to snapshot data |
| `@/lib/subscription` | N/A | `getSubscriptionStatus()`, `isPro()` | Pro-tier enforcement |
| `@/lib/facebook-api` | N/A | `FacebookApiResult` type | Type reference for snapshot building |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side snapshot build | Client-side aggregation | Server-side is already proven in `/api/dashboard/snapshots` |
| New Prisma model | Existing TrackedBrand | No new model needed; schema already complete |

**Installation:** No new dependencies needed.

## Architecture Patterns

### Existing Project Structure (Relevant Files)
```
src/
├── app/
│   ├── api/dashboard/
│   │   ├── own-brand/route.ts      # PUT to set own brand (reusable pattern)
│   │   ├── competitors/route.ts    # POST to add competitor (reusable pattern)
│   │   └── snapshots/route.ts      # POST to create snapshot (reuse directly)
│   └── page.tsx                    # Main analysis page (add Save Brand button)
├── lib/
│   ├── snapshot-builder.ts         # buildSnapshotFromApiResult() (reuse directly)
│   ├── subscription.ts             # isPro(), getSubscriptionStatus()
│   ├── facebook-api.ts             # FacebookApiResult type
│   └── prisma.ts                   # Prisma client singleton
└── components/
    └── tier/
        └── feature-gate.tsx        # FeatureGate component (currently all-open)
```

### Pattern 1: Brand Save API Endpoint
**What:** A single API endpoint that creates TrackedBrand + BrandSnapshot in one request
**When to use:** When user clicks "Save Brand" after analysis
**Why:** The existing flow creates brand and snapshot separately. For v3.0, the user expects a single "save" action that persists both the brand identity and current analysis snapshot.

```typescript
// POST /api/brands/save
// Combines: TrackedBrand creation + BrandSnapshot creation
// Auth: requires session
// Tier: requires Pro (or free access period)
// Input: { facebookPageId, pageName, adLibraryUrl, snapshotData }
// snapshotData built client-side using buildSnapshotFromApiResult
```

### Pattern 2: Existing API Route Pattern
**What:** All API routes follow the same auth/validation/response pattern
**Example from own-brand/route.ts:**
```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
// ... validate body
// ... Prisma operation
return NextResponse.json({ brand });
```

### Pattern 3: Client-Side Brand Tracking (Existing)
**What:** `handleTrackBrand` in `page.tsx` line 176 already handles brand saving
**Current behavior:** Creates TrackedBrand only (no snapshot)
**Needed change:** Also create snapshot from current `apiResult`

### Pattern 4: Snapshot Data Flow
**What:** `buildSnapshotFromApiResult(result)` extracts aggregated metrics from FacebookApiResult
**Already proven:** Used in `/api/dashboard/snapshots/route.ts` line 54
**Key detail:** Snapshot includes scalar metrics (reach, ad counts, dominant demographics) + JSON fields (full demographics, spend by country)

### Anti-Patterns to Avoid
- **Storing raw ad data:** BRAND-02 explicitly says aggregated snapshot only, not raw ads. The `BrandSnapshot` model already enforces this.
- **Creating a new Prisma model:** The `TrackedBrand` + `BrandSnapshot` schema is already complete and in use.
- **Re-fetching from Facebook API on save:** The analysis data is already in client state (`apiResult`). Build snapshot from that, don't re-fetch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Snapshot aggregation | Custom aggregation logic | `buildSnapshotFromApiResult()` | Already handles all metrics, demographics, country breakdowns |
| Auth checking | Custom auth middleware | `auth()` from `@/auth` | Already used in every API route |
| Pro tier checking | Custom tier logic | `getSubscriptionStatus()` / `isPro()` | Already handles all subscription states |
| BigInt serialization | Custom JSON handler | `serializeSnapshot()` from snapshots route | Handles BigInt-to-Number conversion |
| Toast notifications | Custom notification system | `sonner` `toast.success/error` | Already used throughout app |

## Common Pitfalls

### Pitfall 1: Duplicate Brand Saves
**What goes wrong:** User clicks "Save Brand" twice, creating duplicate TrackedBrand records
**Why it happens:** No uniqueness constraint on facebookPageId per user for "saved brands" (only for competitors via `@@unique([trackerId, facebookPageId])`)
**How to avoid:** Use upsert (like own-brand route does) or check for existing brand before creating. The existing `TrackedBrand` model has `ownerId` (unique, 1:1) and `trackerId` (1:many with unique composite). For v3.0 "saved brands", need to decide: are saved brands stored as own-brand, competitors, or a new relation?
**Warning signs:** 409 conflict errors or silent duplicates

### Pitfall 2: Schema Confusion - Own Brand vs Competitors vs Saved Brands
**What goes wrong:** Confusion about where "saved brands" fit in the existing schema
**Why it happens:** The schema has two distinct concepts: `ownerId` (1:1, user's own brand) and `trackerId` (1:many, competitors). "Save Brand" from v3.0 is a third concept.
**How to avoid:** Decision needed: v3.0 "Save Brand" should use the `trackerId` relation (1:many), treating all saved brands as "tracked competitors" even if one is the user's own. The existing competitor flow already supports this. Alternatively, could add a new nullable field to distinguish.
**Recommendation:** Use the existing `trackerId` relation. The competitor route already handles creation, duplicate checking, and tier limits. "Save Brand" = "Add as competitor" with a snapshot.

### Pitfall 3: BigInt Serialization in JSON Response
**What goes wrong:** `totalReach` is a `BigInt` field, which is not JSON-serializable
**Why it happens:** PostgreSQL `BigInt` maps to JS `BigInt`, which throws on `JSON.stringify()`
**How to avoid:** Use the existing `serializeSnapshot()` helper that converts BigInt to Number
**Warning signs:** "TypeError: Do not know how to serialize a BigInt" at runtime

### Pitfall 4: Snapshot Data Built Client-Side vs Server-Side
**What goes wrong:** Passing the full `FacebookApiResult` (with all raw ad data) to the API just to build a snapshot
**Why it happens:** `buildSnapshotFromApiResult` lives in `@/lib/`, importable by both client and server
**How to avoid:** Build snapshot data client-side, send only the aggregated `SnapshotData` to the API. The raw ad data never needs to leave the client for the save operation. OR build it server-side if the API already has the data.
**Recommendation:** Build snapshot client-side using `buildSnapshotFromApiResult(apiResult)`, send the flat snapshot fields to the API. This keeps the request payload small and avoids sending raw ad data.

### Pitfall 5: Free Access Period
**What goes wrong:** Gating "Save Brand" behind Pro when the app is currently in a free access period until March 1st, 2026
**Why it happens:** `isInFreeAccessPeriod()` returns true until 2026-03-01. The `FeatureGate` component currently renders all children unconditionally.
**How to avoid:** Use the same pattern as competitors route: check `getSubscriptionStatus()` and apply tier limits. During free access period, all users effectively have Pro features. The gating should still be in the code so it activates automatically after March 1st.

## Code Examples

### Example 1: Save Brand API Endpoint
```typescript
// src/app/api/brands/save/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getSubscriptionStatus } from '@/lib/subscription';
import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pro-tier check (respects free access period via subscription status)
  const status = await getSubscriptionStatus(session.user.email);
  // During free period all users are effectively 'pro' in the tier system

  const body = await req.json();
  const { facebookPageId, pageName, adLibraryUrl, snapshot } = body;

  if (!facebookPageId || !pageName || !adLibraryUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Check duplicate
  const existing = await prisma.trackedBrand.findUnique({
    where: {
      trackerId_facebookPageId: {
        trackerId: session.user.id,
        facebookPageId,
      },
    },
  });

  if (existing) {
    return NextResponse.json({ error: 'Brand already saved' }, { status: 409 });
  }

  // Tier limit check
  const maxBrands = status === 'pro' || status === 'past_due' ? 10 : 3;
  const count = await prisma.trackedBrand.count({
    where: { trackerId: session.user.id },
  });
  if (count >= maxBrands) {
    return NextResponse.json(
      { error: `Brand limit reached (${maxBrands})` },
      { status: 403 },
    );
  }

  // Create brand + snapshot in transaction
  const brand = await prisma.$transaction(async (tx) => {
    const newBrand = await tx.trackedBrand.create({
      data: {
        facebookPageId,
        pageName,
        adLibraryUrl,
        trackerId: session.user.id,
      },
    });

    if (snapshot) {
      await tx.brandSnapshot.create({
        data: {
          ...snapshot,
          totalReach: BigInt(snapshot.totalReach),
          demographicsJson: snapshot.demographicsJson ?? Prisma.JsonNull,
          spendByCountryJson: snapshot.spendByCountryJson ?? Prisma.JsonNull,
          trackedBrandId: newBrand.id,
          userId: session.user.id,
        },
      });
    }

    return newBrand;
  });

  return NextResponse.json({ brand });
}
```

### Example 2: Client-Side Save Brand Handler
```typescript
// In page.tsx, alongside existing handleTrackBrand
const handleSaveBrand = async () => {
  if (!apiResult || !session) return;
  setSaving(true);
  try {
    const snapshotData = buildSnapshotFromApiResult(apiResult);
    const res = await fetch('/api/brands/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facebookPageId: apiResult.pageId,
        pageName: apiResult.pageName || `Page ${apiResult.pageId}`,
        adLibraryUrl,
        snapshot: {
          ...snapshotData,
          totalReach: Number(snapshotData.totalReach), // BigInt -> Number for JSON
        },
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save brand');
    }
    toast.success('Brand saved!');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : 'Failed to save brand');
  } finally {
    setSaving(false);
  }
};
```

### Example 3: Save Brand Button (Results Header)
```typescript
// In the results header section (around line 946 of page.tsx)
// Add alongside the existing Export, Compare, and Favorite buttons
{session && (
  <button
    type="button"
    data-pdf-hide
    onClick={handleSaveBrand}
    disabled={saving}
    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
  >
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
    {saving ? 'Saving...' : 'Save Brand'}
  </button>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Brand tracking via own-brand/competitor split | Same (still current) | v2.0 | "Save Brand" reuses competitor relation |
| Manual snapshot creation (separate step) | Combined brand+snapshot in one save | v3.0 (this phase) | Better UX - one click saves everything |

**Key insight:** The existing `TrackedBrand` model was designed for the dashboard's own-brand + competitor paradigm. v3.0 "Save Brand" fits naturally into the `trackerId` (competitor) relation since it's 1:many and already has the right fields.

## Open Questions

1. **Own Brand vs Saved Brand distinction**
   - What we know: The schema has `ownerId` (1:1) and `trackerId` (1:many). "Save Brand" is a new concept.
   - What's unclear: Should "Save Brand" use the competitor relation (`trackerId`), or should we add a separate concept?
   - Recommendation: Use `trackerId` relation. It already supports multiple brands per user, has duplicate checking, and tier limits. The dashboard (Phase 25) can present them all as "saved brands" regardless of the relation name.

2. **Page name auto-detection**
   - What we know: `apiResult.pageName` is populated by the Facebook API response. It is available as a `string | null` on `FacebookApiResult`.
   - What's unclear: How reliable is the pageName? Is it always present?
   - Recommendation: Use `apiResult.pageName` with fallback to `Page ${apiResult.pageId}`. This is already the pattern used in the existing `handleTrackBrand` function (line 187).

3. **Save Brand button visibility for non-authenticated users**
   - What we know: The button should only appear for authenticated users. During free access period, all authenticated users have Pro features.
   - Recommendation: Show button for all authenticated users. After March 1st, gate behind Pro subscription using the existing `getSubscriptionStatus()` check.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` - TrackedBrand + BrandSnapshot models already exist
- `src/lib/snapshot-builder.ts` - `buildSnapshotFromApiResult()` function
- `src/app/api/dashboard/snapshots/route.ts` - Snapshot creation pattern
- `src/app/api/dashboard/own-brand/route.ts` - Brand CRUD pattern
- `src/app/api/dashboard/competitors/route.ts` - Competitor CRUD with tier limits
- `src/app/page.tsx` - Analysis results page, existing `handleTrackBrand`
- `src/auth.ts` - NextAuth v5 configuration with JWT sessions
- `src/lib/subscription.ts` - Pro tier enforcement helpers
- `src/lib/tiers.ts` - Free access period logic

### Secondary (MEDIUM confidence)
- None needed - all findings are from codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in the codebase
- Architecture: HIGH - Extending existing patterns with no new dependencies
- Pitfalls: HIGH - Identified from actual code analysis (BigInt, duplicates, schema relations)

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (stable - no external dependencies to change)
