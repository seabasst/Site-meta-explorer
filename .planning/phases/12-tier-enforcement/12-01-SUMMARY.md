---
phase: 12
plan: 01
subsystem: tier-enforcement
tags: [tier, subscription, hook, api]
depends_on:
  - 11-03 (subscription status infrastructure)
  - 11-04 (subscription status API)
provides:
  - centralized tier configuration
  - client-side tier access hook
  - enhanced subscription status API with tier info
affects:
  - 12-02 (depth selector will use useTierAccess)
  - 12-03 (API enforcement will use tier helpers)
  - 13-xx (feature gating will use tier config)
tech-stack:
  added: []
  patterns:
    - centralized tier constants (TIERS object)
    - status-to-tier mapping (getTierFromStatus)
    - client-side tier hook (useTierAccess)
key-files:
  created:
    - src/lib/tiers.ts
    - src/hooks/use-tier-access.ts
  modified:
    - src/app/api/subscription/status/route.ts
decisions:
  - past_due users get grace period (treated as pro)
  - unauthenticated users get free tier info (not 401)
  - two-tier model: free (100 ads) vs pro (100/500/1000 ads)
metrics:
  duration: ~3min
  completed: 2026-01-27
---

# Phase 12 Plan 01: Tier Configuration Foundation Summary

Centralized tier configuration with helpers and client-side hook for tier checking.

## What Was Built

### 1. Tier Configuration File (`src/lib/tiers.ts`)

Created centralized tier configuration with:

- `TierName` type: `'free' | 'pro'`
- `TierConfig` interface with name, label, maxAds, availableDepths, and features
- `TIERS` constant with full configuration for both tiers
- `getTierFromStatus()`: Maps subscription status to tier (past_due = pro for grace period)
- `isDepthAllowed()`: Validates if a depth is available for a tier
- `getMaxDepth()`: Returns maximum allowed ads for a tier

Key design decisions:
- past_due users treated as pro (grace period)
- Features object for future Phase 13 gating (export, previews, deepAnalysis)
- Readonly arrays for type safety

### 2. Client-Side Tier Hook (`src/hooks/use-tier-access.ts`)

Created `useTierAccess` hook following existing hook patterns:

```typescript
interface TierAccess {
  tier: TierName;        // 'free' | 'pro'
  config: TierConfig;    // Full tier configuration
  isPro: boolean;        // Convenience boolean
  isLoading: boolean;    // Auth + subscription loading
  canUseDepth: (depth: number) => boolean;  // Check if depth allowed
}
```

Features:
- Handles auth loading state
- Fetches subscription status from API
- Falls back to free tier on errors
- Follows use-favorites.ts pattern for consistency

### 3. Enhanced Subscription Status API

Modified `/api/subscription/status` to return tier info:

Before:
```json
{"status":"unauthenticated"}  // 401
```

After:
```json
{
  "status": "unauthenticated",
  "tier": "free",
  "maxAds": 100,
  "availableDepths": [100]
}
```

Key changes:
- Unauthenticated users get 200 with free tier info (not 401)
- Returns tier name and limits alongside status
- Consistent with useTierAccess hook expectations

## Commits

| Commit | Description |
|--------|-------------|
| 1c19c9a | feat(12-01): create tier configuration file |
| 36e4c2e | feat(12-01): create useTierAccess hook |
| 1a1eefe | feat(12-01): enhance subscription status API with tier info |

## Verification

- [x] `npx tsc --noEmit` passes
- [x] `npm run build` succeeds
- [x] API returns tier info for unauthenticated users

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for 12-02:** The tier infrastructure is complete. Next plan can:
- Import `useTierAccess` hook in depth selector component
- Use `canUseDepth()` to show/hide Pro badges
- Use `config.availableDepths` for rendering options

**Integration points:**
- `useTierAccess` fetches from `/api/subscription/status`
- API uses `getTierFromStatus` from `src/lib/tiers.ts`
- Both use same `TIERS` constant for consistency
