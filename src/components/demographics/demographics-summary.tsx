'use client';

import { AggregatedDemographics } from '@/lib/demographic-types';

interface DemographicsSummaryProps {
  demographics: AggregatedDemographics;
}

export function DemographicsSummary({ demographics }: DemographicsSummaryProps) {
  // Guard against empty data
  if (!demographics.genderBreakdown?.length && !demographics.ageBreakdown?.length) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[var(--text-muted)]">
          No demographic data available
        </p>
      </div>
    );
  }

  // Find dominant gender (highest percentage)
  const dominantGender = demographics.genderBreakdown?.length
    ? demographics.genderBreakdown.reduce((max, curr) =>
        curr.percentage > max.percentage ? curr : max)
    : null;

  // Combine 25-34 and 35-44 age ranges
  const youngAdults = demographics.ageBreakdown
    ?.filter(a => a.age === '25-34' || a.age === '35-44')
    .reduce((sum, a) => sum + a.percentage, 0) ?? 0;

  return (
    <div className="space-y-2">
      {dominantGender && (
        <p className="text-lg text-[var(--text-primary)]">
          <span className="font-bold">{Math.round(dominantGender.percentage)}%</span>
          {' '}{dominantGender.gender}
        </p>
      )}
      {youngAdults > 0 && (
        <p className="text-lg text-[var(--text-primary)]">
          <span className="font-bold">{Math.round(youngAdults)}%</span>
          {' '}ages 25-44
        </p>
      )}
      <p className="text-sm text-[var(--text-muted)]">
        Based on {demographics.adsWithDemographics ?? 0} ads analyzed
      </p>
    </div>
  );
}
