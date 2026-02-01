'use client';

import { useMemo, useState } from 'react';

interface CountryChartProps {
  data: { region: string; percentage: number }[];
  onSegmentClick?: (filter: { type: 'country'; value: string; label: string }) => void;
  activeFilter?: { type: string; value: string; label: string } | null;
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

// Country code to full name mapping
const COUNTRY_NAMES: Record<string, string> = {
  'NL': 'Netherlands', 'DE': 'Germany', 'FR': 'France', 'BE': 'Belgium',
  'GB': 'United Kingdom', 'UK': 'United Kingdom', 'ES': 'Spain', 'IT': 'Italy',
  'PL': 'Poland', 'SE': 'Sweden', 'DK': 'Denmark', 'NO': 'Norway', 'FI': 'Finland',
  'AT': 'Austria', 'CH': 'Switzerland', 'PT': 'Portugal', 'IE': 'Ireland',
  'GR': 'Greece', 'CZ': 'Czech Republic', 'RO': 'Romania', 'HU': 'Hungary',
  'US': 'United States', 'CA': 'Canada', 'AU': 'Australia'
};

export function CountryChart({ data, onSegmentClick, activeFilter }: CountryChartProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  // Helper to get full country name from code or name
  const getFullName = (region: string): string => {
    // If it's already a full name, return it
    if (FLAGS[region]) return region;
    // If it's a code, look it up
    return COUNTRY_NAMES[region] || region;
  };

  const chartData = useMemo(() => {
    if (!data?.length) return [];

    // Sort and take top 6, group rest as "Other"
    const sorted = [...data].sort((a, b) => b.percentage - a.percentage);
    const top = sorted.slice(0, 6);
    const otherPct = sorted.slice(6).reduce((sum, c) => sum + c.percentage, 0);
    const otherCount = sorted.slice(6).length;

    const result = top.map((c, idx) => {
      const fullName = getFullName(c.region);
      return {
        name: fullName,
        originalName: c.region,
        value: c.percentage,
        flag: FLAGS[fullName] || FLAGS[c.region] || '🏳️',
        rank: idx + 1
      };
    });

    if (otherPct > 0) {
      result.push({
        name: 'Other',
        originalName: 'Other',
        value: otherPct,
        flag: '🌍',
        rank: result.length + 1,
        otherCount
      } as typeof result[0] & { otherCount?: number });
    }

    return result;
  }, [data]);

  const totalCountries = useMemo(() => {
    return data?.length || 0;
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
        const isTopThree = index < 3;
        const isHovered = hoveredCountry === country.name;

        return (
          <div
            key={country.name}
            className={`group relative cursor-pointer transition-opacity duration-200 ${
              activeFilter?.type === 'country' && activeFilter.value !== country.originalName ? 'opacity-40' : ''
            }`}
            style={{ animationDelay: `${index * 60}ms` }}
            onMouseEnter={() => setHoveredCountry(country.name)}
            onMouseLeave={() => setHoveredCountry(null)}
            onClick={() => {
              setHoveredCountry(country.name === hoveredCountry ? null : country.name);
              onSegmentClick?.({ type: 'country', value: country.originalName, label: `${country.flag} ${country.name}` });
            }}
          >
            {/* Country row */}
            <div className="flex items-center gap-3">
              {/* Flag & Name with rank badge for top 3 */}
              <div className="flex items-center gap-2 w-20 sm:w-36 flex-shrink-0">
                {isTopThree && country.name !== 'Other' && (
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                    index === 0 ? 'bg-amber-500/20 text-amber-400' :
                    index === 1 ? 'bg-gray-400/20 text-gray-400' :
                    'bg-orange-700/20 text-orange-500'
                  }`}>
                    {country.rank}
                  </span>
                )}
                <span className="text-lg">{country.flag}</span>
                <span className={`text-sm truncate ${isTop ? 'font-bold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                  {country.name}
                </span>
              </div>

              {/* Bar with enhanced hover */}
              <div className={`flex-1 relative h-7 bg-[var(--bg-tertiary)] rounded-md overflow-hidden transition-transform duration-200 ${isHovered ? 'scale-[1.02]' : ''}`}>
                <div
                  className={`absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out group-hover:brightness-125 ${
                    isTop
                      ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400'
                      : 'bg-gradient-to-r from-emerald-700/80 to-emerald-600/60'
                  }`}
                  style={{
                    width: `${widthPercent}%`,
                    boxShadow: isTop ? '0 0 20px rgba(16, 185, 129, 0.3)' : isHovered ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none'
                  }}
                />

                {/* Percentage label inside bar - always visible for top 3 */}
                {(country.value > 5 || isTopThree) && country.value > 2 && (
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs font-bold text-white drop-shadow-sm">
                    {country.value.toFixed(1)}%
                  </span>
                )}

                {/* Percentage label outside bar for small values */}
                {country.value <= 5 && !isTopThree && (
                  <span
                    className="absolute inset-y-0 flex items-center text-xs font-medium text-[var(--text-muted)]"
                    style={{ left: `calc(${widthPercent}% + 8px)` }}
                  >
                    {country.value.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>

            {/* Enhanced tooltip on hover */}
            {isHovered && (
              <div className="absolute -top-12 left-20 sm:left-36 z-20 px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-lg shadow-xl">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">{country.name}</span>
                  <span className="text-[var(--text-muted)]">|</span>
                  <span className="text-emerald-400 font-medium">{country.value.toFixed(1)}%</span>
                  {country.name !== 'Other' && (
                    <>
                      <span className="text-[var(--text-muted)]">|</span>
                      <span className="text-[var(--text-secondary)]">#{country.rank} of {totalCountries}</span>
                    </>
                  )}
                </div>
              </div>
            )}
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
