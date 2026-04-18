import Link from 'next/link';
import { Search } from 'lucide-react';
import { V2Shell, V2Card } from './v2-shell';

// Route-level 404 for /dashboard/v2/*.
export default function NotFound() {
  return (
    <V2Shell title="Not found">
      <V2Card className="p-8 flex flex-col items-center text-center gap-4">
        <Search className="w-10 h-10 text-[#1235e2]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold mb-1">We couldn&apos;t find that page.</h2>
          <p className="text-sm text-current/60 max-w-md">
            The brand or page may have been removed, or the link might be stale.
          </p>
        </div>
        <Link
          href="/dashboard/v2/ads"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1235e2] text-white text-sm font-semibold hover:bg-[#0f2bc4] transition-colors"
        >
          Browse ads
        </Link>
      </V2Card>
    </V2Shell>
  );
}
