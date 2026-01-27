'use client';

import { useTierAccess } from '@/hooks/use-tier-access';
import { ProBadge } from './pro-badge';
import { createCheckoutSession } from '@/app/actions/stripe';
import { useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { Lock } from 'lucide-react';
import type { TierConfig } from '@/lib/tiers';

interface FeatureGateProps {
  feature: keyof TierConfig['features'];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showTeaser?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showTeaser = true,
}: FeatureGateProps) {
  const { config, isLoading } = useTierAccess();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  const hasFeature = config.features[feature];

  // Loading state
  if (isLoading) {
    return (
      fallback || (
        <div className="animate-pulse rounded-xl bg-[var(--bg-tertiary)] h-48" />
      )
    );
  }

  // Feature unlocked - show content
  if (hasFeature) {
    return <>{children}</>;
  }

  // Feature locked and showTeaser is false - hide completely
  if (!showTeaser) {
    return null;
  }

  // Feature locked - show blurred teaser with upgrade CTA
  const handleUpgradeClick = () => {
    if (!session) {
      signIn();
      return;
    }
    startTransition(() => createCheckoutSession());
  };

  return (
    <div className="relative">
      {/* Blurred content teaser */}
      <div className="opacity-50 pointer-events-none blur-sm select-none">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)]/60 backdrop-blur-sm rounded-xl">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
            <Lock className="w-5 h-5 text-[var(--text-muted)]" />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              Pro Feature
            </span>
            <ProBadge size="sm" />
          </div>

          <p className="text-xs text-[var(--text-muted)] max-w-[200px]">
            Upgrade to unlock this feature and get full access to all Pro benefits
          </p>

          <button
            onClick={handleUpgradeClick}
            disabled={isPending}
            className="mt-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Loading...' : 'Upgrade to Pro'}
          </button>
        </div>
      </div>
    </div>
  );
}
