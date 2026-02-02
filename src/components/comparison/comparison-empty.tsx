'use client';

import { Scale } from 'lucide-react';
import Link from 'next/link';

interface ComparisonEmptyProps {
  brandCount: number;
}

export function ComparisonEmpty({ brandCount }: ComparisonEmptyProps) {
  return (
    <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
      <Scale className="w-12 h-12 text-[var(--text-muted)] opacity-30 mb-4" />
      {brandCount === 0 ? (
        <>
          <p className="text-[var(--text-secondary)] mb-2">
            No brands saved yet.
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-6 max-w-md">
            Save brands from analysis results to compare them side by side.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-green)] text-white text-sm hover:bg-[var(--accent-green-dark)] transition-colors"
          >
            Analyse a Brand
          </Link>
        </>
      ) : (
        <>
          <p className="text-[var(--text-secondary)] mb-2">
            You need at least 2 saved brands to compare.
          </p>
          <p className="text-sm text-[var(--text-muted)] mb-6 max-w-md">
            Save another brand to get started with side-by-side comparisons.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-green)] text-white text-sm hover:bg-[var(--accent-green-dark)] transition-colors"
          >
            Analyse Another Brand
          </Link>
        </>
      )}
    </div>
  );
}
