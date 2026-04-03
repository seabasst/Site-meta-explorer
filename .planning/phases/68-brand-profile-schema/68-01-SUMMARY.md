# Phase 68 Plan 01: Prisma Schema & CRUD Summary

**One-liner:** BrandProfile + BrandCompetitor Prisma models with full CRUD REST API, zod validation, ownership enforcement, and active profile toggling.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Prisma schema - BrandProfile + BrandCompetitor models | 95018ca | prisma/schema.prisma, src/lib/brand-profile-types.ts |
| 2 | CRUD API routes for brand profiles and competitor linking | ed43466 | src/app/api/brand-profiles/route.ts, src/app/api/brand-profiles/[id]/route.ts, src/app/api/brand-profiles/[id]/competitors/route.ts |

## What Was Built

### Prisma Models
- **BrandProfile**: Multi-profile per user model with voice, positioning, audience, visual identity fields. Indexed on userId and userId+isActive.
- **BrandCompetitor**: Links BrandProfile to existing AdLibraryBrand with unique constraint on (profileId, adLibraryBrandId).
- Relations added to User (brandProfiles[]) and AdLibraryBrand (competitorOf[]).
- BrandGuidelines model preserved as-is for future soft migration.

### TypeScript Types
- `BrandProfileFull` - complete profile with nested competitor + brand data
- `BrandProfileCreate` - creation payload (name required)
- `BrandProfileUpdate` - partial update payload
- `BrandCompetitorWithBrand` - competitor with AdLibraryBrand info
- `ReferenceImage` - R2 image reference type

### API Endpoints (all require auth)
- **GET /api/brand-profiles** - List user's profiles (sorted by updatedAt desc)
- **POST /api/brand-profiles** - Create profile (first auto-activated)
- **GET /api/brand-profiles/[id]** - Get single profile with competitors
- **PUT /api/brand-profiles/[id]** - Update profile (active toggle deactivates others)
- **DELETE /api/brand-profiles/[id]** - Delete profile (reassigns active if needed)
- **POST /api/brand-profiles/[id]/competitors** - Link competitor (max 10, validates brand exists)
- **DELETE /api/brand-profiles/[id]/competitors** - Unlink competitor

## Files Created

- `src/lib/brand-profile-types.ts`
- `src/app/api/brand-profiles/route.ts`
- `src/app/api/brand-profiles/[id]/route.ts`
- `src/app/api/brand-profiles/[id]/competitors/route.ts`

## Files Modified

- `prisma/schema.prisma` - Added BrandProfile, BrandCompetitor models + relations

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| 409 Conflict for duplicate competitor links | Better than 400 - semantically correct for "already exists" |
| Competitor delete verifies profileId match | Defense in depth - prevents cross-profile competitor deletion |
| Next.js 16 async params pattern used | `context.params` returns Promise in Next.js 16 route handlers |

## Duration

~3 minutes (181 seconds)
