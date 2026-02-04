'use client';

import type { TrackedBrand } from '@/hooks/use-tracked-brands';

interface ComparisonTableProps {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
}

export function ComparisonTable({ ownBrand, competitors }: ComparisonTableProps) {
  const brands = [
    ...(ownBrand ? [{ ...ownBrand, isOwn: true }] : []),
    ...competitors.map(c => ({ ...c, isOwn: false })),
  ].filter(b => b.snapshots.length > 0);

  if (brands.length === 0) {
    return null;
  }

  const metrics: { key: string; label: string; format: (v: number) => string }[] = [
    { key: 'totalAdsFound', label: 'Total Ads', format: (v) => v.toLocaleString() },
    { key: 'activeAdsCount', label: 'Active Ads', format: (v) => v.toLocaleString() },
    { key: 'totalReach', label: 'Total Reach', format: formatReach },
    { key: 'avgReachPerAd', label: 'Avg Reach/Ad', format: formatReach },
    { key: 'estimatedSpendUsd', label: 'Est. Spend', format: (v) => `$${Math.round(v).toLocaleString()}` },
    { key: 'videoPercentage', label: 'Video %', format: (v) => `${v.toFixed(1)}%` },
    { key: 'imagePercentage', label: 'Image %', format: (v) => `${v.toFixed(1)}%` },
    { key: 'carouselPercentage', label: 'Carousel %', format: (v) => `${v.toFixed(1)}%` },
    { key: 'avgAdAgeDays', label: 'Avg Ad Age', format: (v) => `${Math.round(v)} days` },
  ];

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Side-by-Side Comparison</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="text-left py-2 pr-4 text-[var(--text-muted)] font-medium">Metric</th>
              {brands.map(b => (
                <th key={b.id} className="text-right py-2 px-3 font-medium text-[var(--text-primary)]">
                  <div className="flex items-center justify-end gap-1.5">
                    {b.isOwn && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-green)]/20 text-[var(--accent-green-light)]">You</span>
                    )}
                    <span className="truncate max-w-[120px]">{b.pageName}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(({ key, label, format }) => (
              <tr key={key} className="border-b border-[var(--border-subtle)]/50">
                <td className="py-2 pr-4 text-[var(--text-muted)]">{label}</td>
                {brands.map(b => {
                  const snap = b.snapshots[0];
                  const val = snap ? (snap as unknown as Record<string, number>)[key] ?? 0 : 0;
                  return (
                    <td key={b.id} className="text-right py-2 px-3 text-[var(--text-primary)] font-medium tabular-nums">
                      {snap ? format(val) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Demographics rows */}
            <tr className="border-b border-[var(--border-subtle)]/50">
              <td className="py-2 pr-4 text-[var(--text-muted)]">Top Gender</td>
              {brands.map(b => {
                const s = b.snapshots[0];
                return (
                  <td key={b.id} className="text-right py-2 px-3 text-[var(--text-primary)]">
                    {s?.dominantGender ? `${s.dominantGender} (${s.dominantGenderPct?.toFixed(0)}%)` : '—'}
                  </td>
                );
              })}
            </tr>
            <tr className="border-b border-[var(--border-subtle)]/50">
              <td className="py-2 pr-4 text-[var(--text-muted)]">Top Age Range</td>
              {brands.map(b => {
                const s = b.snapshots[0];
                return (
                  <td key={b.id} className="text-right py-2 px-3 text-[var(--text-primary)]">
                    {s?.dominantAgeRange ? `${s.dominantAgeRange} (${s.dominantAgePct?.toFixed(0)}%)` : '—'}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="py-2 pr-4 text-[var(--text-muted)]">Top Country</td>
              {brands.map(b => {
                const s = b.snapshots[0];
                return (
                  <td key={b.id} className="text-right py-2 px-3 text-[var(--text-primary)]">
                    {s?.topCountry1Code ? `${s.topCountry1Code} (${s.topCountry1Pct?.toFixed(0)}%)` : '—'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatReach(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString();
}
