'use client';

/**
 * AdPreviewCard - Ad preview card with lazy-loaded creative media
 * Clicking opens the ad on Facebook Ad Library
 */

import { useState } from 'react';
import { Play, Image as ImageIcon, ExternalLink, MousePointerClick } from 'lucide-react';
import { useAdMedia } from '@/hooks/use-ad-media';

interface AdPreviewCardProps {
  ad: {
    adArchiveId: string;
    creativeBody: string | null;
    linkTitle: string | null;
    linkUrl: string | null;
    snapshotUrl: string | null;
    mediaType: 'video' | 'image' | 'unknown';
    euTotalReach: number;
    startedRunning: string | null;
  };
}

export function AdPreviewCard({ ad }: AdPreviewCardProps) {
  const adUrl = `https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`;
  const { mediaUrl, mediaType: resolvedMediaType, isLoading } = useAdMedia(
    ad.adArchiveId,
    ad.snapshotUrl,
  );
  const [imgError, setImgError] = useState(false);

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

  const showMedia = mediaUrl && !imgError;

  return (
    <a
      href={adUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--accent-green)] transition-all overflow-hidden"
    >
      {/* Visual Preview */}
      <div className="relative h-48 bg-gradient-to-br from-[var(--bg-elevated)] via-[var(--bg-tertiary)] to-[var(--bg-elevated)] flex items-center justify-center overflow-hidden">
        {/* Shimmer loading state */}
        {isLoading && (
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, var(--bg-elevated) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        )}

        {/* Actual media */}
        {showMedia && resolvedMediaType === 'video' ? (
          <video
            src={mediaUrl}
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            preload="metadata"
          />
        ) : showMedia && resolvedMediaType === 'image' ? (
          <img
            src={mediaUrl}
            alt={ad.linkTitle || 'Ad creative'}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : !isLoading ? (
          /* Fallback placeholder */
          <div className="flex flex-col items-center gap-1.5 text-[var(--text-muted)] group-hover:text-[var(--accent-green-light)] transition-colors">
            {ad.mediaType === 'video' ? (
              <Play className="w-8 h-8 opacity-50 group-hover:opacity-80 transition-opacity" />
            ) : (
              <ImageIcon className="w-8 h-8 opacity-50 group-hover:opacity-80 transition-opacity" />
            )}
            <div className="flex items-center gap-1 text-xs opacity-70 group-hover:opacity-100">
              <MousePointerClick className="w-3 h-3" />
              <span>View {ad.mediaType === 'video' ? 'video' : 'ad'}</span>
            </div>
          </div>
        ) : null}

        {/* Play overlay for videos with media */}
        {showMedia && resolvedMediaType === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <Play className="w-8 h-8 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
          {/* Reach Badge */}
          <span className="px-2 py-0.5 rounded bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] text-xs font-medium backdrop-blur-sm">
            {formattedReach} reach
          </span>
          {/* Media Type Badge */}
          {ad.mediaType !== 'unknown' && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium backdrop-blur-sm ${
              ad.mediaType === 'video'
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {ad.mediaType === 'video' ? 'Video' : 'Image'}
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
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
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
