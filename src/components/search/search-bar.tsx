'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

interface SearchResult {
  pageId: string;
  pageName: string;
  iconUrl: string;
  adCount?: number;
}

interface SearchBarProps {
  onSelect: (pageId: string, pageName: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function SearchBar({
  onSelect,
  disabled = false,
  placeholder = 'Search for a brand...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const debouncedQuery = useDebounce(query, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Position the dropdown relative to the input
  const updateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, []);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetch(`/api/search-pages?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setResults(data.results ?? []);
        setIsOpen(true);
        setActiveIndex(-1);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Update position when dropdown opens or window scrolls/resizes
  useEffect(() => {
    if (!isOpen) return;
    updateDropdownPosition();

    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  // Close on outside click (check both the input container and the portaled dropdown)
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setQuery(result.pageName);
      setIsOpen(false);
      onSelect(result.pageId, result.pageName);
    },
    [onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const dropdownContent = isOpen && (
    <div ref={dropdownRef}>
      {results.length > 0 && (
        <ul
          style={dropdownStyle}
          className="py-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-xl max-h-80 overflow-y-auto"
        >
          {results.map((result, index) => (
            <li key={result.pageId}>
              <button
                type="button"
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  index === activeIndex
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.iconUrl}
                  alt=""
                  className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] object-cover flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="truncate flex-1">{result.pageName}</span>
                {result.adCount != null && (
                  <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                    {result.adCount} {result.adCount === 1 ? 'ad' : 'ads'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {results.length === 0 && !isLoading && debouncedQuery.length >= 2 && (
        <div
          style={dropdownStyle}
          className="py-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-xl text-center text-sm text-[var(--text-muted)]"
        >
          No pages found for &ldquo;{debouncedQuery}&rdquo;
        </div>
      )}
    </div>
  );

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        {/* Pill-shaped search input */}
        <div className="relative flex items-center">
          <Search className="absolute left-4 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!e.target.value.trim()) setIsOpen(false);
            }}
            onFocus={() => {
              if (results.length > 0 && query.length >= 2) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full pl-10 pr-4 py-3 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)] focus:ring-1 focus:ring-[var(--accent-green)] transition-colors disabled:opacity-50"
            autoComplete="off"
          />
          {isLoading && (
            <div className="absolute right-4 w-4 h-4 border-2 border-[var(--border-medium)] border-t-[var(--accent-green-light)] rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* Portal dropdown to body so it renders above all stacking contexts */}
      {typeof document !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
}
