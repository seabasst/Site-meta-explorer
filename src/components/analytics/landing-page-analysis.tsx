'use client';

import { useMemo } from 'react';
import type { FacebookAdResult } from '@/lib/facebook-api';

interface LandingPageAnalysisProps {
  // API result ads (have linkCaption but no destination URL)
  apiAds?: FacebookAdResult[];
  // Optional sitemap URLs to cross-reference
  sitemapUrls?: string[];
}

interface LandingPageData {
  url: string;
  displayUrl: string;
  adCount: number;
  totalReach: number;
  isInSitemap: boolean;
  topCreatives: string[];
  firstSeen: string | null;
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function formatUrl(url: string, maxLength: number = 50): string {
  const withoutProtocol = url.replace(/^https?:\/\//, '').replace('www.', '');
  if (withoutProtocol.length <= maxLength) return withoutProtocol;
  return withoutProtocol.slice(0, maxLength - 3) + '...';
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function LandingPageAnalysis({ apiAds, sitemapUrls }: LandingPageAnalysisProps) {
  const analysis = useMemo(() => {
    const landingPages = new Map<string, LandingPageData>();
    const sitemapSet = new Set(sitemapUrls?.map(u => u.toLowerCase()) || []);

    // Process API data (group by link caption)
    if (apiAds && apiAds.length > 0) {
      // Group by linkCaption which often contains domain/path
      const captionGroups = new Map<string, FacebookAdResult[]>();

      for (const ad of apiAds) {
        const key = ad.linkCaption || ad.linkTitle || 'unknown';
        const group = captionGroups.get(key) || [];
        group.push(ad);
        captionGroups.set(key, group);
      }

      for (const [caption, ads] of captionGroups) {
        const totalReach = ads.reduce((sum, ad) => sum + ad.euTotalReach, 0);
        const earliestDate = ads
          .map(ad => ad.startedRunning)
          .filter((d): d is string => d !== null)
          .sort()[0] || null;

        const topCreatives = [...new Set(
          ads
            .map(ad => ad.linkTitle)
            .filter((t): t is string => t !== null)
        )].slice(0, 3);

        // Use caption as URL proxy
        const normalizedCaption = caption.toLowerCase();
        const isInSitemap = sitemapSet.has(normalizedCaption) ||
          Array.from(sitemapSet).some(sitemapUrl =>
            sitemapUrl.includes(normalizedCaption)
          );

        landingPages.set(caption, {
          url: caption,
          displayUrl: caption,
          adCount: ads.length,
          totalReach,
          isInSitemap,
          topCreatives,
          firstSeen: earliestDate,
        });
      }
    }

    // Convert to sorted array
    const sorted = Array.from(landingPages.values())
      .sort((a, b) => {
        // Sort by reach first, then by ad count
        if (a.totalReach !== b.totalReach) return b.totalReach - a.totalReach;
        return b.adCount - a.adCount;
      });

    // Calculate stats
    const totalReach = sorted.reduce((sum, lp) => sum + lp.totalReach, 0);
    const totalAds = sorted.reduce((sum, lp) => sum + lp.adCount, 0);
    const inSitemapCount = sorted.filter(lp => lp.isInSitemap).length;

    // Group by domain
    const domainStats = new Map<string, { reach: number; ads: number; pages: number }>();
    for (const lp of sorted) {
      const domain = extractDomain(lp.url);
      const existing = domainStats.get(domain) || { reach: 0, ads: 0, pages: 0 };
      existing.reach += lp.totalReach;
      existing.ads += lp.adCount;
      existing.pages += 1;
      domainStats.set(domain, existing);
    }

    const topDomains = Array.from(domainStats.entries())
      .map(([domain, stats]) => ({ domain, ...stats }))
      .sort((a, b) => b.reach - a.reach || b.ads - a.ads)
      .slice(0, 5);

    return {
      landingPages: sorted,
      totalReach,
      totalAds,
      totalPages: sorted.length,
      inSitemapCount,
      topDomains,
      hasReachData: totalReach > 0,
    };
  }, [apiAds, sitemapUrls]);

  if (analysis.landingPages.length === 0) {
    return (
      <div className="text-center py-6 text-[var(--text-muted)]">
        No landing page data available.
      </div>
    );
  }

  const maxReach = Math.max(...analysis.landingPages.map(lp => lp.totalReach), 1);
  const maxAds = Math.max(...analysis.landingPages.map(lp => lp.adCount), 1);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Landing Pages</div>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {analysis.totalPages}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">unique destinations</div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">Total Ads</div>
          <div className="text-2xl font-bold text-[var(--accent-yellow)]">
            {analysis.totalAds}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">pointing to these pages</div>
        </div>

        {analysis.hasReachData && (
          <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
            <div className="text-xs text-[var(--text-muted)] mb-1">Total Reach</div>
            <div className="text-2xl font-bold text-[var(--accent-green)]">
              {formatNumber(analysis.totalReach)}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">people reached</div>
          </div>
        )}

        {analysis.inSitemapCount > 0 && (
          <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
            <div className="text-xs text-[var(--text-muted)] mb-1">In Sitemap</div>
            <div className="text-2xl font-bold text-blue-400">
              {analysis.inSitemapCount}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              of {analysis.totalPages} pages
            </div>
          </div>
        )}
      </div>

      {/* Top Domains */}
      {analysis.topDomains.length > 1 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Top Domains</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.topDomains.map((domain, index) => (
              <div
                key={domain.domain}
                className={`px-3 py-2 rounded-lg border ${
                  index === 0
                    ? 'bg-[var(--accent-green)]/10 border-[var(--accent-green)]/30 text-[var(--accent-green)]'
                    : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="text-sm font-medium">{domain.domain}</div>
                <div className="text-xs opacity-70">
                  {domain.pages} pages • {domain.ads} ads
                  {domain.reach > 0 && ` • ${formatNumber(domain.reach)} reach`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Landing Page List */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Landing Pages by {analysis.hasReachData ? 'Reach' : 'Ad Count'}
        </h4>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {analysis.landingPages.slice(0, 20).map((lp, index) => (
            <div
              key={lp.url}
              className="p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-default)] transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-muted)] tabular-nums w-5">
                      {index + 1}.
                    </span>
                    <a
                      href={lp.url.startsWith('http') ? lp.url : `https://${lp.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-green)] truncate transition-colors"
                      title={lp.url}
                    >
                      {lp.displayUrl}
                    </a>
                    {lp.isInSitemap && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        IN SITEMAP
                      </span>
                    )}
                  </div>

                  {/* Reach/Ad bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-yellow)] rounded-full transition-all duration-500"
                        style={{
                          width: `${analysis.hasReachData
                            ? (lp.totalReach / maxReach) * 100
                            : (lp.adCount / maxAds) * 100
                          }%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                      {analysis.hasReachData && (
                        <span className="font-medium text-[var(--accent-green)]">
                          {formatNumber(lp.totalReach)} reach
                        </span>
                      )}
                      <span className={analysis.hasReachData ? '' : 'font-medium text-[var(--accent-yellow)]'}>
                        {lp.adCount} ads
                      </span>
                    </div>
                  </div>

                  {/* Top creatives */}
                  {lp.topCreatives.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {lp.topCreatives.slice(0, 2).map((creative, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] truncate max-w-[200px]"
                          title={creative}
                        >
                          {creative}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* First seen date */}
                {lp.firstSeen && (
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-[var(--text-muted)]">First seen</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {new Date(lp.firstSeen).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {analysis.landingPages.length > 20 && (
          <div className="mt-3 text-center text-xs text-[var(--text-muted)]">
            Showing top 20 of {analysis.landingPages.length} landing pages
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--accent-yellow)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Key Insights
        </h4>
        <ul className="text-sm text-[var(--text-secondary)] space-y-1.5">
          {analysis.landingPages.length > 0 && (
            <li className="flex gap-2">
              <span className="text-[var(--accent-green)]">•</span>
              <span>
                Top landing page {analysis.hasReachData ? 'gets' : 'has'}{' '}
                <strong className="text-[var(--text-primary)]">
                  {analysis.hasReachData
                    ? `${formatNumber(analysis.landingPages[0].totalReach)} reach`
                    : `${analysis.landingPages[0].adCount} ads`
                  }
                </strong>
                {' '}— {analysis.landingPages[0].displayUrl}
              </span>
            </li>
          )}
          {analysis.totalPages > 1 && (
            <li className="flex gap-2">
              <span className="text-[var(--accent-green)]">•</span>
              <span>
                Top 3 pages account for{' '}
                <strong className="text-[var(--text-primary)]">
                  {Math.round(
                    (analysis.landingPages.slice(0, 3).reduce((sum, lp) =>
                      sum + (analysis.hasReachData ? lp.totalReach : lp.adCount), 0
                    ) / (analysis.hasReachData ? analysis.totalReach : analysis.totalAds)) * 100
                  )}%
                </strong>
                {' '}of total {analysis.hasReachData ? 'reach' : 'ads'}
              </span>
            </li>
          )}
          {analysis.inSitemapCount > 0 && (
            <li className="flex gap-2">
              <span className="text-blue-400">•</span>
              <span>
                <strong className="text-[var(--text-primary)]">{analysis.inSitemapCount}</strong> advertised pages match your sitemap
                ({Math.round((analysis.inSitemapCount / analysis.totalPages) * 100)}%)
              </span>
            </li>
          )}
          {analysis.topDomains.length > 1 && (
            <li className="flex gap-2">
              <span className="text-[var(--accent-yellow)]">•</span>
              <span>
                Ads drive traffic to <strong className="text-[var(--text-primary)]">{analysis.topDomains.length}</strong> different domains
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
