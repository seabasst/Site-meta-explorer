'use client';

import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { getUserFriendlyMessage, isRetryableError } from '@/lib/errors';

interface ApiErrorAlertProps {
  error: Error | string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Displays API error with optional retry button.
 * Used for inline error display (not error boundary fallback).
 */
export function ApiErrorAlert({ error, onRetry, className }: ApiErrorAlertProps) {
  const errorObj = typeof error === 'string' ? new Error(error) : error;
  const message = getUserFriendlyMessage(errorObj);
  const canRetry = onRetry && isRetryableError(errorObj);

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>{message}</span>
        {canRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}
