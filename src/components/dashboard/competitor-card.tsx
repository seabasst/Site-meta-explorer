'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { TrackedBrand, TrackedBrandSnapshot } from '@/hooks/use-tracked-brands';
import { DeleteBrandDialog } from '@/components/dashboard/delete-brand-dialog';

interface CompetitorCardProps {
  competitor: TrackedBrand;
  ownSnapshot: TrackedBrandSnapshot | null;
  onRemove: () => void;
  onSnapshot: (brandId: string) => void;
  snapshotLoading: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export function CompetitorCard({ competitor, ownSnapshot, onRemove, onSnapshot, snapshotLoading, selectable, selected, onSelect }: CompetitorCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const snapshot = competitor.snapshots[0];

  return (
    <Link
      href={`/dashboard/${competitor.id}`}
      className={`glass rounded-xl p-4 block hover:border-[var(--border-medium)] transition-colors cursor-pointer relative ${selected ? 'ring-2 ring-[var(--accent-green)]' : ''}`}
    >
      {selectable && (
        <div
          className="absolute top-2 left-2 z-10"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelect?.(); }}
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${selected ? 'bg-[var(--accent-green)] border-[var(--accent-green)]' : 'border-[var(--border-medium)] bg-[var(--bg-tertiary)]'}`}>
            {selected && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}
      <div className={`flex items-start justify-between mb-3 ${selectable ? 'pl-6' : ''}`}>
        <h4 className="font-medium text-[var(--text-primary)] text-sm truncate flex-1">{competitor.pageName}</h4>
        <div
          className="flex gap-1 ml-2 shrink-0"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          <button
            onClick={() => onSnapshot(competitor.id)}
            disabled={snapshotLoading}
            className="text-[10px] px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            {snapshotLoading ? '...' : 'Refresh'}
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="text-[10px] px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-red-400 hover:text-red-300 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
      <DeleteBrandDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        brandName={competitor.pageName}
        onConfirm={() => { onRemove(); setDeleteOpen(false); }}
      />

      {snapshot ? (
        <div className="space-y-2">
          <MetricRow label="Active Ads" value={snapshot.activeAdsCount} ownValue={ownSnapshot?.activeAdsCount} />
          <MetricRow label="Total Reach" value={snapshot.totalReach} ownValue={ownSnapshot?.totalReach} format="reach" />
          <MetricRow label="Est. Spend" value={snapshot.estimatedSpendUsd} ownValue={ownSnapshot?.estimatedSpendUsd} format="usd" />
          <MetricRow label="Avg Ad Age" value={snapshot.avgAdAgeDays} ownValue={ownSnapshot?.avgAdAgeDays} format="days" suffix="d" />
          {snapshot.topCountry1Code && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Top Country</span>
              <span className="text-[var(--text-primary)] font-medium">
                {snapshot.topCountry1Code}{snapshot.topCountry1Pct != null ? ` (${Math.round(snapshot.topCountry1Pct)}%)` : ''}
              </span>
            </div>
          )}
          <div className="pt-1">
            <span className="text-[var(--text-muted)] text-[10px]">
              {new Date(snapshot.snapshotDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">No data yet. Click Refresh to fetch.</p>
      )}
    </Link>
  );
}

function MetricRow({
  label,
  value,
  ownValue,
  format,
  suffix,
}: {
  label: string;
  value: number;
  ownValue?: number | null;
  format?: 'reach' | 'usd' | 'days';
  suffix?: string;
}) {
  const formatted = formatValue(value, format, suffix);
  const delta = ownValue != null && ownValue > 0 ? ((value - ownValue) / ownValue) * 100 : null;

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--text-muted)]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-primary)] font-medium">{formatted}</span>
        {delta !== null && (
          <span className={`text-[10px] font-medium ${delta > 0 ? 'text-red-400' : delta < 0 ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
            {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

function formatValue(value: number, format?: string, suffix?: string): string {
  if (format === 'reach') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString();
  }
  if (format === 'usd') return `$${Math.round(value).toLocaleString()}`;
  if (format === 'days') return `${Math.round(value)}${suffix || ''}`;
  return value.toLocaleString();
}
