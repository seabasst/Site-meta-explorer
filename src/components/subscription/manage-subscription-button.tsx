'use client';

import { useTransition } from 'react';
import { createPortalSession } from '@/app/actions/stripe';

export function ManageSubscriptionButton() {
  const [isPending, startTransition] = useTransition();

  const handleManage = () => {
    startTransition(async () => {
      await createPortalSession();
    });
  };

  return (
    <button
      onClick={handleManage}
      disabled={isPending}
      className="text-sm text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isPending ? 'Opening...' : 'Manage subscription'}
    </button>
  );
}
