import { V2Shell, V2Skeleton } from './v2-shell';

// Route-level loading UI for /dashboard/v2/*.
// Next.js will show this whenever a server component down-tree is suspended.
// The v2 tree is currently all client components (Phase 6.8 territory), so
// this is a safety net more than a load-bearing fallback — but it ensures
// Next doesn't render a blank page on slow navigations.
export default function Loading() {
  return (
    <V2Shell title="Loading…">
      <V2Skeleton rows={5} />
    </V2Shell>
  );
}
