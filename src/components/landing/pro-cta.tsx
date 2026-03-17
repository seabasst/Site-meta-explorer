'use client';

import { useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createCheckoutSession } from '@/app/actions/stripe';

interface ProCTAProps {
  className?: string;
  label?: string;
}

export function ProCTA({ className, label }: ProCTAProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin?callbackUrl=/dashboard/v2');
      return;
    }

    startTransition(async () => {
      await createCheckoutSession();
    });
  };

  const buttonLabel = isPending
    ? 'Redirecting...'
    : label ?? (session ? 'Upgrade to Pro' : 'Get Started with Pro');

  return (
    <button
      onClick={handleClick}
      disabled={isPending || status === 'loading'}
      className={`inline-flex items-center justify-center gap-2 bg-[#1235e2] hover:bg-[#0f2bc0] text-white font-medium rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
        className ?? 'text-sm px-6 py-3'
      }`}
    >
      {isPending && (
        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      )}
      {buttonLabel}
    </button>
  );
}
