import { Skeleton } from '@/components/ui/skeleton';

interface ChartSkeletonProps {
  height?: number;
  showLegend?: boolean;
}

/**
 * Skeleton for chart areas.
 * Height defaults to 200px to match AgeGenderChart and CountryChart.
 */
export function ChartSkeleton({ height = 200, showLegend = true }: ChartSkeletonProps) {
  return (
    <div className="glass rounded-xl p-5 space-y-4">
      {/* Chart title skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
      </div>

      {/* Chart area skeleton */}
      <Skeleton className={`w-full rounded-xl`} style={{ height: `${height}px` }} />

      {/* Legend skeleton */}
      {showLegend && (
        <div className="flex justify-center gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
