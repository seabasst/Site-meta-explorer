'use client';

import type { TrackedBrand, TrackedBrandSnapshot } from '@/hooks/use-tracked-brands';

interface MetricsTableProps {
  brandA: TrackedBrand | null;
  brandB: TrackedBrand | null;
}

function formatReach(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}

const metrics: {
  label: string;
  getValue: (s: TrackedBrandSnapshot) => string;
}[] = [
  {
    label: 'Active Ads',
    getValue: (s) => s.activeAdsCount.toLocaleString(),
  },
  {
    label: 'Total Reach',
    getValue: (s) => formatReach(s.totalReach),
  },
  {
    label: 'Est. Spend',
    getValue: (s) => `$${Math.round(s.estimatedSpendUsd).toLocaleString()}`,
  },
  {
    label: 'Dominant Gender',
    getValue: (s) =>
      s.dominantGender
        ? `${s.dominantGender} (${Math.round(s.dominantGenderPct ?? 0)}%)`
        : 'N/A',
  },
  {
    label: 'Top Age Range',
    getValue: (s) =>
      s.dominantAgeRange
        ? `${s.dominantAgeRange} (${Math.round(s.dominantAgePct ?? 0)}%)`
        : 'N/A',
  },
  {
    label: 'Top Country',
    getValue: (s) =>
      s.topCountry1Code
        ? `${s.topCountry1Code} (${Math.round(s.topCountry1Pct ?? 0)}%)`
        : 'N/A',
  },
  {
    label: 'Video %',
    getValue: (s) => `${s.videoPercentage.toFixed(1)}%`,
  },
  {
    label: 'Avg Ad Age',
    getValue: (s) => `${Math.round(s.avgAdAgeDays)} days`,
  },
];

export function MetricsTable({ brandA, brandB }: MetricsTableProps) {
  const snapA = brandA?.snapshots[0] ?? null;
  const snapB = brandB?.snapshots[0] ?? null;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 pr-4 text-[var(--text-muted)] font-medium">
                Metric
              </th>
              <th className="text-right py-2 px-3 font-medium text-[var(--text-primary)]">
                <span className="truncate max-w-[120px] inline-block">
                  {brandA?.pageName ?? 'Brand A'}
                </span>
              </th>
              <th className="text-right py-2 px-3 font-medium text-[var(--text-primary)]">
                <span className="truncate max-w-[120px] inline-block">
                  {brandB?.pageName ?? 'Brand B'}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(({ label, getValue }) => (
              <tr
                key={label}
                className="border-b border-[var(--border-subtle)]/50"
              >
                <td className="py-2 pr-4 text-[var(--text-muted)]">{label}</td>
                <td className="text-right py-2 px-3 text-[var(--text-primary)] font-medium tabular-nums">
                  {snapA ? getValue(snapA) : '\u2014'}
                </td>
                <td className="text-right py-2 px-3 text-[var(--text-primary)] font-medium tabular-nums">
                  {snapB ? getValue(snapB) : '\u2014'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
