'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { V2Shell, V2Card } from './v2-shell';

// Route-level error boundary for /dashboard/v2/*.
// Catches uncaught errors from server or client components in the subtree.
// Previously an uncaught error rendered a blank page (scope 2 P1).
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log for server-side error tracking (Sentry, Vercel logs, etc.)
    console.error('[dashboard/v2] Error boundary caught:', error);
  }, [error]);

  return (
    <V2Shell title="Something went wrong">
      <V2Card className="p-8 flex flex-col items-center text-center gap-4">
        <AlertTriangle className="w-10 h-10 text-[#1235e2]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold mb-1">We hit an unexpected error.</h2>
          <p className="text-sm text-current/60 max-w-md">
            The team has been notified. You can retry the action that caused it,
            or reload the page.
          </p>
          {error.digest && (
            <p className="mt-3 text-xs text-current/40 font-mono">
              Reference: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1235e2] text-white text-sm font-semibold hover:bg-[#0f2bc4] transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden />
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-current/15 text-sm font-medium hover:bg-current/5 transition-colors"
          >
            Reload page
          </button>
        </div>
      </V2Card>
    </V2Shell>
  );
}
