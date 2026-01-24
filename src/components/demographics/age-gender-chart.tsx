'use client';

import { useMemo } from 'react';

interface AgeGenderChartProps {
  data: { age: string; gender: string; percentage: number }[];
}

// Age range order for sorting
const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

export function AgeGenderChart({ data }: AgeGenderChartProps) {
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
        {groupedData.map((group, index) => (
          <div
            key={group.age}
            className="group"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Age label */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
                {group.age}
              </span>
              <span className="text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                {(group.male + group.female + group.unknown).toFixed(1)}% total
              </span>
            </div>

            {/* Bars container */}
            <div className="flex gap-1.5 h-8">
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
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary insight */}
      <div className="pt-4 border-t border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--text-muted)] text-center">
          Hover over age groups to see combined percentages
        </p>
      </div>
    </div>
  );
}
