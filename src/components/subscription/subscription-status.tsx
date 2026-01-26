'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { SubscriptionStatus as Status } from '@/lib/subscription';
import { UpgradeButton } from './upgrade-button';
import { ManageSubscriptionButton } from './manage-subscription-button';

export function SubscriptionStatus() {
  const { data: session, status: authStatus } = useSession();
  const [subscriptionStatus, setSubscriptionStatus] = useState<Status | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authStatus === 'loading') return;

    if (!session?.user?.email) {
      setIsLoading(false);
      return;
    }

    // Fetch subscription status from API
    fetch('/api/subscription/status')
      .then((res) => res.json())
      .then((data) => {
        setSubscriptionStatus(data.status);
        setIsLoading(false);
      })
      .catch(() => {
        setSubscriptionStatus('free');
        setIsLoading(false);
      });
  }, [session?.user?.email, authStatus]);

  // Don't render if not logged in or still loading auth
  if (authStatus === 'loading' || !session) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-400 animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  // Not subscribed status check
  if (!subscriptionStatus) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <StatusBadge status={subscriptionStatus} />
      <StatusAction status={subscriptionStatus} />
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  switch (status) {
    case 'pro':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          Pro
        </span>
      );
    case 'past_due':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          Payment Issue
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          Cancelled
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          Free
        </span>
      );
  }
}

function StatusAction({ status }: { status: Status }) {
  switch (status) {
    case 'pro':
    case 'past_due':
      return <ManageSubscriptionButton />;
    case 'cancelled':
    case 'free':
    default:
      // Free/cancelled users see upgrade button
      return <UpgradeButton />;
  }
}
