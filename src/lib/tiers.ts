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

// Free access period - all features unlocked until this date
const FREE_ACCESS_UNTIL = new Date('2026-03-01T00:00:00Z');

// Check if we're in the free access period
export function isInFreeAccessPeriod(): boolean {
  return new Date() < FREE_ACCESS_UNTIL;
}

export const TIERS: Record<TierName, TierConfig> = {
  free: {
    name: 'free',
    label: 'Free',
    maxAds: 1000, // Unlocked during free period
    availableDepths: [100, 500, 1000] as const, // All depths available
    features: {
      deepAnalysis: true, // Unlocked during free period
      export: true,       // Unlocked during free period
      adPreviews: true,   // Unlocked during free period
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
  // During free access period, everyone gets pro features
  // (The free tier config already has all features enabled)
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
