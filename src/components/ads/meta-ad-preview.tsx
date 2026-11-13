import { ArrowUpRight } from 'lucide-react';
import { metaAdUrl } from '@/lib/meta-ad-url';

// Stands in for an ad's image or video. Creatives belong to the advertiser, so we never show our own copies:
// we credit the advertiser and link to the ad on Meta's Ad Library. Colours follow currentColor, so it fits
// any theme. Fills a positioned parent by default; pass className="h-full w-full" (or similar) otherwise.
// Pass asLink={false} when the parent is already a link to the ad (no nested <a>).
export function MetaAdPreview({
  adId,
  advertiser,
  asLink = true,
  className = 'absolute inset-0',
}: {
  adId: string;
  advertiser?: string | null;
  asLink?: boolean;
  className?: string;
}) {
  // Container query: below 9rem wide (list thumbnails) only the short link shows.
  const look = `@container flex flex-col items-center justify-center gap-1 overflow-hidden p-2 text-center bg-[color-mix(in_srgb,currentColor_6%,transparent)] ${className}`;
  const body = (
    <>
      {advertiser && (
        <span className="hidden flex-col items-center gap-1 @[9rem]:flex">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-50">Ad by</span>
          <span className="line-clamp-2 text-sm font-semibold">{advertiser}</span>
        </span>
      )}
      <span className="text-[11px] leading-snug opacity-70 @[9rem]:mt-1 @[9rem]:text-xs">
        <span className="underline underline-offset-2"><span className="hidden @[9rem]:inline">View on </span>Meta Ad Library</span>
        <ArrowUpRight size={13} strokeWidth={1.75} aria-hidden className="ml-0.5 inline align-[-2px]" />
      </span>
    </>
  );
  return asLink ? (
    <a href={metaAdUrl(adId)} target="_blank" rel="noopener noreferrer" className={look}>{body}</a>
  ) : (
    <div className={look}>{body}</div>
  );
}
