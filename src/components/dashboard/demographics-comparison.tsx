'use client';

import type { TrackedBrand } from '@/hooks/use-tracked-brands';

interface DemographicsComparisonProps {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
}

interface DemoBreakdown {
  ageBreakdown?: Array<{ age: string; percentage: number }>;
  genderBreakdown?: Array<{ gender: string; percentage: number }>;
  regionBreakdown?: Array<{ region: string; percentage: number }>;
}

export function DemographicsComparison({ ownBrand, competitors }: DemographicsComparisonProps) {
  const brands = [
    ...(ownBrand ? [{ ...ownBrand, isOwn: true }] : []),
    ...competitors.map(c => ({ ...c, isOwn: false })),
  ].filter(b => b.snapshots.length > 0 && b.snapshots[0].demographicsJson);

  if (brands.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Demographics Comparison</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gender Comparison */}
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Gender Split</h4>
          <div className="space-y-3">
            {brands.map(b => {
              const demo = b.snapshots[0].demographicsJson as DemoBreakdown | null;
              const genders = demo?.genderBreakdown ?? [];
              return (
                <div key={b.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-[var(--text-primary)] font-medium truncate max-w-[140px]">{b.pageName}</span>
                    {b.isOwn && <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--accent-green)]/20 text-[var(--accent-green-light)]">You</span>}
                  </div>
                  <div className="flex h-5 rounded-full overflow-hidden bg-[var(--bg-tertiary)]">
                    {genders.map((g) => (
                      <div
                        key={g.gender}
                        style={{ width: `${g.percentage}%` }}
                        className={`flex items-center justify-center text-[10px] font-medium text-white ${
                          g.gender === 'female' ? 'bg-pink-500' :
                          g.gender === 'male' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}
                        title={`${g.gender}: ${g.percentage.toFixed(1)}%`}
                      >
                        {g.percentage > 15 ? `${g.gender} ${g.percentage.toFixed(0)}%` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Age Range Comparison */}
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Top Age Ranges</h4>
          <div className="space-y-3">
            {brands.map(b => {
              const demo = b.snapshots[0].demographicsJson as DemoBreakdown | null;
              const ages = (demo?.ageBreakdown ?? []).slice(0, 3);
              return (
                <div key={b.id}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-[var(--text-primary)] font-medium truncate max-w-[140px]">{b.pageName}</span>
                    {b.isOwn && <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--accent-green)]/20 text-[var(--accent-green-light)]">You</span>}
                  </div>
                  <div className="flex gap-2">
                    {ages.map((a) => (
                      <div key={a.age} className="flex-1 bg-[var(--bg-tertiary)] rounded-lg p-2 text-center">
                        <div className="text-xs font-medium text-[var(--text-primary)]">{a.age}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{a.percentage.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Country Comparison */}
        <div className="md:col-span-2">
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Top Countries</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {brands.map(b => {
              const demo = b.snapshots[0].demographicsJson as DemoBreakdown | null;
              const countries = (demo?.regionBreakdown ?? []).slice(0, 5);
              return (
                <div key={b.id} className="bg-[var(--bg-tertiary)] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-[var(--text-primary)] font-medium truncate">{b.pageName}</span>
                    {b.isOwn && <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--accent-green)]/20 text-[var(--accent-green-light)]">You</span>}
                  </div>
                  <div className="space-y-1">
                    {countries.map(c => (
                      <div key={c.region} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-muted)]">{c.region}</span>
                        <span className="text-[var(--text-primary)] font-medium">{c.percentage.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
