---
phase: 12
plan: 03
subsystem: tier-enforcement
tags: [tier, ui, depth-selector, pro-badge]
depends_on:
  - 12-01 (tier configuration and useTierAccess hook)
provides:
  - ProBadge component for tier indication
  - tier-aware DepthSelector component
  - cleaned up page.tsx without PricingModal
affects:
  - 12-04+ (any future tier UI components)
  - user experience for depth selection
tech-stack:
  added: []
  patterns:
    - composable tier UI components
    - checkout flow integration via useTransition
key-files:
  created:
    - src/components/tier/pro-badge.tsx
    - src/components/tier/depth-selector.tsx
  modified:
    - src/app/page.tsx
decisions:
  - DepthSelector triggers sign-in for unauthenticated locked clicks
  - DepthSelector triggers checkout for authenticated free users
  - Removed PricingModal in favor of direct Stripe checkout
  - Three depth options: 100 (free), 500 (pro), 1000 (pro)
metrics:
  duration: ~3min
  completed: 2026-01-27
---

# Phase 12 Plan 03: Tier UI Components Summary

Tier-aware UI components with Pro badges and upgrade flow integration.

## What Was Built

### 1. ProBadge Component (`src/components/tier/pro-badge.tsx`)

Simple gradient badge component for Pro tier indication:

```typescript
interface ProBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}
```

Features:
- Two sizes: `sm` (10px) for inline use, `md` (12px) for larger contexts
- Gradient styling matching existing subscription-status.tsx
- Reusable across any tier-gated feature

### 2. DepthSelector Component (`src/components/tier/depth-selector.tsx`)

Tier-aware depth selector with integrated upgrade flow:

```typescript
interface DepthSelectorProps {
  value: number;
  onChange: (depth: number) => void;
  disabled?: boolean;
}
```

Features:
- Uses `useTierAccess` hook to check depth permissions
- Shows ProBadge on locked options (500, 1K)
- Three options: 100, 500, 1K (vs old 100, 250, 500, 1000, Enterprise)
- Click handling:
  - If unlocked: calls `onChange` with depth
  - If locked + not signed in: redirects to sign-in
  - If locked + signed in free: starts Stripe checkout
- Uses `useTransition` for loading state during checkout

### 3. Page.tsx Integration

Replaced ~220 lines of pricing modal code with DepthSelector:

**Removed:**
- `PRICING_TIERS` constant (50+ lines)
- `PricingModal` component (100+ lines)
- `showPricingModal` and `selectedPricingTier` state
- Pricing modal render block
- Inline depth buttons with pricing labels
- Unused `UpgradeButton` import

**Added:**
- `DepthSelector` import
- Single `<DepthSelector>` component in Options section

## Commits

| Commit | Description |
|--------|-------------|
| 58af340 | feat(12-03): create ProBadge component |
| db1884f | feat(12-03): create tier-aware DepthSelector component |
| 86c9939 | feat(12-03): integrate DepthSelector and remove PricingModal |

## Verification

- [x] `npm run build` succeeds
- [x] ProBadge component renders gradient badge (sm/md sizes)
- [x] DepthSelector shows Pro badges on 500/1K for free users
- [x] Clicking locked depth triggers checkout (or sign in)
- [x] PricingModal and PRICING_TIERS removed from page.tsx
- [x] All key_links verified (imports between components)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Ready for next plans:** The tier UI foundation is complete. Next plans can:
- Add tier indicators to other features
- Use DepthSelector pattern for other tier-gated selections
- Import ProBadge for any Pro-only feature indicators

**User experience flow:**
1. Free user sees 100 available, 500/1K locked with Pro badges
2. Click on locked option:
   - Not signed in: redirects to sign-in page
   - Signed in: redirects to Stripe checkout
3. After Pro subscription: all depths available
