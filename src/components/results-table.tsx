'use client';

import { useState, useMemo, useEffect } from 'react';
import { ClassifiedURL, URLCategory } from '@/lib/url-classifier';

interface AdData {
  url: string;
  count: number;
  adLibraryLinks: string[];
}

interface ResultsTableProps {
  urls: ClassifiedURL[];
  summary: Record<URLCategory, number>;
  analyzedUrl: string;
  totalUrls: number;
  adDestinationUrls?: string[];
  adCountMap?: Record<string, number>;
  adLibraryLinksMap?: Record<string, string[]>;
  totalActiveAds?: number;
}

type SortField = 'url' | 'lastmod' | 'category' | 'adCount';
type SortDirection = 'asc' | 'desc';

const CATEGORY_LABELS: Record<URLCategory, string> = {
  landing: 'Landing Pages',
  product: 'Products',
  collection: 'Collections',
  blog: 'Blog',
  account: 'Account',
  cart: 'Cart',
  other: 'Other',
};

const CATEGORY_CLASSES: Record<URLCategory, string> = {
  landing: 'cat-landing',
  product: 'cat-product',
  collection: 'cat-collection',
  blog: 'cat-blog',
  account: 'cat-account',
  cart: 'cat-cart',
  other: 'cat-other',
};

function formatDate(dateString?: string): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function parseDate(dateString?: string): number {
  if (!dateString) return 0;
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch {
    return 0;
  }
}

export function ResultsTable({
  urls,
  summary,
  analyzedUrl,
  totalUrls,
  adDestinationUrls = [],
  adCountMap = {},
  adLibraryLinksMap = {},
}: ResultsTableProps) {
  const [filter, setFilter] = useState<URLCategory | 'all'>('all');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('adCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showOnlyAdvertised, setShowOnlyAdvertised] = useState(false);
  const [hasAutoEnabledAdFilter, setHasAutoEnabledAdFilter] = useState(false);

  // Auto-enable "show only advertised" when ad data first becomes available
  useEffect(() => {
    if (adDestinationUrls.length > 0 && !hasAutoEnabledAdFilter) {
      setShowOnlyAdvertised(true);
      setHasAutoEnabledAdFilter(true);
    }
  }, [adDestinationUrls.length, hasAutoEnabledAdFilter]);

  // Build list of ad data for the advertised view
  const adDataList = useMemo((): AdData[] => {
    return adDestinationUrls.map(url => ({
      url,
      count: adCountMap[url] || 1,
      adLibraryLinks: adLibraryLinksMap[url] || [],
    })).sort((a, b) => b.count - a.count);
  }, [adDestinationUrls, adCountMap, adLibraryLinksMap]);

  const filteredAndSortedUrls = useMemo(() => {
    const filtered = filter === 'all' ? urls : urls.filter((url) => url.category === filter);

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'url':
          comparison = a.path.localeCompare(b.path);
          break;
        case 'lastmod':
          comparison = parseDate(a.lastmod) - parseDate(b.lastmod);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'adCount':
          comparison = a.path.localeCompare(b.path);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [urls, filter, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'lastmod' || field === 'adCount' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-3.5 h-3.5 text-[var(--accent-green-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5 text-[var(--accent-green-light)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const hostname = (() => {
    try {
      return new URL(analyzedUrl).hostname;
    } catch {
      return analyzedUrl;
    }
  })();

  return (
    <div className="w-full">
      {/* Summary Section */}
      <div className="glass rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="font-serif text-xl text-[var(--text-primary)] mb-1">
              Analysis for{' '}
              <a
                href={analyzedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent-green-light)] hover:underline"
              >
                {hostname}
              </a>
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {totalUrls.toLocaleString()} URLs discovered and categorized
            </p>
          </div>
        </div>

        {/* Category Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
          {(Object.entries(summary) as [URLCategory, number][]).map(([category, count]) => (
            <button
              key={category}
              onClick={() => { setFilter(category); setShowOnlyAdvertised(false); }}
              className={`relative p-3 rounded-xl text-center transition-all duration-200 ${
                filter === category && !showOnlyAdvertised
                  ? 'ring-2 ring-[var(--accent-green-light)] ring-offset-2 ring-offset-[var(--bg-primary)]'
                  : 'hover:bg-[var(--bg-elevated)]'
              } ${CATEGORY_CLASSES[category]}`}
            >
              <div className="text-xl font-bold">{count.toLocaleString()}</div>
              <div className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                {CATEGORY_LABELS[category]}
              </div>
            </button>
          ))}
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setFilter('all'); setShowOnlyAdvertised(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              filter === 'all' && !showOnlyAdvertised
                ? 'bg-[var(--accent-green)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-medium)]'
            }`}
          >
            All URLs ({totalUrls.toLocaleString()})
          </button>
          {adDestinationUrls.length > 0 && (
            <button
              onClick={() => setShowOnlyAdvertised(!showOnlyAdvertised)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                showOnlyAdvertised
                  ? 'bg-[var(--cat-landing)] text-[var(--bg-primary)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--cat-landing)] border border-[var(--cat-landing-bg)] hover:bg-[var(--cat-landing-bg)]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Advertised ({adDestinationUrls.length})
            </button>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="font-medium text-[var(--text-primary)]">
            {showOnlyAdvertised ? 'Advertised Pages' : (filter === 'all' ? 'All URLs' : CATEGORY_LABELS[filter])}
            <span className="ml-2 text-sm text-[var(--text-muted)]">
              ({showOnlyAdvertised ? adDataList.length : filteredAndSortedUrls.length})
            </span>
          </h3>
        </div>

        {/* Advertised URLs Table */}
        {showOnlyAdvertised ? (
          adDataList.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-[var(--text-muted)] opacity-50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[var(--text-muted)]">No advertised URLs found</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>Destination URL</th>
                    <th className="w-24">Ad Count</th>
                    <th className="w-40">View in Ad Library</th>
                    <th className="w-16">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {adDataList.map((ad, index) => (
                    <tr key={index}>
                      <td>
                        <a
                          href={ad.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--text-primary)] hover:text-[var(--accent-green-light)] transition-colors text-sm break-all"
                        >
                          {ad.url.replace(/^https?:\/\//, '')}
                        </a>
                      </td>
                      <td>
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 text-xs font-bold rounded-lg bg-[var(--accent-yellow)] text-[#1c1c0d]">
                          {ad.count}
                        </span>
                      </td>
                      <td>
                        {ad.adLibraryLinks.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {ad.adLibraryLinks.slice(0, 3).map((link, linkIndex) => (
                              <a
                                key={linkIndex}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--bg-elevated)] text-[var(--accent-green-light)] hover:bg-[var(--border-subtle)] transition-colors"
                              >
                                Ad {linkIndex + 1}
                              </a>
                            ))}
                            {ad.adLibraryLinks.length > 3 && (
                              <span className="text-xs text-[var(--text-muted)]">
                                +{ad.adLibraryLinks.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => copyToClipboard(ad.url)}
                          className="p-3 sm:p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                          title="Copy URL"
                        >
                          {copiedUrl === ad.url ? (
                            <svg className="w-4 h-4 text-[var(--cat-landing)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Sitemap URLs Table */
          filteredAndSortedUrls.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-[var(--text-muted)] opacity-50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[var(--text-muted)]">No URLs found in this category</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <table className="data-table min-w-[640px]">
                <thead>
                  <tr>
                    <th>
                      <button
                        onClick={() => handleSort('url')}
                        className="flex items-center gap-1.5 hover:text-[var(--text-secondary)] transition-colors"
                      >
                        URL
                        <SortIcon field="url" />
                      </button>
                    </th>
                    <th className="w-32">
                      <button
                        onClick={() => handleSort('lastmod')}
                        className="flex items-center gap-1.5 hover:text-[var(--text-secondary)] transition-colors"
                      >
                        Modified
                        <SortIcon field="lastmod" />
                      </button>
                    </th>
                    <th className="w-28">
                      <button
                        onClick={() => handleSort('category')}
                        className="flex items-center gap-1.5 hover:text-[var(--text-secondary)] transition-colors"
                      >
                        Type
                        <SortIcon field="category" />
                      </button>
                    </th>
                    <th className="w-16">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedUrls.map((url, index) => (
                    <tr key={index}>
                      <td>
                        <a
                          href={url.loc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--text-primary)] hover:text-[var(--accent-green-light)] transition-colors text-sm break-all"
                        >
                          {url.path}
                        </a>
                      </td>
                      <td className="text-sm text-[var(--text-muted)]">
                        {formatDate(url.lastmod)}
                      </td>
                      <td>
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-lg ${CATEGORY_CLASSES[url.category]}`}>
                          {CATEGORY_LABELS[url.category]}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => copyToClipboard(url.loc)}
                          className="p-3 sm:p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
                          title="Copy URL"
                        >
                          {copiedUrl === url.loc ? (
                            <svg className="w-4 h-4 text-[var(--cat-landing)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
