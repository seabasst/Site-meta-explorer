'use client';

import { ArrowLeftRight } from 'lucide-react';
import type { TrackedBrand } from '@/hooks/use-tracked-brands';

interface BrandSelectorProps {
  brands: TrackedBrand[];
  selectedAId: string | null;
  selectedBId: string | null;
  onSelectA: (id: string) => void;
  onSelectB: (id: string) => void;
}

export function BrandSelector({
  brands,
  selectedAId,
  selectedBId,
  onSelectA,
  onSelectB,
}: BrandSelectorProps) {
  const eligible = brands.filter((b) => b.snapshots.length > 0);

  const optionsA = eligible.filter((b) => b.id !== selectedBId);
  const optionsB = eligible.filter((b) => b.id !== selectedAId);

  const handleSwap = () => {
    if (selectedAId && selectedBId) {
      onSelectA(selectedBId);
      onSelectB(selectedAId);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
      {/* Brand A */}
      <div className="flex-1">
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          Brand A
        </label>
        <select
          value={selectedAId ?? ''}
          onChange={(e) => onSelectA(e.target.value)}
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)] transition-colors"
        >
          <option value="" disabled>
            Select brand...
          </option>
          {optionsA.map((b) => (
            <option key={b.id} value={b.id}>
              {b.pageName}
            </option>
          ))}
        </select>
      </div>

      {/* Swap button */}
      <button
        onClick={handleSwap}
        disabled={!selectedAId || !selectedBId}
        className="self-center sm:self-end p-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent-green)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title="Swap brands"
      >
        <ArrowLeftRight className="w-4 h-4" />
      </button>

      {/* Brand B */}
      <div className="flex-1">
        <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
          Brand B
        </label>
        <select
          value={selectedBId ?? ''}
          onChange={(e) => onSelectB(e.target.value)}
          className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-green)] transition-colors"
        >
          <option value="" disabled>
            Select brand...
          </option>
          {optionsB.map((b) => (
            <option key={b.id} value={b.id}>
              {b.pageName}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
