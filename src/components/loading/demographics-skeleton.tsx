import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton for the demographics summary section.
 * Matches DemographicsSummary component dimensions.
 */
export function DemographicsSkeleton() {
  return (
    <div className="glass rounded-xl p-5 space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* Stats grid - matches 3-column summary layout */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>

      {/* Insight text skeleton */}
      <div className="space-y-2 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}
