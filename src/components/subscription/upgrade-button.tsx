'use client';

import { useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { createCheckoutSession } from '@/app/actions/stripe';

export function UpgradeButton() {
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  if (!session) {
    return null; // Don't show upgrade button if not logged in
  }

  const handleUpgrade = () => {
    startTransition(async () => {
      await createCheckoutSession();
    });
  };

  return (
    <button
      onClick={handleUpgrade}
      disabled={isPending}
      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
    >
      {isPending ? 'Redirecting...' : 'Upgrade to Pro'}
    </button>
  );
}
