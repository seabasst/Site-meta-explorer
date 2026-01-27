'use client';

import { useTierAccess } from '@/hooks/use-tier-access';
import { ProBadge } from './pro-badge';
import { createCheckoutSession } from '@/app/actions/stripe';
import { useTransition } from 'react';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';

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
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  const handleLockedClick = (depth: number) => {
    // If not logged in, redirect to sign in
    if (!session) {
      signIn();
      return;
    }
    // If logged in but free tier, start checkout
    startTransition(() => createCheckoutSession());
  };

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
              if (isLocked) {
                handleLockedClick(option.depth);
              } else {
                onChange(option.depth);
              }
            }}
            disabled={disabled || isLoading || isPending}
            className={`relative px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
              isSelected
                ? 'bg-[var(--accent-green)] text-white'
                : isLocked
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[var(--border-subtle)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
            }`}
          >
            {option.label}
            {isLocked && <ProBadge size="sm" />}
          </button>
        );
      })}
    </div>
  );
}
