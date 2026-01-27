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
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | 'unauthenticated'>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authStatus === 'loading') return;

    // Unauthenticated users get free tier
    if (!session?.user?.email) {
      setSubscriptionStatus('unauthenticated');
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
