'use client';

import { FavoriteBrand } from '@/hooks/use-favorites';

interface FavoritesPanelProps {
  favorites: FavoriteBrand[];
  onSelect: (brand: FavoriteBrand) => void;
  onRemove: (pageId: string) => void;
  currentPageId?: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function FavoritesPanel({ favorites, onSelect, onRemove, currentPageId }: FavoritesPanelProps) {
  if (favorites.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
          <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <p className="text-sm text-[var(--text-muted)]">No favorites yet</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Click the star icon after analyzing a brand to save it
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {favorites.map((brand) => {
        const isCurrentBrand = brand.pageId === currentPageId;
        return (
          <div
            key={brand.pageId}
            className={`group relative flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              isCurrentBrand
                ? 'bg-[var(--accent-green)]/10 border-[var(--accent-green)]/30'
                : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]'
            }`}
            onClick={() => onSelect(brand)}
          >
            {/* Star icon */}
            <div className={`flex-shrink-0 ${isCurrentBrand ? 'text-[var(--accent-green)]' : 'text-[var(--accent-yellow)]'}`}>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>

            {/* Brand info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-[var(--text-primary)] truncate">
                {brand.pageName}
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                {brand.totalAds && <span>{brand.totalAds} ads</span>}
                {brand.totalAds && brand.totalReach && <span>•</span>}
                {brand.totalReach && <span>{formatNumber(brand.totalReach)} reach</span>}
                {(brand.totalAds || brand.totalReach) && <span>•</span>}
                <span>{formatDate(brand.lastAnalyzed || brand.addedAt)}</span>
              </div>
            </div>

            {/* Remove button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(brand.pageId);
              }}
              className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-400/10 transition-all"
              title="Remove from favorites"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
