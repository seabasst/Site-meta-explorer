'use client';

import { Activity, TrendingUp, LayoutGrid, Tag } from 'lucide-react';
import { formatNumber } from '../../v2-shell';
import { FilteredStats, formatFormatLabel } from '../types';

interface StatsStripProps {
  stats: FilteredStats | null;
  loading: boolean;
  darkMode: boolean;
}

export function StatsStrip({ stats, loading, darkMode }: StatsStripProps) {
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const strong = darkMode ? 'text-white' : 'text-slate-900';

  // Placeholder when stats haven't loaded yet
  if (!stats) {
    return (
      <div
        className={`flex items-center h-[58px] px-4 py-3 rounded-xl border mb-6 ${
          darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200'
        }`}
      />
    );
  }

  const topFormats = stats.formatBreakdown.slice(0, 3);
  const topCategories = stats.topCategories.slice(0, 3);

  return (
    <div
      className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 rounded-xl border mb-6 text-sm transition-opacity duration-200 ${
        loading ? 'opacity-50' : 'opacity-100'
      } ${darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200'}`}
    >
      {/* Active Ads */}
      <div className="flex items-center gap-2">
        <Activity className={`w-3.5 h-3.5 ${darkMode ? 'text-green-400' : 'text-green-500'}`} />
        <div>
          <span className={`text-xs ${muted}`}>Active</span>
          <span className={`ml-1.5 font-semibold ${strong}`}>{formatNumber(stats.activeCount)}</span>
        </div>
      </div>

      {/* Divider */}
      <div className={`hidden sm:block w-px h-6 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />

      {/* Total Reach */}
      <div className="flex items-center gap-2">
        <TrendingUp className={`w-3.5 h-3.5 ${darkMode ? 'text-[#5b7bf7]' : 'text-[#1235e2]'}`} />
        <div>
          <span className={`text-xs ${muted}`}>Reach</span>
          <span className={`ml-1.5 font-semibold ${strong}`}>{formatNumber(stats.totalReach)}</span>
        </div>
      </div>

      {/* Divider */}
      {topFormats.length > 0 && (
        <div className={`hidden sm:block w-px h-6 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
      )}

      {/* Format Breakdown */}
      {topFormats.length > 0 && (
        <div className="flex items-center gap-2">
          <LayoutGrid className={`w-3.5 h-3.5 ${muted}`} />
          <div className="flex items-center gap-1.5">
            <span className={`text-xs ${muted}`}>Formats</span>
            <span className={`font-medium ${strong}`}>
              {topFormats.map((f, i) => (
                <span key={f.format}>
                  {i > 0 && <span className={`mx-1 ${muted}`}>&middot;</span>}
                  {formatFormatLabel(f.format)} {formatNumber(f.count)}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}

      {/* Divider */}
      {topCategories.length > 0 && (
        <div className={`hidden sm:block w-px h-6 ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
      )}

      {/* Top Categories */}
      {topCategories.length > 0 && (
        <div className="flex items-center gap-2">
          <Tag className={`w-3.5 h-3.5 ${muted}`} />
          <div className="flex items-center gap-1.5">
            <span className={`text-xs ${muted}`}>Categories</span>
            <span className={`font-medium ${strong}`}>
              {topCategories.map((c, i) => (
                <span key={c.category}>
                  {i > 0 && ', '}
                  {c.category}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
