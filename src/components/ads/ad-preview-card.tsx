'use client';

/**
 * AdPreviewCard - Ad preview card (creative shown as a link to Meta's Ad Library)
 * Clicking opens the ad on Facebook Ad Library
 */

import { ExternalLink } from 'lucide-react';
import { MetaAdPreview } from '@/components/ads/meta-ad-preview';

interface AdPreviewCardProps {
  ad: {
    adArchiveId: string;
    creativeBody: string | null;
    linkTitle: string | null;
    linkUrl: string | null;
    snapshotUrl: string | null;
    mediaType: 'video' | 'image' | 'carousel' | 'unknown';
    euTotalReach: number;
    startedRunning: string | null;
  };
  advertiser?: string | null;
}

export function AdPreviewCard({ ad, advertiser }: AdPreviewCardProps) {
  const adUrl = `https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`;
  const badgeType = ad.mediaType !== 'unknown' ? ad.mediaType : null;

  // Format date
  const formattedDate = ad.startedRunning
    ? new Date(ad.startedRunning).toLocaleDateString()
    : 'Unknown';

  // Format reach
  const formattedReach = ad.euTotalReach.toLocaleString();

  // Get domain from link URL
  const linkDomain = ad.linkUrl ? (() => {
    try {
      return new URL(ad.linkUrl).hostname.replace('www.', '');
    } catch {
      return null;
    }
  })() : null;

  return (
    <a
      href={adUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--accent-green)] transition-all overflow-hidden"
    >
      {/* Visual Preview */}
      <div className="relative h-48 bg-gradient-to-br from-[var(--bg-elevated)] via-[var(--bg-tertiary)] to-[var(--bg-elevated)] flex items-center justify-center overflow-hidden">
        <MetaAdPreview adId={ad.adArchiveId} advertiser={advertiser} asLink={false} />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
          {/* Reach Badge */}
          <span className="px-2 py-0.5 rounded bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] text-xs font-medium backdrop-blur-sm">
            {formattedReach} reach
          </span>
          {/* Media Type Badge */}
          {badgeType && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm ${
              badgeType === 'video'
                ? 'bg-purple-500/20 text-purple-400'
                : badgeType === 'carousel'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-blue-500/20 text-blue-400'
            }`}>
              {badgeType === 'video' ? 'Video' : badgeType === 'carousel' ? 'Carousel' : 'Image'}
            </span>
          )}
        </div>

        {/* External link indicator */}
        <div className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--bg-elevated)]/80 text-[var(--text-muted)] group-hover:text-[var(--accent-green-light)] opacity-0 group-hover:opacity-100 transition-all z-10">
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        {/* Title */}
        {ad.linkTitle && (
          <h3 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-green-light)] transition-colors line-clamp-2">
            {ad.linkTitle}
          </h3>
        )}

        {/* Body text */}
        {ad.creativeBody && (
          <p className="text-xs text-[var(--text-secondary)]">
            {ad.creativeBody}
          </p>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-2 mt-auto pt-2 text-xs text-[var(--text-muted)]">
          <span>{formattedDate}</span>
          {linkDomain && (
            <>
              <span className="opacity-40">•</span>
              <span className="truncate">{linkDomain}</span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}
