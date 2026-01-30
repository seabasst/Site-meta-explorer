'use client';

import type { TrackedBrand } from '@/hooks/use-tracked-brands';

interface OwnBrandCardProps {
  brand: TrackedBrand | null;
  onSetBrand: () => void;
  onSnapshot: (brandId: string) => void;
  snapshotLoading: boolean;
}

export function OwnBrandCard({ brand, onSetBrand, onSnapshot, snapshotLoading }: OwnBrandCardProps) {
  if (!brand) {
    return (
      <div className="glass rounded-2xl p-6 border-2 border-dashed border-[var(--border-subtle)] text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="font-medium text-[var(--text-primary)] mb-1">Set your brand</h3>
        <p className="text-sm text-[var(--text-muted)] mb-4">
          Add your Facebook page to track your own ad performance and compare against competitors.
        </p>
        <button onClick={onSetBrand} className="btn-primary text-sm px-4 py-2">
          Set My Brand
        </button>
      </div>
    );
  }

  const snapshot = brand.snapshots[0];

  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs text-[var(--accent-green-light)] font-medium mb-1">Your Brand</div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">{brand.pageName}</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSnapshot(brand.id)}
            disabled={snapshotLoading}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green-light)] transition-colors disabled:opacity-50"
          >
            {snapshotLoading ? 'Fetching...' : 'Refresh Data'}
          </button>
          <button onClick={onSetBrand} className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            Change
          </button>
        </div>
      </div>

      {snapshot ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricBox label="Active Ads" value={snapshot.activeAdsCount.toLocaleString()} />
          <MetricBox label="Total Reach" value={formatReach(snapshot.totalReach)} />
          <MetricBox label="Est. Spend" value={`$${Math.round(snapshot.estimatedSpendUsd).toLocaleString()}`} />
          <MetricBox label="Avg Ad Age" value={`${Math.round(snapshot.avgAdAgeDays)}d`} />
        </div>
      ) : (
        <p className="text-sm text-[var(--text-muted)]">
          No snapshot yet. Click &quot;Refresh Data&quot; to fetch the latest metrics.
        </p>
      )}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-tertiary)] rounded-lg p-3">
      <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-lg font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function formatReach(reach: number): string {
  if (reach >= 1_000_000) return `${(reach / 1_000_000).toFixed(1)}M`;
  if (reach >= 1_000) return `${(reach / 1_000).toFixed(1)}K`;
  return reach.toString();
}
