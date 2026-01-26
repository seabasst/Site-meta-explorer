# Phase 12: Tier Enforcement - Research

**Researched:** 2026-01-26
**Domain:** Feature Gating by Subscription Status in Next.js + React
**Confidence:** HIGH

## Summary

This phase implements tier-based feature enforcement: Free users are limited to 100-ad analysis depth, Pro users can select 500 or 1000 ads, and locked features show "Pro" badges with upgrade prompts. The existing codebase already has subscription status infrastructure (from Phase 11) stored in the database and fetched via `/api/subscription/status`.

The implementation follows the **FeatureGate wrapper pattern** where billing logic is separated from component logic. The key insight from SaaS best practices is to **showcase premium features, not hide them** - showing users what they'd unlock drives conversions better than removing UI elements entirely. The enforcement must happen both server-side (API route validates tier before expensive operations) and client-side (UI reflects available options).

**Primary recommendation:** Use a `useTierAccess` hook for client-side tier checking, enforce limits server-side in the `/api/facebook-ads` route before processing, and replace the current depth selector with a tier-aware component showing locked options with "Pro" badges.

## Standard Stack

No new libraries needed. The existing stack fully supports this phase:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | ^5.x | Session management | Already provides user context |
| prisma | ^7.x | Database access | Already stores subscriptionStatus |

### Supporting (Already Available)
| Pattern | Location | Purpose | Reuse |
|---------|----------|---------|-------|
| SubscriptionStatus type | src/lib/subscription.ts | Type definition | Reuse for tier checking |
| getSubscriptionStatus | src/lib/subscription.ts | DB lookup | Reuse in API route |
| isPro | src/lib/subscription.ts | Boolean check | Reuse for feature gates |
| /api/subscription/status | src/app/api/subscription/status/route.ts | Client status fetch | Already used by SubscriptionStatus |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom hook | Feature flag service (LaunchDarkly, PostHog) | Overkill for 2-tier system, adds external dependency |
| Server-side enforcement | Middleware-only | Middleware alone insufficient per CVE-2025-29927; must also check at data access layer |
| Hide locked features | Show with upgrade badges | Hiding reduces conversion; showcasing premium features drives upgrades |

**No installation required** - existing stack is sufficient.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── subscription.ts          # Existing - add tier constants
│   └── tiers.ts                 # NEW - tier configuration & limits
├── hooks/
│   └── use-tier-access.ts       # NEW - client-side tier checking hook
├── components/
│   ├── tier/
│   │   ├── pro-badge.tsx        # NEW - "Pro" badge component
│   │   ├── feature-gate.tsx     # NEW - wrapper for gated features
│   │   └── depth-selector.tsx   # NEW - tier-aware depth selection
│   └── subscription/
│       └── upgrade-button.tsx   # Existing - reuse for upgrade CTAs
├── app/
│   ├── api/
│   │   ├── facebook-ads/
│   │   │   └── route.ts         # MODIFY - add tier enforcement
│   │   └── subscription/
│   │       └── status/
│   │           └── route.ts     # Existing - already returns status
│   └── page.tsx                 # MODIFY - use tier-aware depth selector
```

### Pattern 1: Tier Configuration Constants
**What:** Centralized tier limits and feature access definitions
**When to use:** All tier checks throughout the application
**Example:**
```typescript
// src/lib/tiers.ts
export type TierName = 'free' | 'pro';

export interface TierConfig {
  name: TierName;
  label: string;
  maxAds: number;
  availableDepths: readonly number[];
  features: {
    deepAnalysis: boolean;
    export: boolean;
    adPreviews: boolean;
  };
}

export const TIERS: Record<TierName, TierConfig> = {
  free: {
    name: 'free',
    label: 'Free',
    maxAds: 100,
    availableDepths: [100] as const,
    features: {
      deepAnalysis: false,
      export: false,
      adPreviews: false,
    },
  },
  pro: {
    name: 'pro',
    label: 'Pro',
    maxAds: 1000,
    availableDepths: [100, 500, 1000] as const,
    features: {
      deepAnalysis: true,
      export: true,
      adPreviews: true,
    },
  },
} as const;

// Helper to get tier from subscription status
export function getTierFromStatus(
  status: 'free' | 'pro' | 'past_due' | 'cancelled'
): TierName {
  // Pro access for active subscriptions only
  return status === 'pro' ? 'pro' : 'free';
}

// Validate requested depth against tier
export function isDepthAllowed(tier: TierName, depth: number): boolean {
  return TIERS[tier].availableDepths.includes(depth);
}

// Get max allowed depth for tier
export function getMaxDepth(tier: TierName): number {
  return TIERS[tier].maxAds;
}
```

### Pattern 2: Client-Side Tier Hook
**What:** React hook providing tier status for UI components
**When to use:** Any component needing to show tier-aware UI
**Example:**
```typescript
// src/hooks/use-tier-access.ts
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getTierFromStatus, TIERS, type TierConfig, type TierName } from '@/lib/tiers';
import type { SubscriptionStatus } from '@/lib/subscription';

interface TierAccess {
  tier: TierName;
  config: TierConfig;
  isPro: boolean;
  isLoading: boolean;
  canUseDepth: (depth: number) => boolean;
}

export function useTierAccess(): TierAccess {
  const { data: session, status: authStatus } = useSession();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authStatus === 'loading') return;

    // Unauthenticated users get free tier
    if (!session?.user?.email) {
      setSubscriptionStatus('free');
      setIsLoading(false);
      return;
    }

    // Fetch subscription status
    fetch('/api/subscription/status')
      .then((res) => res.json())
      .then((data) => {
        setSubscriptionStatus(data.status || 'free');
        setIsLoading(false);
      })
      .catch(() => {
        setSubscriptionStatus('free');
        setIsLoading(false);
      });
  }, [session?.user?.email, authStatus]);

  const tier = getTierFromStatus(subscriptionStatus);
  const config = TIERS[tier];

  return {
    tier,
    config,
    isPro: tier === 'pro',
    isLoading: authStatus === 'loading' || isLoading,
    canUseDepth: (depth: number) => config.availableDepths.includes(depth),
  };
}
```

### Pattern 3: Pro Badge Component
**What:** Visual indicator for Pro-only features
**When to use:** On locked depth options, feature toggles
**Example:**
```typescript
// src/components/tier/pro-badge.tsx
'use client';

interface ProBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ProBadge({ className = '', size = 'sm' }: ProBadgeProps) {
  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium ${sizeClasses[size]} ${className}`}
    >
      Pro
    </span>
  );
}
```

### Pattern 4: Tier-Aware Depth Selector
**What:** Depth selection that shows all options but locks Pro-only depths
**When to use:** Replace current depth buttons in page.tsx
**Example:**
```typescript
// src/components/tier/depth-selector.tsx
'use client';

import { useTierAccess } from '@/hooks/use-tier-access';
import { ProBadge } from './pro-badge';
import { UpgradeButton } from '@/components/subscription/upgrade-button';

interface DepthSelectorProps {
  value: number;
  onChange: (depth: number) => void;
  disabled?: boolean;
}

const DEPTH_OPTIONS = [
  { depth: 100, label: '100', tier: 'free' as const },
  { depth: 500, label: '500', tier: 'pro' as const },
  { depth: 1000, label: '1K', tier: 'pro' as const },
] as const;

export function DepthSelector({ value, onChange, disabled }: DepthSelectorProps) {
  const { canUseDepth, isPro, isLoading } = useTierAccess();

  return (
    <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 border border-[var(--border-subtle)]">
      {DEPTH_OPTIONS.map((option) => {
        const isLocked = !canUseDepth(option.depth);
        const isSelected = value === option.depth;

        return (
          <button
            key={option.depth}
            type="button"
            onClick={() => {
              if (!isLocked) {
                onChange(option.depth);
              }
            }}
            disabled={disabled || isLoading}
            className={`relative px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              isSelected
                ? 'bg-[var(--accent-green)] text-white'
                : isLocked
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-not-allowed'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
            }`}
          >
            <span className="flex items-center gap-1">
              {option.label}
              {isLocked && <ProBadge size="sm" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

### Pattern 5: Server-Side Tier Enforcement
**What:** Validate and cap requests at API layer
**When to use:** CRITICAL - must enforce before expensive operations
**Example:**
```typescript
// In src/app/api/facebook-ads/route.ts POST handler
import { auth } from '@/auth';
import { getSubscriptionStatus } from '@/lib/subscription';
import { getTierFromStatus, getMaxDepth, isDepthAllowed } from '@/lib/tiers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { limit = 100 } = body;

    // Get user's tier
    const session = await auth();
    let tier: TierName = 'free';

    if (session?.user?.email) {
      const status = await getSubscriptionStatus(session.user.email);
      tier = getTierFromStatus(status);
    }

    // Enforce tier limits
    const maxAllowed = getMaxDepth(tier);
    if (limit > maxAllowed) {
      // Cap to tier limit (don't reject - graceful degradation)
      limit = maxAllowed;
      console.log(`[Tier] Capped limit from ${body.limit} to ${limit} for ${tier} tier`);
    }

    // Continue with capped limit...
    // Pass `limit` to fetchFacebookAds
  }
}
```

### Anti-Patterns to Avoid
- **Client-only enforcement:** Never trust client-side tier checks alone. Always enforce server-side.
- **Hiding locked features:** Showing "Pro" badges drives conversions better than hiding features entirely.
- **Hardcoded limits:** Use centralized TIERS config, not magic numbers scattered through code.
- **Middleware-only gates:** Per CVE-2025-29927, always verify at data access layer too.
- **Blocking on past_due:** Allow grace period for payment issues; don't immediately downgrade.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Subscription status check | Direct Stripe API call each request | Database lookup via getSubscriptionStatus | Already cached via webhooks, fast |
| Upgrade flow | Custom payment form | Existing UpgradeButton + Stripe Checkout | Already implemented in Phase 11 |
| Status badges | Custom tier badge component | Extend existing StatusBadge pattern | Consistent with SubscriptionStatus |
| Loading states | Spinner per component | Existing skeleton/loading patterns | Project already has ResultsSkeleton |

**Key insight:** Phase 11 already built the subscription infrastructure. This phase wires it into the analysis flow - the subscription check, webhook sync, and UI components already exist.

## Common Pitfalls

### Pitfall 1: Client-Only Enforcement
**What goes wrong:** Users bypass UI restrictions by calling API directly
**Why it happens:** Relying on disabled buttons instead of server validation
**How to avoid:** Always validate tier in API route before expensive operations
**Warning signs:** Free users able to get 1000-ad results via curl/Postman

### Pitfall 2: Race Condition on Subscription Change
**What goes wrong:** User upgrades but UI still shows Free tier
**Why it happens:** Client-side subscription status is stale
**How to avoid:**
1. After Stripe checkout success, refetch `/api/subscription/status`
2. Use short cache TTL or revalidate on focus
3. Success page should trigger status refresh
**Warning signs:** "I just paid but still see Free" support tickets

### Pitfall 3: Blocking Past-Due Users Immediately
**What goes wrong:** Brief payment hiccup locks out paying customers
**Why it happens:** Treating past_due same as free/cancelled
**How to avoid:** Give grace period - past_due users keep Pro access for 7-14 days
**Warning signs:** Angry emails from customers whose card expired

### Pitfall 4: Inconsistent UI State
**What goes wrong:** Depth selector shows 500 available but analysis returns 100
**Why it happens:** Client tier check differs from server enforcement
**How to avoid:** Same TIERS config used everywhere, server is source of truth
**Warning signs:** "It said I could select 500 but only got 100 results"

### Pitfall 5: Not Logging Enforcement Actions
**What goes wrong:** Can't debug tier issues or audit access
**Why it happens:** Silent enforcement without logging
**How to avoid:** Log tier caps and enforcement decisions
**Warning signs:** Can't explain why user got specific result count

## Code Examples

Verified patterns adapted from existing codebase:

### Example 1: Enhance Subscription Status API for Tier Info
```typescript
// Extend /api/subscription/status/route.ts to return tier info
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getSubscriptionStatus } from '@/lib/subscription';
import { getTierFromStatus, TIERS } from '@/lib/tiers';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    // Unauthenticated users get free tier
    return NextResponse.json({
      status: 'unauthenticated',
      tier: 'free',
      maxAds: TIERS.free.maxAds,
      availableDepths: TIERS.free.availableDepths,
    });
  }

  const status = await getSubscriptionStatus(session.user.email);
  const tier = getTierFromStatus(status);
  const config = TIERS[tier];

  return NextResponse.json({
    status,
    tier,
    maxAds: config.maxAds,
    availableDepths: config.availableDepths,
  });
}
```

### Example 2: Upgrade Prompt for Locked Depth
```typescript
// Component shown when user clicks locked depth option
'use client';

import { useTransition } from 'react';
import { createCheckoutSession } from '@/app/actions/stripe';

interface UpgradePromptProps {
  feature: string;
  onClose: () => void;
}

export function UpgradePrompt({ feature, onClose }: UpgradePromptProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
      <h3 className="font-medium text-[var(--text-primary)] mb-2">
        Upgrade to Pro
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mb-4">
        {feature} requires a Pro subscription.
        Analyze up to 1,000 ads with deeper insights.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => startTransition(() => createCheckoutSession())}
          disabled={isPending}
          className="px-4 py-2 bg-[var(--accent-green)] text-white rounded-lg hover:bg-[var(--accent-green-light)] disabled:opacity-50"
        >
          {isPending ? 'Redirecting...' : 'Upgrade Now'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-lg hover:bg-[var(--border-subtle)]"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}
```

### Example 3: Real-Time Subscription Update After Checkout
```typescript
// After successful checkout, refresh subscription status
// In page.tsx or a subscription context

useEffect(() => {
  // Check URL for upgrade success parameter
  const params = new URLSearchParams(window.location.search);
  if (params.get('upgrade') === 'success') {
    // Refetch subscription status
    fetch('/api/subscription/status')
      .then(res => res.json())
      .then(data => {
        setSubscriptionStatus(data.status);
        // Clear URL parameter
        window.history.replaceState({}, '', window.location.pathname);
        // Show success toast
        toast.success('Welcome to Pro!', {
          description: 'You can now analyze up to 1,000 ads',
        });
      });
  }
}, []);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hide premium features | Show with "Pro" badges | SaaS best practice | 2-3x better conversion rates |
| Middleware-only gating | Defense-in-depth (middleware + API + DB) | CVE-2025-29927 (2025) | Security requirement |
| Per-request Stripe API | Database cache + webhook sync | Performance optimization | Lower latency, no rate limits |
| Feature flag services | Simple tier constants | Simplicity for 2-tier | Less overhead, easier debugging |

**Current best practice:** Feature gating should be **showcased, not hidden**. The most successful SaaS products show exactly what users would unlock with clear upgrade paths. Buffer and Beehiiv are cited as examples - they don't just gate features, they sell them with in-app marketing pages.

## Open Questions

Things that require validation during implementation:

1. **Grace period for past_due users**
   - What we know: Immediate lockout frustrates paying customers
   - What's unclear: Exact grace period (7 days? 14 days?)
   - Recommendation: Start with 7 days, let business decide

2. **Existing analysis depth state**
   - What we know: page.tsx has `analysisLimit` state with 100/250/500/1000
   - What's unclear: Whether 250 tier should exist or simplify to 100/500/1000
   - Recommendation: Based on requirements, simplify to Free (100) and Pro (500/1000)

3. **Real-time status refresh mechanism**
   - What we know: Need to update UI when subscription changes
   - What's unclear: Whether to poll, use websockets, or just refresh on navigation
   - Recommendation: Refresh on checkout success + window focus; avoid polling

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/lib/subscription.ts`, `src/app/api/subscription/status/route.ts`
- Phase 11 Research: `.planning/phases/11-stripe-integration/11-RESEARCH.md`
- Phase 11 Summary: `.planning/phases/11-stripe-integration/11-04-SUMMARY.md`

### Secondary (MEDIUM confidence)
- [DEV.to: Feature Gating in SaaS](https://dev.to/aniefon_umanah_ac5f21311c/feature-gating-how-we-built-a-freemium-saas-without-duplicating-components-1lo6) - FeatureGate wrapper pattern
- [ProductDiscovery: CVE-2025-29927](https://projectdiscovery.io/blog/nextjs-middleware-authorization-bypass) - Defense-in-depth requirement
- [Clerk: Complete Auth Guide](https://clerk.com/articles/complete-authentication-guide-for-nextjs-app-router) - Data access layer pattern

### Tertiary (LOW confidence)
- [Permit.io: Dynamic React Feature Flags](https://www.permit.io/blog/dynamic-react-feature-toggling-2024-guide) - General feature flag patterns
- [Demogo: Feature Gating Strategies](https://demogo.com/2025/06/25/feature-gating-strategies-for-your-saas-freemium-model-to-boost-conversions/) - Conversion optimization
- [Substack: Study in Feature Gating](https://alexdebecker.substack.com/p/a-study-in-feature-gating) - Buffer case study

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing infrastructure, no new dependencies
- Architecture: HIGH - Patterns verified against existing codebase
- Pitfalls: HIGH - Well-documented issues across sources
- UI patterns: MEDIUM - Based on SaaS best practices, specific styling TBD

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (Stable patterns; revalidate if subscription model changes)
