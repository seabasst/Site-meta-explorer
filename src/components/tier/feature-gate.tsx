'use client';

import type { TierConfig } from '@/lib/tiers';

interface FeatureGateProps {
  feature: keyof TierConfig['features'];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showTeaser?: boolean;
}

/**
 * FeatureGate - Currently all features are unlocked (free until March 1st)
 * Payment integration will be added on March 1st, 2026
 */
export function FeatureGate({
  children,
}: FeatureGateProps) {
  // All features unlocked - just render children
  return <>{children}</>;
}
