'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { HookCard } from '@/components/dashboard/hook-card';

export interface HookGroupDisplay {
  id: string;
  hookText: string;
  normalizedText: string;
  frequency: number;
  totalReach: number;
  avgReachPerAd: number;
  adIds: string[];
}

interface HookExplorerProps {
  hookGroups: HookGroupDisplay[];
  loading: boolean;
}

export function HookExplorer({ hookGroups, loading }: HookExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredHooks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return hookGroups;
    return hookGroups.filter((h) =>
      h.hookText.toLowerCase().includes(q)
    );
  }, [hookGroups, searchQuery]);

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Opening Hooks</h3>
        <span className="text-xs text-[var(--text-muted)]">{filteredHooks.length} hooks</span>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state -- no hooks at all */}
      {!loading && hookGroups.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">
          No opening hooks found. Re-analyze to extract hooks from ad creatives.
        </p>
      )}

      {/* Content -- has hooks */}
      {!loading && hookGroups.length > 0 && (
        <>
          {/* Search input */}
          <div className="relative w-full mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search hooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)] w-full"
            />
          </div>

          {/* No search results */}
          {filteredHooks.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">
              No hooks match your search.
            </p>
          )}

          {/* Hook card list */}
          {filteredHooks.length > 0 && (
            <div className="space-y-2">
              {filteredHooks.map((hook) => (
                <HookCard
                  key={hook.id}
                  id={hook.id}
                  hookText={hook.hookText}
                  frequency={hook.frequency}
                  totalReach={hook.totalReach}
                  avgReachPerAd={hook.avgReachPerAd}
                  adIds={hook.adIds}
                  expanded={expandedId === hook.id}
                  onToggle={() => setExpandedId((prev) => (prev === hook.id ? null : hook.id))}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
