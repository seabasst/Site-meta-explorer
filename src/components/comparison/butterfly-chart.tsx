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

interface ButterflyChartProps {
  brandAName: string;
  brandBName: string;
  brandADemo: AggregatedDemographics | null;
  brandBDemo: AggregatedDemographics | null;
}

const AGE_ORDER = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];

function buildButterflyData(
  brandADemo: AggregatedDemographics | null,
  brandBDemo: AggregatedDemographics | null
) {
  const brandAByAge = new Map<string, { male: number; female: number }>();
  const brandBByAge = new Map<string, { male: number; female: number }>();

  (brandADemo?.ageGenderBreakdown ?? []).forEach((item) => {
    const entry = brandAByAge.get(item.age) || { male: 0, female: 0 };
    if (item.gender === 'male') entry.male = item.percentage;
    if (item.gender === 'female') entry.female = item.percentage;
    brandAByAge.set(item.age, entry);
  });

  (brandBDemo?.ageGenderBreakdown ?? []).forEach((item) => {
    const entry = brandBByAge.get(item.age) || { male: 0, female: 0 };
    if (item.gender === 'male') entry.male = item.percentage;
    if (item.gender === 'female') entry.female = item.percentage;
    brandBByAge.set(item.age, entry);
  });

  return AGE_ORDER.map((age) => ({
    age,
    brandA_male: -(brandAByAge.get(age)?.male ?? 0),
    brandA_female: -(brandAByAge.get(age)?.female ?? 0),
    brandB_male: brandBByAge.get(age)?.male ?? 0,
    brandB_female: brandBByAge.get(age)?.female ?? 0,
  }));
}

export function ButterflyChart({
  brandAName,
  brandBName,
  brandADemo,
  brandBDemo,
}: ButterflyChartProps) {
  const data = useMemo(
    () => buildButterflyData(brandADemo, brandBDemo),
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm">No demographic data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Brand labels */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] px-2">
        <span className="font-medium">{brandAName}</span>
        <span className="font-medium">{brandBName}</span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          layout="vertical"
          data={data}
          stackOffset="sign"
          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
        >
          <XAxis
            type="number"
            tickFormatter={(v: number) => `${Math.abs(v).toFixed(1)}%`}
            domain={['auto', 'auto']}
            tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="age"
            width={50}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number | undefined, name: string | undefined) => {
              const labels: Record<string, string> = {
                brandA_male: `${brandAName} Male`,
                brandA_female: `${brandAName} Female`,
                brandB_male: `${brandBName} Male`,
                brandB_female: `${brandBName} Female`,
              };
              const key = name ?? '';
              return [`${Math.abs(value ?? 0).toFixed(1)}%`, labels[key] ?? key];
            }}
            labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
          />
          <Legend
            formatter={(value: string) => {
              const labels: Record<string, string> = {
                brandA_male: `${brandAName} Male`,
                brandA_female: `${brandAName} Female`,
                brandB_male: `${brandBName} Male`,
                brandB_female: `${brandBName} Female`,
              };
              return (
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                  {labels[value] ?? value}
                </span>
              );
            }}
          />
          {/* Brand A bars (negative, extend left) */}
          <Bar dataKey="brandA_male" fill="#2563eb" stackId="a" name="brandA_male" />
          <Bar dataKey="brandA_female" fill="#f43f5e" stackId="a" name="brandA_female" />
          {/* Brand B bars (positive, extend right) */}
          <Bar dataKey="brandB_male" fill="#60a5fa" stackId="b" name="brandB_male" />
          <Bar dataKey="brandB_female" fill="#fb7185" stackId="b" name="brandB_female" />
        </BarChart>
      </ResponsiveContainer>

      {/* Color legend clarification */}
      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#2563eb' }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#60a5fa' }} />
          <span className="text-[var(--text-muted)]">Male</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f43f5e' }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#fb7185' }} />
          <span className="text-[var(--text-muted)]">Female</span>
        </div>
      </div>
    </div>
  );
}
