'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AggregatedDemographics } from '@/lib/demographic-types';

interface CountryComparisonProps {
  brandAName: string;
  brandBName: string;
  brandADemo: AggregatedDemographics | null;
  brandBDemo: AggregatedDemographics | null;
}

// Country code to readable name mapping (subset from country-chart.tsx)
const COUNTRY_NAMES: Record<string, string> = {
  NL: 'Netherlands',
  DE: 'Germany',
  FR: 'France',
  BE: 'Belgium',
  GB: 'United Kingdom',
  UK: 'United Kingdom',
  ES: 'Spain',
  IT: 'Italy',
  PL: 'Poland',
  SE: 'Sweden',
  DK: 'Denmark',
  NO: 'Norway',
  FI: 'Finland',
  AT: 'Austria',
  CH: 'Switzerland',
  PT: 'Portugal',
  IE: 'Ireland',
  GR: 'Greece',
  CZ: 'Czech Republic',
  RO: 'Romania',
  HU: 'Hungary',
  US: 'United States',
  CA: 'Canada',
  AU: 'Australia',
};

function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] || code;
}

function mergeCountries(
  brandADemo: AggregatedDemographics | null,
  brandBDemo: AggregatedDemographics | null
): { country: string; brandA: number; brandB: number }[] {
  const brandAMap = new Map<string, number>();
  const brandBMap = new Map<string, number>();

  (brandADemo?.regionBreakdown ?? []).forEach((r) => {
    brandAMap.set(r.region, r.percentage);
  });

  (brandBDemo?.regionBreakdown ?? []).forEach((r) => {
    brandBMap.set(r.region, r.percentage);
  });

  // Union of all country codes
  const allCountries = new Set([...brandAMap.keys(), ...brandBMap.keys()]);

  // Build entries with combined percentage for ranking
  const entries = Array.from(allCountries).map((code) => ({
    code,
    brandA: brandAMap.get(code) ?? 0,
    brandB: brandBMap.get(code) ?? 0,
    combined: (brandAMap.get(code) ?? 0) + (brandBMap.get(code) ?? 0),
  }));

  // Sort by combined, take top 8
  entries.sort((a, b) => b.combined - a.combined);
  const top = entries.slice(0, 8);
  const rest = entries.slice(8);

  const result = top.map((e) => ({
    country: getCountryName(e.code),
    brandA: e.brandA,
    brandB: e.brandB,
  }));

  // Group rest as "Other"
  if (rest.length > 0) {
    const otherA = rest.reduce((sum, e) => sum + e.brandA, 0);
    const otherB = rest.reduce((sum, e) => sum + e.brandB, 0);
    if (otherA > 0 || otherB > 0) {
      result.push({ country: 'Other', brandA: otherA, brandB: otherB });
    }
  }

  return result;
}

export function CountryComparison({
  brandAName,
  brandBName,
  brandADemo,
  brandBDemo,
}: CountryComparisonProps) {
  const data = useMemo(
    () => mergeCountries(brandADemo, brandBDemo),
    [brandADemo, brandBDemo]
  );

  if (!brandADemo && !brandBDemo) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-muted)]">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm">No geographic data available</p>
        </div>
      </div>
    );
  }

  const chartHeight = Math.max(280, data.length * 45);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <XAxis
          type="number"
          tickFormatter={(v: number) => `${v.toFixed(1)}%`}
          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="country"
          width={80}
          tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`]}
          labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
        />
        <Legend
          formatter={(value: string) => (
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
              {value}
            </span>
          )}
        />
        <Bar dataKey="brandA" fill="#10b981" name={brandAName} />
        <Bar dataKey="brandB" fill="#f59e0b" name={brandBName} />
      </BarChart>
    </ResponsiveContainer>
  );
}
