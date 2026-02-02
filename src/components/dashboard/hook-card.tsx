'use client';

import { ChevronDown } from 'lucide-react';

interface HookCardProps {
  id: string;
  hookText: string;
  frequency: number;
  totalReach: number;
  avgReachPerAd: number;
  adIds: string[];
  expanded: boolean;
  onToggle: () => void;
}

function formatReach(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function HookCard({ hookText, frequency, totalReach, adIds, expanded, onToggle }: HookCardProps) {
  return (
    <div className="rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="min-w-0 flex-1 mr-3">
          <p className="text-sm text-[var(--text-primary)] font-medium line-clamp-2">
            {hookText}
          </p>
          <div className="flex gap-3 mt-1">
            <span className="text-xs text-[var(--text-muted)]">{frequency} ads</span>
            <span className="text-xs text-[var(--text-muted)]">{formatReach(totalReach)} reach</span>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-[var(--text-muted)] shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">
            Ads using this hook
          </p>
          <div className="flex flex-wrap gap-2">
            {adIds.map((adId) => (
              <a
                key={adId}
                href={`https://www.facebook.com/ads/library/?id=${adId}`}
                target="_blank"
                rel="noopener noreferrer"
                title={adId}
                className="text-xs text-[var(--accent-green-light)] hover:text-[var(--text-primary)] transition-colors"
              >
                ...{adId.slice(-8)}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
