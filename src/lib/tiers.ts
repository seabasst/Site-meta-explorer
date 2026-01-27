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
  status: 'free' | 'pro' | 'past_due' | 'cancelled' | 'unauthenticated'
): TierName {
  // Pro access for active subscriptions only
  // past_due gets grace period (treat as pro for now)
  return status === 'pro' || status === 'past_due' ? 'pro' : 'free';
}

// Validate requested depth against tier
export function isDepthAllowed(tier: TierName, depth: number): boolean {
  return TIERS[tier].availableDepths.includes(depth);
}

// Get max allowed depth for tier
export function getMaxDepth(tier: TierName): number {
  return TIERS[tier].maxAds;
}
