'use client';

import { useMemo } from 'react';

interface CountryChartProps {
  data: { region: string; percentage: number }[];
}

// Country flag emoji mapping for common countries
const FLAGS: Record<string, string> = {
  'Netherlands': '🇳🇱', 'Germany': '🇩🇪', 'France': '🇫🇷', 'Belgium': '🇧🇪',
  'United Kingdom': '🇬🇧', 'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Poland': '🇵🇱',
  'Sweden': '🇸🇪', 'Denmark': '🇩🇰', 'Norway': '🇳🇴', 'Finland': '🇫🇮',
  'Austria': '🇦🇹', 'Switzerland': '🇨🇭', 'Portugal': '🇵🇹', 'Ireland': '🇮🇪',
  'Greece': '🇬🇷', 'Czech Republic': '🇨🇿', 'Romania': '🇷🇴', 'Hungary': '🇭🇺',
  'United States': '🇺🇸', 'Canada': '🇨🇦', 'Australia': '🇦🇺', 'Other': '🌍'
};

export function CountryChart({ data }: CountryChartProps) {
  const chartData = useMemo(() => {
    if (!data?.length) return [];

    // Sort and take top 6, group rest as "Other"
    const sorted = [...data].sort((a, b) => b.percentage - a.percentage);
    const top = sorted.slice(0, 6);
    const otherPct = sorted.slice(6).reduce((sum, c) => sum + c.percentage, 0);

    const result = top.map(c => ({
      name: c.region,
      value: c.percentage,
      flag: FLAGS[c.region] || '🏳️'
    }));

    if (otherPct > 0) {
      result.push({ name: 'Other', value: otherPct, flag: '🌍' });
    }

    return result;
  }, [data]);

  const maxValue = useMemo(() => {
    return Math.max(...chartData.map(d => d.value), 1);
  }, [chartData]);

  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No geographic data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {chartData.map((country, index) => {
        const widthPercent = (country.value / maxValue) * 100;
        const isTop = index === 0;

        return (
          <div
            key={country.name}
            className="group"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            {/* Country row */}
            <div className="flex items-center gap-3">
              {/* Flag & Name */}
              <div className="flex items-center gap-2 w-36 flex-shrink-0">
                <span className="text-lg">{country.flag}</span>
                <span className={`text-sm truncate ${isTop ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {country.name}
                </span>
              </div>

              {/* Bar */}
              <div className="flex-1 relative h-7 bg-[var(--bg-tertiary)] rounded-md overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out group-hover:brightness-110 ${
                    isTop
                      ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-emerald-700/80 to-emerald-600/60'
                  }`}
                  style={{
                    width: `${widthPercent}%`,
                    boxShadow: isTop ? '0 0 20px rgba(16, 185, 129, 0.3)' : 'none'
                  }}
                />

                {/* Percentage label inside bar */}
                {country.value > 5 && (
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-white drop-shadow-sm">
                    {country.value.toFixed(1)}%
                  </span>
                )}

                {/* Percentage label outside bar for small values */}
                {country.value <= 5 && (
                  <span
                    className="absolute inset-y-0 flex items-center text-xs font-medium text-[var(--text-muted)]"
                    style={{ left: `calc(${widthPercent}% + 8px)` }}
                  >
                    {country.value.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Total indicator */}
      <div className="pt-3 mt-2 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>
            {chartData.length} {chartData.length === 1 ? 'region' : 'regions'} analyzed
          </span>
          <span className="font-medium text-emerald-500">
            {chartData.reduce((sum, c) => sum + c.value, 0).toFixed(1)}% total
          </span>
        </div>
      </div>
    </div>
  );
}
