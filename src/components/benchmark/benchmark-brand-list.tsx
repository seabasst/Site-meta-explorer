'use client';

import { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';

export interface BrandEntry {
  url: string;
  isBaseline: boolean;
  status: 'pending' | 'fetching' | 'success' | 'error';
  pageName?: string;
  error?: string;
}

interface BenchmarkBrandListProps {
  entries: BrandEntry[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  onSetBaseline: (index: number) => void;
  maxBrands?: number; // Default 6 (1 baseline + 5 competitors)
  disabled?: boolean;
}

export function BenchmarkBrandList({
  entries,
  onAdd,
  onRemove,
  onSetBaseline,
  maxBrands = 6,
  disabled = false,
}: BenchmarkBrandListProps) {
  const [inputUrl, setInputUrl] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const validateUrl = (url: string): string | null => {
    if (!url.trim()) {
      return 'URL is required';
    }
    if (!url.includes('facebook.com/ads/library')) {
      return 'URL must be a Facebook Ad Library URL';
    }
    // Check for duplicates
    const normalizedInput = url.trim().toLowerCase();
    const isDuplicate = entries.some(
      (e) => e.url.toLowerCase() === normalizedInput
    );
    if (isDuplicate) {
      return 'This URL is already added';
    }
    return null;
  };

  const handleAdd = () => {
    const error = validateUrl(inputUrl);
    if (error) {
      setInputError(error);
      return;
    }
    onAdd(inputUrl.trim());
    setInputUrl('');
    setInputError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const isMaxReached = entries.length >= maxBrands;

  return (
    <div className="space-y-4">
      {/* URL input field */}
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="url"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              setInputError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Paste Ad Library URL..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)] transition-colors disabled:opacity-50"
            disabled={isMaxReached || disabled}
          />
          {inputError && (
            <p className="mt-1 text-xs text-red-400">{inputError}</p>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={!inputUrl || isMaxReached || disabled}
          className="px-4 py-2.5 bg-[var(--accent-green)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-green-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      {isMaxReached && (
        <p className="text-xs text-[var(--text-muted)]">
          Maximum of {maxBrands} brands reached
        </p>
      )}

      {/* Brand list */}
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              entry.isBaseline
                ? 'border-[var(--accent-green)] bg-[var(--accent-green)]/10'
                : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'
            }`}
          >
            {/* Baseline radio button */}
            <button
              onClick={() => onSetBaseline(idx)}
              disabled={disabled}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                entry.isBaseline
                  ? 'border-[var(--accent-green)] bg-[var(--accent-green)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]'
              }`}
              title={entry.isBaseline ? 'Baseline brand' : 'Set as baseline'}
            >
              {entry.isBaseline && <Check className="w-3 h-3 text-white" />}
            </button>

            {/* URL/pageName display */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-primary)] truncate">
                  {entry.pageName || entry.url}
                </span>
                {entry.isBaseline && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-green)]/20 text-[var(--accent-green-light)] shrink-0">
                    Baseline
                  </span>
                )}
              </div>
              {entry.pageName && (
                <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                  {entry.url}
                </p>
              )}
              {entry.status === 'error' && entry.error && (
                <p className="text-xs text-red-400 mt-1">{entry.error}</p>
              )}
            </div>

            {/* Status indicator */}
            <div className="shrink-0">
              {entry.status === 'fetching' && (
                <Loader2 className="w-4 h-4 text-[var(--accent-green-light)] animate-spin" />
              )}
              {entry.status === 'success' && (
                <Check className="w-4 h-4 text-[var(--accent-green)]" />
              )}
              {entry.status === 'error' && (
                <X className="w-4 h-4 text-red-400" />
              )}
            </div>

            {/* Remove button */}
            <button
              onClick={() => onRemove(idx)}
              disabled={disabled}
              className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-50"
              title="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-6">
          Add at least 2 brands to create a benchmark (1 baseline + 1 competitor)
        </p>
      )}
    </div>
  );
}
