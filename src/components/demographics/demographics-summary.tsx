'use client';

import { useMemo } from 'react';
import { AggregatedDemographics } from '@/lib/demographic-types';

interface DemographicsSummaryProps {
  demographics: AggregatedDemographics;
}

// Circular progress component
function CircularProgress({ value, color, size = 64 }: { value: number; color: string; size?: number }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--bg-tertiary)"
        strokeWidth={strokeWidth}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
        style={{
          filter: `drop-shadow(0 0 8px ${color}40)`
        }}
      />
    </svg>
  );
}

export function DemographicsSummary({ demographics }: DemographicsSummaryProps) {
  // Guard against empty data
  if (!demographics.genderBreakdown?.length && !demographics.ageBreakdown?.length) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--text-muted)] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-1">No demographic data available</p>
          <p className="text-xs text-[var(--text-muted)] max-w-xs">
            Demographic data is only available for ads targeting the EU due to transparency regulations.
          </p>
        </div>
      </div>
    );
  }

  // Calculate insights
  const insights = useMemo(() => {
    // Find dominant gender
    const dominantGender = demographics.genderBreakdown?.length
      ? demographics.genderBreakdown.reduce((max, curr) =>
          curr.percentage > max.percentage ? curr : max)
      : null;

    // Find dominant age group
    const dominantAge = demographics.ageBreakdown?.length
      ? demographics.ageBreakdown.reduce((max, curr) =>
          curr.percentage > max.percentage ? curr : max)
      : null;

    // Combine 25-44 age ranges (prime demographic)
    const primeDemo = demographics.ageBreakdown
      ?.filter(a => a.age === '25-34' || a.age === '35-44')
      .reduce((sum, a) => sum + a.percentage, 0) ?? 0;

    // Young audience (18-34)
    const youngAudience = demographics.ageBreakdown
      ?.filter(a => a.age === '18-24' || a.age === '25-34')
      .reduce((sum, a) => sum + a.percentage, 0) ?? 0;

    return { dominantGender, dominantAge, primeDemo, youngAudience };
  }, [demographics]);

  return (
    <div className="space-y-6">
      {/* Main insight cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Dominant Gender Card */}
        {insights.dominantGender && (
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden group hover:border-[var(--border-default)] transition-colors">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CircularProgress
                value={insights.dominantGender.percentage}
                color={insights.dominantGender.gender === 'male' ? '#3b82f6' : '#f43f5e'}
                size={80}
              />
            </div>
            <div className="relative">
              <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Primary Gender
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-black tabular-nums ${
                  insights.dominantGender.gender === 'male'
                    ? 'text-blue-400'
                    : 'text-rose-400'
                }`}>
                  {Math.round(insights.dominantGender.percentage)}%
                </span>
                <span className="text-sm font-medium text-[var(--text-secondary)] capitalize">
                  {insights.dominantGender.gender}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Prime Age Card */}
        {insights.primeDemo > 0 && (
          <div className="relative p-4 rounded-xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-elevated)] border border-[var(--border-subtle)] overflow-hidden group hover:border-[var(--border-default)] transition-colors">
            <div className="absolute -right-4 -top-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CircularProgress value={insights.primeDemo} color="#f59e0b" size={80} />
            </div>
            <div className="relative">
              <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Prime Demo (25-44)
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums text-amber-400">
                  {Math.round(insights.primeDemo)}%
                </span>
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  of audience
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Secondary stats */}
      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-subtle)]">
        {insights.dominantAge && (
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {insights.dominantAge.age}
            </div>
            <div className="text-xs text-[var(--text-muted)]">Peak Age</div>
          </div>
        )}

        <div className="w-px h-8 bg-[var(--border-subtle)]" />

        <div className="text-center">
          <div className="text-lg font-bold text-[var(--text-primary)]">
            {Math.round(insights.youngAudience)}%
          </div>
          <div className="text-xs text-[var(--text-muted)]">Under 35</div>
        </div>

        <div className="w-px h-8 bg-[var(--border-subtle)]" />

        <div className="text-center">
          <div className="text-lg font-bold text-emerald-400">
            {demographics.adsWithDemographics ?? 0}
          </div>
          <div className="text-xs text-[var(--text-muted)]">Ads Analyzed</div>
        </div>
      </div>
    </div>
  );
}
