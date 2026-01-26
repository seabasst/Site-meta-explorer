/**
 * AdPreviewCard - Displays ad creative with link to Facebook Ad Library
 *
 * Features:
 * - Clickable card opens Facebook Ad Library in new tab
 * - Media type badge (video/image) in top-right corner
 * - Full creative text display (no truncation)
 * - Hover effects for interactivity feedback
 */

import { Play, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface AdPreviewCardProps {
  ad: {
    adArchiveId: string;
    creativeBody: string | null;
    linkTitle: string | null;
    mediaType: 'video' | 'image' | 'unknown';
    euTotalReach: number;
    startedRunning: string | null;
  };
}

export function AdPreviewCard({ ad }: AdPreviewCardProps) {
  // Fallback display text logic
  const displayTitle = ad.linkTitle || ad.creativeBody || `View Ad #${ad.adArchiveId.slice(-6)}`;
  const displayBody = ad.creativeBody && ad.linkTitle ? ad.creativeBody : null;

  // Format date nicely
  const formattedDate = ad.startedRunning
    ? new Date(ad.startedRunning).toLocaleDateString()
    : 'Unknown start date';

  // Format reach with thousands separator
  const formattedReach = ad.euTotalReach.toLocaleString();

  return (
    <a
      href={`https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--accent-green)] transition-colors"
    >
      {/* Media Type Badge (top-right corner) */}
      {ad.mediaType !== 'unknown' && (
        <div className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          {ad.mediaType === 'video' ? (
            <Play className="w-4 h-4 text-purple-500" />
          ) : (
            <ImageIcon className="w-4 h-4 text-blue-500" />
          )}
        </div>
      )}

      {/* Title / Main Text */}
      <div className="flex items-start gap-2 pr-10">
        <h3 className={`text-sm font-medium group-hover:text-[var(--accent-green-light)] transition-colors ${
          !ad.linkTitle && !ad.creativeBody ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
        }`}>
          {displayTitle}
        </h3>
        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Creative Body (if different from title) */}
      {displayBody && (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {displayBody}
        </p>
      )}

      {/* Metadata Row */}
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
        {/* EU Reach Badge */}
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--accent-yellow)]/10 text-[var(--accent-yellow)]">
          {formattedReach} reach
        </span>

        {/* Start Date */}
        <span className="text-xs text-[var(--text-muted)]">
          Started: {formattedDate}
        </span>
      </div>
    </a>
  );
}
