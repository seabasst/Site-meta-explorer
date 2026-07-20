'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Moon, Sun, ArrowLeft, Layers, ArrowUpRight } from 'lucide-react';
import { ReportView } from './report-view';
import { formatNumber } from './components';
import type { SearchResponse } from './types';

function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    function readInitialTheme() {
      const stored = window.localStorage.getItem('analyze-theme');
      if (stored === 'dark' || stored === 'light') {
        setTheme(stored);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      }
    }
    readInitialTheme();
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem('analyze-theme', next);
      return next;
    });
  };

  return { theme, toggle };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

function SearchView() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse>({ brands: [], categories: [] });
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(query, 250);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/discover/search?q=${encodeURIComponent(debounced)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setResults(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const hasSuggestions = results.brands.length > 0 || results.categories.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1235e2]">Ad intelligence</p>
      <h1 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight text-slate-900 dark:text-white sm:text-5xl">
        Analyze a competitor,
        <br />
        or an entire category.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-500 dark:text-slate-400">
        Search any brand we track, or pick an industry. See their best-performing ads, best copy, and
        creator partnerships — built from public Meta Ad Library data.
      </p>

      <div ref={containerRef} className="relative mt-8">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] px-4 py-3.5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.06)]">
          <Search className="h-5 w-5 shrink-0 text-slate-400" strokeWidth={1.5} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search a brand — e.g. Gymshark, Meller, Charlotte Tilbury..."
            className="w-full bg-transparent text-base text-slate-900 placeholder:text-slate-400 outline-none dark:text-white dark:placeholder:text-slate-500"
          />
        </div>

        {open && (debounced.length > 0 ? hasSuggestions : true) && (
          <div className="absolute left-0 right-0 top-full z-10 mt-2 max-h-96 overflow-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151a2e] shadow-xl">
            {results.brands.length > 0 && (
              <div className="p-2">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Brands
                </p>
                {results.brands.map((b) => (
                  <button
                    key={b.pageId}
                    onClick={() => router.push(`/analyze?brand=${b.pageId}`)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-500 dark:bg-white/[0.08] dark:text-slate-400">
                      {b.profilePicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.profilePicUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        b.pageName.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {b.pageName}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                      {formatNumber(b.activeAdCount)} ads
                    </span>
                  </button>
                ))}
              </div>
            )}
            {results.categories.length > 0 && (
              <div className="border-t border-slate-100 p-2 dark:border-white/5">
                <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Categories
                </p>
                {results.categories.map((c) => (
                  <button
                    key={c.slug}
                    onClick={() => router.push(`/analyze?category=${c.slug}`)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1235e2]/10 text-[#1235e2]">
                      <Layers className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {c.label}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                      {c.brandCount} brands
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!hasSuggestions && debounced.length > 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                Nothing matching &ldquo;{debounced}&rdquo; yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalyzeClient() {
  const searchParams = useSearchParams();
  const { theme, toggle } = useTheme();

  const brandId = searchParams.get('brand');
  const categorySlug = searchParams.get('category');
  const target = useMemo(() => {
    if (brandId) return { type: 'brand' as const, id: brandId };
    if (categorySlug) return { type: 'category' as const, id: categorySlug };
    return null;
  }, [brandId, categorySlug]);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-[100dvh] bg-[#f6f6f8] dark:bg-[#101322]">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-[#f6f6f8]/80 backdrop-blur-md dark:border-white/10 dark:bg-[#101322]/80">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            {target ? (
              <Link
                href="/analyze"
                className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#1235e2] dark:text-slate-400"
              >
                <ArrowLeft className="h-4 w-4" /> New search
              </Link>
            ) : (
              <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                KiriMedia <span className="text-[#1235e2]">Analyze</span>
              </span>
            )}
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/v2"
                className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-[#1235e2] dark:text-slate-400"
              >
                Full dashboard <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={toggle}
                aria-label="Toggle theme"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:text-[#1235e2] dark:border-white/10 dark:text-slate-400"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 pb-24">
          {target ? (
            <div className="pt-10">
              <ReportView target={target} />
            </div>
          ) : (
            <SearchView />
          )}
        </main>
      </div>
    </div>
  );
}
