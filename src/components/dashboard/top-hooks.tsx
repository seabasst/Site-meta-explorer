'use client';

import { useMemo } from 'react';
import { DashboardCard } from './dashboard-card';
import { Sparkles, TrendingUp, Users } from 'lucide-react';
import type { TopHook } from '@/hooks/use-tracked-brands';

interface TopHooksProps {
  hooks: TopHook[];
}

export function TopHooks({ hooks }: TopHooksProps) {
  const sortedHooks = useMemo(() => {
    // Take top 8 hooks by reach
    return [...hooks]
      .sort((a, b) => b.totalReach - a.totalReach)
      .slice(0, 8);
  }, [hooks]);

  if (sortedHooks.length === 0) {
    return null;
  }

  const formatReach = (value: number) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  const maxReach = Math.max(...sortedHooks.map(h => h.totalReach));

  return (
    <DashboardCard
      title="Top Performing Hooks"
      tooltip="Opening lines with the highest reach across your tracked brands. These messaging patterns are likely working well."
    >
      <div className="space-y-3">
        {sortedHooks.map((hook, index) => {
          const barWidth = (hook.totalReach / maxReach) * 100;
          return (
            <div key={hook.id} className="group">
              <div className="flex items-start gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                  index < 3
                    ? 'bg-[var(--chart-blue)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] line-clamp-2 mb-1.5">
                    &ldquo;{hook.hookText}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {formatReach(hook.totalReach)} reach
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {hook.frequency} ads
                    </span>
                  </div>
                  {/* Reach bar */}
                  <div className="mt-2 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: index < 3 ? 'var(--chart-blue)' : 'var(--chart-blue-light)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Insight */}
      <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-[var(--chart-blue)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--text-muted)]">
          These hooks have proven reach. Consider adapting similar messaging angles for your campaigns.
        </p>
      </div>
    </DashboardCard>
  );
}
