import { Skeleton } from '@/components/ui/skeleton';
import { DemographicsSkeleton } from './demographics-skeleton';
import { ChartSkeleton } from './chart-skeleton';

/**
 * Full skeleton for the results area while API is loading.
 * Matches the complete results section layout in page.tsx.
 */
export function ResultsSkeleton() {
  return (
    <div className="animate-fade-in mb-8">
      <div className="glass rounded-2xl p-6">
        {/* Header with stats */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <Skeleton className="h-7 w-64 mb-2" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="text-right">
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        {/* Loading indicator */}
        <div className="mt-4 text-center py-8">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="w-6 h-6 rounded-full border-[3px] border-[var(--border-medium)] border-t-[var(--accent-green-light)] animate-spin" />
            <div className="text-center">
              <Skeleton className="h-5 w-32 mx-auto mb-1" />
              <Skeleton className="h-4 w-48 mx-auto" />
            </div>
          </div>
        </div>

        {/* Demographics skeleton */}
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <DemographicsSkeleton />

          {/* Charts skeleton */}
          <div className="space-y-4">
            <ChartSkeleton height={200} />
            <ChartSkeleton height={200} showLegend={false} />
          </div>
        </div>
      </div>
    </div>
  );
}
