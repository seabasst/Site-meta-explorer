'use client';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { getUserFriendlyMessage } from '@/lib/errors';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

/**
 * Fallback UI for react-error-boundary.
 * Displays user-friendly error message with retry button.
 */
export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  const message = getUserFriendlyMessage(error);

  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{message}</span>
        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
        >
          <RefreshCcw className="h-4 w-4" />
          Retry
        </button>
      </AlertDescription>
    </Alert>
  );
}
