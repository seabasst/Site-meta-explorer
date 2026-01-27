'use client';

import { useMemo, useState } from 'react';

interface AgeGenderChartProps {
  data: { age: string; gender: string; percentage: number }[];
}

// Age range order for sorting
const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

export function AgeGenderChart({ data }: AgeGenderChartProps) {
  const [hoveredAge, setHoveredAge] = useState<string | null>(null);

  const groupedData = useMemo(() => {
    if (!data?.length) return [];

    const groups = new Map<string, { male: number; female: number; unknown: number }>();

    data.forEach(item => {
      const existing = groups.get(item.age) || { male: 0, female: 0, unknown: 0 };
      existing[item.gender as keyof typeof existing] = item.percentage;
      groups.set(item.age, existing);
    });

    return Array.from(groups.entries())
      .map(([age, values]) => ({ age, ...values }))
      .sort((a, b) => {
        const aIndex = AGE_ORDER.indexOf(a.age);
        const bIndex = AGE_ORDER.indexOf(b.age);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      });
  }, [data]);

  const maxValue = useMemo(() => {
    return Math.max(...groupedData.flatMap(d => [d.male, d.female, d.unknown]), 1);
  }, [groupedData]);

  // Find the dominant segment (highest single gender+age combo)
  const dominantSegment = useMemo((): { age: string; gender: string; percentage: number } | null => {
    if (!groupedData.length) return null;

    let maxPct = 0;
    let dominant: { age: string; gender: string; percentage: number } | null = null;

    groupedData.forEach(group => {
      if (group.male > maxPct) {
        maxPct = group.male;
        dominant = { age: group.age, gender: 'Male', percentage: group.male };
      }
      if (group.female > maxPct) {
        maxPct = group.female;
        dominant = { age: group.age, gender: 'Female', percentage: group.female };
      }
    });

    return dominant;
  }, [groupedData]);

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">No age/gender data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">Male</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-rose-400 to-rose-600" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">Female</span>
        </div>
        {groupedData.some(d => d.unknown > 0) && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-gray-400 to-gray-500" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">Unknown</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="space-y-4">
        {groupedData.map((group, index) => {
          const total = group.male + group.female + group.unknown;
          const isHovered = hoveredAge === group.age;

          return (
            <div
              key={group.age}
              className="group relative"
              style={{ animationDelay: `${index * 50}ms` }}
              onMouseEnter={() => setHoveredAge(group.age)}
              onMouseLeave={() => setHoveredAge(null)}
            >
              {/* Age label */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                  {group.age}
                </span>
                {/* Enhanced tooltip with breakdown */}
                <div className={`text-xs transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                  <span className="text-blue-400">M: {group.male.toFixed(1)}%</span>
                  <span className="text-[var(--text-muted)] mx-1">|</span>
                  <span className="text-rose-400">F: {group.female.toFixed(1)}%</span>
                  <span className="text-[var(--text-muted)] mx-1">|</span>
                  <span className="text-[var(--text-secondary)] font-medium">{total.toFixed(1)}%</span>
                </div>
              </div>

              {/* Bars container with hover scale */}
              <div className={`flex gap-1.5 h-8 transition-transform duration-200 ${isHovered ? 'scale-[1.02]' : ''}`}>
                {/* Male bar */}
                <div className="relative flex-1 bg-[var(--bg-tertiary)] rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-400 rounded transition-all duration-700 ease-out group-hover:brightness-110"
                    style={{
                      width: `${(group.male / maxValue) * 100}%`,
                      boxShadow: group.male > 5 ? '0 0 20px rgba(59, 130, 246, 0.3)' : 'none'
                    }}
                  />
                  {group.male > 3 && (
                    <span className="absolute inset-y-0 left-2 flex items-center text-xs font-bold text-white drop-shadow-sm">
                      {group.male.toFixed(1)}%
                    </span>
                  )}
                  {/* Floating tooltip for small values */}
                  {group.male <= 3 && group.male > 0 && isHovered && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded text-[10px] font-medium text-blue-400 shadow-lg z-10"
                      style={{ left: `calc(${(group.male / maxValue) * 100}% + 4px)` }}
                    >
                      {group.male.toFixed(1)}%
                    </span>
                  )}
                </div>

                {/* Female bar */}
                <div className="relative flex-1 bg-[var(--bg-tertiary)] rounded overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-rose-500 to-rose-400 rounded transition-all duration-700 ease-out group-hover:brightness-110"
                    style={{
                      width: `${(group.female / maxValue) * 100}%`,
                      boxShadow: group.female > 5 ? '0 0 20px rgba(244, 63, 94, 0.3)' : 'none'
                    }}
                  />
                  {group.female > 3 && (
                    <span className="absolute inset-y-0 left-2 flex items-center text-xs font-bold text-white drop-shadow-sm">
                      {group.female.toFixed(1)}%
                    </span>
                  )}
                  {/* Floating tooltip for small values */}
                  {group.female <= 3 && group.female > 0 && isHovered && (
                    <span
                      className="absolute top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded text-[10px] font-medium text-rose-400 shadow-lg z-10"
                      style={{ left: `calc(${(group.female / maxValue) * 100}% + 4px)` }}
                    >
                      {group.female.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary insight with dominant segment */}
      <div className="pt-4 border-t border-[var(--border-subtle)]">
        {dominantSegment ? (
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Top segment:</span>
            <span className={`text-xs font-semibold ${dominantSegment.gender === 'Male' ? 'text-blue-400' : 'text-rose-400'}`}>
              {dominantSegment.gender} {dominantSegment.age}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              ({dominantSegment.percentage.toFixed(1)}%)
            </span>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] text-center">
            Hover over age groups to see breakdown
          </p>
        )}
      </div>
    </div>
  );
}
