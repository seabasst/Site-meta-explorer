'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BenchmarkBrandList, type BrandEntry } from './benchmark-brand-list';

interface Progress {
  total: number;
  completed: number;
  current: string | null;
}

export function BenchmarkCreateForm() {
  const router = useRouter();
  const [entries, setEntries] = useState<BrandEntry[]>([]);
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState<Progress>({
    total: 0,
    completed: 0,
    current: null,
  });

  // Add a new URL entry
  const handleAdd = useCallback((url: string) => {
    setEntries((prev) => {
      const isFirst = prev.length === 0;
      return [
        ...prev,
        {
          url,
          isBaseline: isFirst, // First URL is auto-set as baseline
          status: 'pending',
        },
      ];
    });
  }, []);

  // Remove an entry
  const handleRemove = useCallback((index: number) => {
    setEntries((prev) => {
      const removed = prev[index];
      const remaining = prev.filter((_, i) => i !== index);

      // If removing baseline and there are still entries, make first one baseline
      if (removed.isBaseline && remaining.length > 0) {
        return remaining.map((e, i) => ({
          ...e,
          isBaseline: i === 0,
        }));
      }
      return remaining;
    });
  }, []);

  // Set an entry as baseline
  const handleSetBaseline = useCallback((index: number) => {
    setEntries((prev) =>
      prev.map((e, i) => ({
        ...e,
        isBaseline: i === index,
      }))
    );
  }, []);

  // Check if form is valid for submission
  const isValid =
    entries.length >= 2 &&
    entries.some((e) => e.isBaseline) &&
    !isCreating;

  // Create benchmark
  const handleCreate = async () => {
    if (!isValid) return;

    setIsCreating(true);
    setProgress({
      total: entries.length,
      completed: 0,
      current: 'Starting...',
    });

    // Mark all entries as fetching
    setEntries((prev) =>
      prev.map((e) => ({ ...e, status: 'fetching' as const }))
    );

    try {
      const baselineEntry = entries.find((e) => e.isBaseline);
      const benchmarkName =
        name.trim() || `Benchmark: ${baselineEntry?.url.split('/').pop() || 'Untitled'}`;

      const res = await fetch('/api/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: benchmarkName,
          urls: entries.map((e) => e.url),
          baselineIndex: entries.findIndex((e) => e.isBaseline),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Handle failed entries
        if (data.failed && Array.isArray(data.failed)) {
          const failedUrls = new Set(data.failed.map((f: { url: string }) => f.url));
          const failedErrors = new Map<string, string>(
            data.failed.map((f: { url: string; error: string }) => [f.url, f.error])
          );

          setEntries((prev) =>
            prev.map((e) => ({
              ...e,
              status: failedUrls.has(e.url) ? ('error' as const) : ('success' as const),
              error: failedErrors.get(e.url),
            }))
          );
        }
        throw new Error(data.error || 'Failed to create benchmark');
      }

      // Success - update all entries
      setProgress({
        total: entries.length,
        completed: entries.length,
        current: null,
      });

      // Update entries with success status and page names from response
      const successfulBrands = data.report?.brands || [];
      const brandNameMap = new Map<string, string>(
        successfulBrands.map((b: { adLibraryUrl: string; pageName: string }) => [
          b.adLibraryUrl,
          b.pageName,
        ])
      );

      setEntries((prev) =>
        prev.map((e) => ({
          ...e,
          status: 'success' as const,
          pageName: brandNameMap.get(e.url) ?? e.pageName,
        }))
      );

      // Handle partial failures
      if (data.failed && data.failed.length > 0) {
        const failedCount = data.failed.length;
        toast.warning(
          `Benchmark created with ${entries.length - failedCount} brands (${failedCount} failed)`
        );
      } else {
        toast.success('Benchmark created!');
      }

      // Redirect to benchmarks list
      router.push('/dashboard/benchmarks');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create benchmark');
      setIsCreating(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      {/* Brand list */}
      <BenchmarkBrandList
        entries={entries}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onSetBaseline={handleSetBaseline}
        maxBrands={6}
        disabled={isCreating}
      />

      {/* Name input */}
      {entries.length >= 2 && (
        <div className="mt-6">
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
            Benchmark name (optional)
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Auto-generated from baseline brand"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)] transition-colors disabled:opacity-50"
            disabled={isCreating}
          />
        </div>
      )}

      {/* Progress indicator */}
      {isCreating && (
        <div className="mt-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-[var(--accent-green)] border-t-transparent animate-spin" />
          <p className="text-[var(--text-primary)] font-medium mb-2">
            Analyzing brands...
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            {progress.completed} of {progress.total} complete
            {progress.current && (
              <span className="block mt-1">Currently: {progress.current}</span>
            )}
          </p>
          <div className="mt-4 w-full bg-[var(--bg-tertiary)] rounded-full h-2">
            <div
              className="bg-[var(--accent-green)] h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Create button */}
      {!isCreating && (
        <div className="mt-6">
          <button
            onClick={handleCreate}
            disabled={!isValid}
            className="w-full px-4 py-3 bg-[var(--accent-green)] text-white font-medium rounded-lg hover:bg-[var(--accent-green-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Benchmark
          </button>
          {entries.length > 0 && entries.length < 2 && (
            <p className="text-xs text-[var(--text-muted)] text-center mt-2">
              Add at least 2 brands to create a benchmark
            </p>
          )}
          {entries.length >= 2 && !entries.some((e) => e.isBaseline) && (
            <p className="text-xs text-[var(--text-muted)] text-center mt-2">
              Select a baseline brand
            </p>
          )}
        </div>
      )}
    </div>
  );
}
