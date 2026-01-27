import { Skeleton } from '@/components/ui/skeleton';

/**
 * Full skeleton for the results area while API is loading.
 * Matches the complete results section layout with summary cards.
 */
export function ResultsSkeleton() {
  return (
    <div className="mt-4 space-y-6">
      {/* Summary Cards Skeleton - 4 cards matching AccountSummary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="glass rounded-xl p-4 border-l-4 border-l-[var(--border-subtle)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-8 w-20 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Loading indicator */}
      <div className="text-center py-12">
        <div className="inline-flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-[3px] border-[var(--border-medium)] border-t-[var(--accent-green-light)] animate-spin" />
          <div className="text-center">
            <p className="text-sm text-[var(--text-secondary)] mb-1">Fetching ad data...</p>
            <p className="text-xs text-[var(--text-muted)]">This may take a moment for large accounts</p>
          </div>
        </div>
      </div>

      {/* Tab skeleton */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] w-fit">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Content skeleton */}
      <div className="glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] overflow-hidden">
              <Skeleton className="aspect-video w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
