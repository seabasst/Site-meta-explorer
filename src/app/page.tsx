'use client';

import { useState } from 'react';
import { ResultsTable } from '@/components/results-table';
import { analyzeSitemap, AnalysisResult } from '@/actions/analyze-sitemap';
import { AdLibraryResult } from '@/lib/ad-library-scraper';
import { AdLibraryResultWithDemographics } from '@/lib/demographic-types';
import { ScrapeConfig } from '@/components/demographics/scrape-config';
import { DemographicsSummary } from '@/components/demographics/demographics-summary';
import { AgeGenderChart } from '@/components/demographics/age-gender-chart';
import { CountryChart } from '@/components/demographics/country-chart';
// Media type chart temporarily disabled
// import { MediaTypeChart } from '@/components/demographics/media-type-chart';
import { ProductMarketTable } from '@/components/analytics/product-market-table';
// Spend analysis temporarily disabled - updating CPM benchmarks
// import { SpendAnalysisSection } from '@/components/spend/spend-analysis';
import type { FacebookApiResult } from '@/lib/facebook-api';

type DataSource = 'api' | 'scraper';

function HowItWorksSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="info-box animate-fade-in-up stagger-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-[var(--accent-yellow)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold text-[var(--text-primary)]">How does this work?</span>
        </div>
        <svg
          className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="mt-5 space-y-5 animate-fade-in">
          {/* Steps */}
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="step-number">1</div>
              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-1">Sitemap Discovery</h4>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  We fetch and parse the website&apos;s XML sitemap to discover all public URLs. This includes checking common paths like /sitemap.xml, /sitemap_index.xml, and nested sitemaps.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="step-number">2</div>
              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-1">URL Classification</h4>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Each URL is automatically categorized into Landing Pages, Products, Collections, Blog posts, Account pages, or Cart/Checkout based on URL patterns and structure.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="step-number">3</div>
              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-1">Ad Library Cross-Reference</h4>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Optionally, paste a Facebook Ad Library URL to see which of these pages are being actively advertised. We&apos;ll match ad destinations to your sitemap URLs.
                </p>
              </div>
            </div>
          </div>

          {/* Why not all ads callout */}
          <div className="mt-6 p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-[var(--accent-green-light)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="font-semibold text-[var(--text-primary)] mb-2">Why don&apos;t all ads show up?</h4>
                <ul className="text-sm text-[var(--text-secondary)] space-y-2">
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-yellow)]">•</span>
                    <span><strong className="text-[var(--text-primary)]">Ad Variations:</strong> Advertisers often run many ad creatives (different images, copy, videos) that all point to the same landing page. If they have 100 ads but only 10 unique landing pages, you&apos;ll see 10 URLs with high ad counts.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-yellow)]">•</span>
                    <span><strong className="text-[var(--text-primary)]">A/B Testing:</strong> Brands test multiple ad versions targeting different audiences, all leading to the same destination.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-yellow)]">•</span>
                    <span><strong className="text-[var(--text-primary)]">Dynamic URLs:</strong> Some ads use tracking parameters or redirect URLs that may not exactly match sitemap URLs.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[var(--accent-yellow)]">•</span>
                    <span><strong className="text-[var(--text-primary)]">External Pages:</strong> Ads may link to pages not in the sitemap (Shopify checkouts, Linktree, app stores, etc.).</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-6 h-6 border-[3px]',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full border-[var(--border-medium)] border-t-[var(--accent-green-light)] animate-spin`} />
  );
}

// Example brands with their Ad Library URLs
const EXAMPLE_BRANDS = [
  { name: 'Allbirds', domain: 'allbirds.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=778794852137593' },
  { name: 'Gymshark', domain: 'gymshark.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=129669023798560' },
  { name: 'Glossier', domain: 'glossier.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=1392545734334646' },
  { name: 'SKIMS', domain: 'skims.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=2054164264892387' },
  { name: 'Estrid', domain: 'estrid.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=2350793288288464' },
  { name: 'Ninepine', domain: 'ninepine.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=829738024024491' },
];

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState('');

  // Ad Library state
  const [adLibraryUrl, setAdLibraryUrl] = useState('');
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [adResult, setAdResult] = useState<AdLibraryResult | null>(null);
  const [adError, setAdError] = useState<string | null>(null);

  // Demographics configuration (default 3 for faster execution on serverless)
  const [maxDemographicAds, setMaxDemographicAds] = useState(3);

  // Demographics loading progress
  const [demographicsProgress, setDemographicsProgress] = useState<{ current: number; total: number } | null>(null);

  // Data source selection: 'api' uses official Facebook API (faster, requires token), 'scraper' uses Puppeteer
  const [dataSource, setDataSource] = useState<DataSource>('api');

  // Facebook API result (different structure from scraper)
  const [apiResult, setApiResult] = useState<FacebookApiResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setAdResult(null);

    try {
      const response = await analyzeSitemap(inputUrl.trim());

      if (response.success) {
        setResult(response);
      } else {
        setError(response.error);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickStart = (site: string, adLibUrl?: string) => {
    setInputUrl(site);
    if (adLibUrl) {
      setAdLibraryUrl(adLibUrl);
    }
    setIsLoading(true);
    setError(null);
    setResult(null);
    setAdResult(null);

    analyzeSitemap(site)
      .then((response) => {
        if (response.success) {
          setResult(response);
        } else {
          setError(response.error);
        }
      })
      .catch(() => {
        setError('An unexpected error occurred. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleAdLibrarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adLibraryUrl.trim()) return;

    setIsLoadingAds(true);
    setAdError(null);
    setAdResult(null);
    setApiResult(null);
    setDemographicsProgress({ current: 0, total: maxDemographicAds });

    try {
      if (dataSource === 'api') {
        // Use official Facebook API (faster, includes demographics automatically)
        const res = await fetch('/api/facebook-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adLibraryUrl: adLibraryUrl.trim(),
            countries: ['NL', 'DE', 'FR', 'BE'], // EU countries for DSA data
            limit: 250, // Reduced from 1000 to avoid Facebook API payload limits
          }),
        });

        const response = await res.json();

        if (response.success) {
          setApiResult(response);
        } else {
          setAdError(response.error);
        }
      } else {
        // Use Puppeteer scraper (slower, but works without API token)
        const res = await fetch('/api/scrape-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adLibraryUrl: adLibraryUrl.trim(),
            scrapeDemographics: true,
            maxDemographicAds: maxDemographicAds,
          }),
        });

        const response = await res.json();

        if (response.success) {
          setAdResult(response);
        } else {
          setAdError(response.error);
        }
      }
    } catch {
      setAdError('Failed to fetch Ad Library data. Please try again.');
    } finally {
      setIsLoadingAds(false);
      setDemographicsProgress(null);
    }
  };

  // Extract destination URLs and their ad counts (handle both API and scraper results)
  const adDestinationUrls = (() => {
    if (apiResult) {
      // API result - no destination URLs, but we can still use it for demographics
      return [];
    }
    return adResult?.ads
      .map((ad) => ad.destinationUrl)
      .filter((url): url is string => url !== null) || [];
  })();

  // Create a map of URL -> ad count
  const adCountMap: Record<string, number> = {};
  adResult?.ads.forEach((ad) => {
    if (ad.destinationUrl) {
      adCountMap[ad.destinationUrl] = ad.adCount;
    }
  });

  // Create a map of URL -> ad library links
  const adLibraryLinksMap: Record<string, string[]> = {};
  adResult?.ads.forEach((ad) => {
    if (ad.destinationUrl && ad.adLibraryLinks.length > 0) {
      adLibraryLinksMap[ad.destinationUrl] = ad.adLibraryLinks;
    }
  });

  // Get total active ads - prefer Facebook's count, fallback to sum of found ads
  const totalActiveAds = apiResult?.totalAdsFound
    ?? adResult?.totalActiveAdsOnPage
    ?? adResult?.ads.reduce((sum, ad) => sum + ad.adCount, 0)
    ?? 0;

  // Get the active result (API or scraper)
  const activeAdResult = apiResult || adResult;

  return (
    <>
      {/* Background effects */}
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <main className="min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-16">
          {/* Header */}
          <header className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-yellow)] animate-pulse-subtle" />
              Competitive Intelligence Tool
            </div>
            <h1 className="font-serif text-5xl md:text-6xl text-[var(--text-primary)] mb-5 tracking-tight">
              Facebook Ad Library <span className="text-[var(--accent-green-light)] italic">Analyser</span>
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
              Analyse your competitors&apos; Facebook ads. Get demographics, reach data, and audience insights.
            </p>
          </header>

          {/* Main Ad Library Form */}
          <form onSubmit={handleAdLibrarySubmit} className="mb-8 animate-fade-in-up stagger-1">
            <div className="glass rounded-2xl p-6 glow-gold">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                Enter a Facebook Ad Library URL
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={adLibraryUrl}
                  onChange={(e) => setAdLibraryUrl(e.target.value)}
                  placeholder="https://www.facebook.com/ads/library/?...&view_all_page_id=..."
                  className="input-field flex-1"
                  disabled={isLoadingAds}
                />
                <button
                  type="submit"
                  disabled={isLoadingAds || !adLibraryUrl.trim()}
                  className="btn-primary flex items-center gap-2 whitespace-nowrap"
                >
                  {isLoadingAds ? (
                    <>
                      <LoadingSpinner size="sm" />
                      <span>Analysing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>Analyse Ads</span>
                    </>
                  )}
                </button>
              </div>

              {/* Data Source Toggle */}
              <div className="mt-4 flex items-center gap-4">
                <span className="text-xs text-[var(--text-muted)]">Data source:</span>
                <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setDataSource('api')}
                    disabled={isLoadingAds}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      dataSource === 'api'
                        ? 'bg-[var(--accent-green)] text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
                    }`}
                  >
                    Official API
                  </button>
                  <button
                    type="button"
                    onClick={() => setDataSource('scraper')}
                    disabled={isLoadingAds}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      dataSource === 'scraper'
                        ? 'bg-[var(--accent-green)] text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
                    }`}
                  >
                    Scraper
                  </button>
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {dataSource === 'api' ? '(Faster, includes demographics)' : '(Slower, extracts destination URLs)'}
                </span>
              </div>

              {dataSource === 'scraper' && (
                <div className="mt-4">
                  <ScrapeConfig
                    maxAds={maxDemographicAds}
                    onMaxAdsChange={setMaxDemographicAds}
                    disabled={isLoadingAds}
                  />
                </div>
              )}

              {/* Quick start examples */}
              {!apiResult && !adResult && !isLoadingAds && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-[var(--text-muted)]">Examples:</span>
                  {EXAMPLE_BRANDS.map((brand) => (
                    <button
                      key={brand.domain}
                      type="button"
                      onClick={() => setAdLibraryUrl(brand.adLibrary)}
                      className="text-xs px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-green)] hover:border-[var(--accent-green)] transition-colors"
                    >
                      {brand.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>

          {/* Sitemap Analysis - Collapsible */}
          {!apiResult && !adResult && !isLoadingAds && (
            <details className="mb-8 animate-fade-in-up stagger-2">
              <summary className="cursor-pointer list-none">
                <div className="glass rounded-2xl p-4 hover:bg-[var(--bg-elevated)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-[var(--accent-yellow)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                      </svg>
                      <span className="font-medium text-[var(--text-primary)]">Sitemap Analysis</span>
                      <span className="text-xs text-[var(--text-muted)]">(Optional: Cross-reference with website URLs)</span>
                    </div>
                    <svg className="w-5 h-5 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </summary>
              <div className="mt-2 glass rounded-2xl p-6">
                <form onSubmit={handleSubmit}>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                    Enter a website URL to analyse its sitemap
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="example.com or https://example.com"
                      className="input-field flex-1"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !inputUrl.trim()}
                      className="btn-secondary flex items-center gap-2 whitespace-nowrap"
                    >
                      {isLoading ? (
                        <>
                          <LoadingSpinner size="sm" />
                          <span>Analysing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span>Analyse Sitemap</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </details>
          )}

          {/* How it works section */}
          {!result && !apiResult && !adResult && !isLoading && !isLoadingAds && <HowItWorksSection />}

          {/* Error Message */}
          {error && (
            <div className="mb-8 p-4 rounded-xl bg-red-50 border border-red-200 animate-fade-in">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-16 animate-fade-in">
              <div className="inline-flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-2 border-[var(--border-medium)] border-t-[var(--accent-green-light)] animate-spin" />
                  <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-transparent border-b-[var(--accent-green-light)] animate-spin opacity-30" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                </div>
                <div className="text-center">
                  <p className="text-[var(--text-primary)] font-medium">Analyzing sitemap...</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">Fetching and categorizing URLs</p>
                </div>
              </div>
            </div>
          )}

          {/* Ad Library Results - Full Width */}
          {(apiResult || adResult || isLoadingAds) && (
            <div className="animate-fade-in mb-8">
              <div className="glass rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-serif text-xl text-[var(--text-primary)] mb-1">
                      Facebook Ad Library <span className="italic text-[var(--accent-green-light)]">Analysis</span>
                    </h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Cross-reference with active Facebook ads to see which pages are being promoted
                    </p>
                  </div>
                  {(apiResult || adResult) && (
                    <div className="flex items-center gap-4 text-right">
                      {apiResult ? (
                        <>
                          <div>
                            <div className="text-2xl font-bold text-[var(--accent-yellow)]">
                              {apiResult.ads.reduce((sum, ad) => sum + ad.euTotalReach, 0).toLocaleString()}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">Total EU Reach</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">
                              {apiResult.totalAdsFound}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">Ads Analysed</div>
                          </div>
                        </>
                      ) : adResult && (
                        <>
                          {adResult.totalActiveAdsOnPage && (
                            <div>
                              <div className="text-2xl font-bold text-[var(--accent-yellow)]">
                                {adResult.totalActiveAdsOnPage.toLocaleString()}
                              </div>
                              <div className="text-xs text-[var(--text-muted)]">Total Active Ads</div>
                            </div>
                          )}
                          <div>
                            <div className="text-2xl font-bold text-[var(--text-primary)]">
                              {adResult.totalAdsFound}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">Unique URLs</div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Ad Library Loading */}
                {isLoadingAds && (
                  <div className="mt-4 text-center py-8">
                    <div className="inline-flex flex-col items-center gap-3">
                      <LoadingSpinner size="lg" />
                      <div className="text-center">
                        <p className="text-[var(--text-primary)] font-medium">
                          Analysing ads...
                        </p>
                        {demographicsProgress && (
                          <p className="text-sm text-[var(--text-muted)] mt-1">
                            {demographicsProgress.current} of {demographicsProgress.total} ads to process
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ad Library Error */}
                {adError && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-600 text-sm">{adError}</p>
                  </div>
                )}

                {/* Ad Library Results Summary - API Result */}
                {apiResult && (
                  <div className="mt-4 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-[var(--cat-landing)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium text-[var(--text-primary)]">
                        {apiResult.pageName || `Page ${apiResult.pageId}`}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-green)] text-[#1c1c0d]">
                        via API
                      </span>
                    </div>
                    {apiResult.ads.length > 0 && (
                      <div className="text-sm text-[var(--text-secondary)]">
                        <p className="mb-2">Top performing ads by reach:</p>
                        <div className="flex flex-wrap gap-2">
                          {apiResult.ads.slice(0, 5).map((ad, index) => (
                            <a
                              key={index}
                              href={`https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] transition-colors text-xs"
                            >
                              <span className="truncate max-w-[200px]">{ad.linkTitle || ad.creativeBody?.slice(0, 30) || `Ad ${ad.adId}`}</span>
                              <span className="text-[var(--accent-yellow)] font-medium">({ad.euTotalReach.toLocaleString()} reach)</span>
                            </a>
                          ))}
                          {apiResult.ads.length > 5 && (
                            <span className="px-2.5 py-1 text-xs text-[var(--text-muted)]">
                              +{apiResult.ads.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="mt-3 text-xs text-[var(--text-muted)]">
                      Countries: {apiResult.metadata.countries.join(', ')} • Fetched: {new Date(apiResult.metadata.fetchedAt).toLocaleTimeString()}
                    </div>
                  </div>
                )}

                {/* Ad Library Results Summary - Scraper Result */}
                {adResult && !apiResult && (
                  <div className="mt-4 p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-[var(--cat-landing)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="font-medium text-[var(--text-primary)]">
                        {adResult.pageName || `Page ${adResult.pageId}`}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-yellow)] text-[#1c1c0d]">
                        via Scraper
                      </span>
                    </div>
                    {adResult.ads.length > 0 && (
                      <div className="text-sm text-[var(--text-secondary)]">
                        <p className="mb-2">Top advertised destinations:</p>
                        <div className="flex flex-wrap gap-2">
                          {adResult.ads.slice(0, 5).map((ad, index) => (
                            <a
                              key={index}
                              href={ad.destinationUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--border-subtle)] transition-colors text-xs"
                            >
                              <span className="truncate max-w-[200px]">{ad.destinationUrl?.replace(/^https?:\/\/[^/]+/, '')}</span>
                              <span className="text-[var(--accent-yellow)] font-medium">({ad.adCount})</span>
                            </a>
                          ))}
                          {adResult.ads.length > 5 && (
                            <span className="px-2.5 py-1 text-xs text-[var(--text-muted)]">
                              +{adResult.ads.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* All Active Ads - expandable list (API Result) */}
                {apiResult && apiResult.ads.length > 0 && (
                  <div className="mt-4">
                    <details className="group">
                      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-green-light)] transition-colors">
                        <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        View all {apiResult.totalAdsFound} ads
                      </summary>
                      <div className="mt-3 max-h-[400px] overflow-y-auto rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)]">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Ad Content</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide w-24">EU Reach</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide w-24">Targeting</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide w-20">View</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-subtle)]">
                            {apiResult.ads.map((ad, index) => (
                              <tr key={index} className="hover:bg-[var(--bg-elevated)] transition-colors">
                                <td className="px-4 py-3">
                                  <div className="max-w-[300px]">
                                    <div className="text-[var(--text-primary)] font-medium truncate">
                                      {ad.linkTitle || 'No title'}
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                                      {ad.creativeBody?.slice(0, 60) || 'No description'}...
                                    </div>
                                    <div className="text-xs text-[var(--text-muted)] mt-1">
                                      Started: {ad.startedRunning || 'Unknown'}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 text-xs font-bold rounded-lg bg-[var(--accent-yellow)] text-[#1c1c0d]">
                                    {ad.euTotalReach.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <div className="text-xs text-[var(--text-secondary)]">
                                    <div>{ad.targeting.gender}</div>
                                    <div>{ad.targeting.ageMin}-{ad.targeting.ageMax}</div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <a
                                    href={`https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-[var(--bg-elevated)] text-[var(--accent-green-light)] hover:bg-[var(--border-subtle)] transition-colors"
                                  >
                                    View
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                )}

                {/* All Active Ads - expandable list (Scraper Result) */}
                {adResult && !apiResult && adResult.ads.length > 0 && (
                  <div className="mt-4">
                    <details className="group">
                      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-green-light)] transition-colors">
                        <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        View all {Object.values(adLibraryLinksMap).flat().length || adResult.ads.reduce((sum, ad) => sum + ad.adCount, 0)} active ads
                      </summary>
                      <div className="mt-3 max-h-[400px] overflow-y-auto rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-[var(--bg-tertiary)] border-b border-[var(--border-subtle)]">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Destination URL</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide w-20">Variants</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide w-32">View Ads</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-subtle)]">
                            {adResult.ads.map((ad, index) => (
                              <tr key={index} className="hover:bg-[var(--bg-elevated)] transition-colors">
                                <td className="px-4 py-3">
                                  <a
                                    href={ad.destinationUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[var(--text-secondary)] hover:text-[var(--accent-green-light)] transition-colors truncate block max-w-[400px]"
                                    title={ad.destinationUrl || ''}
                                  >
                                    {ad.destinationUrl?.replace(/^https?:\/\//, '') || 'Unknown'}
                                  </a>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-1 text-xs font-bold rounded-lg bg-[var(--accent-yellow)] text-[#1c1c0d]">
                                    {ad.adCount}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {ad.adLibraryLinks.length > 0 ? (
                                    <div className="flex items-center justify-end gap-1 flex-wrap">
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
                                    <span className="text-xs text-[var(--text-muted)]">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </div>
                )}

                {/* Info about ad variations - show when we have scraper data */}
                {adResult && !apiResult && adResult.totalActiveAdsOnPage && adResult.totalActiveAdsOnPage > adResult.totalAdsFound && (
                  <div className="mt-4 flex gap-2 text-xs text-[var(--text-muted)]">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      {adResult.totalActiveAdsOnPage.toLocaleString()} total ads point to {adResult.totalAdsFound} unique URLs.
                      The difference represents ad variations (different creatives, copy, or audiences) targeting the same landing pages.
                    </span>
                  </div>
                )}

                {/* Info about API data source */}
                {apiResult && (
                  <div className="mt-4 flex gap-2 text-xs text-[var(--text-muted)]">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>
                      Data fetched via official Facebook API. Demographics based on EU DSA transparency requirements.
                      Reach numbers represent people reached in selected EU countries.
                    </span>
                  </div>
                )}

                {/* Demographics Results - API */}
                {apiResult && apiResult.aggregatedDemographics && (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-lg text-[var(--text-primary)]">
                        Audience <span className="italic text-[var(--accent-green-light)]">Demographics</span>
                      </h3>
                      <div className="text-xs text-[var(--text-muted)]">
                        {apiResult.aggregatedDemographics.adsWithDemographics} ads with demographic data
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="glass rounded-xl p-5">
                      <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                        Key Insights
                      </h4>
                      <DemographicsSummary
                        demographics={apiResult.aggregatedDemographics}
                      />
                    </div>

                    {/* Charts - stacked vertically in column layout */}
                    <div className="space-y-4">
                      {/* Age/Gender Chart */}
                      <div className="glass rounded-xl p-5">
                        <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                          Age & Gender Breakdown
                        </h4>
                        <AgeGenderChart
                          data={apiResult.aggregatedDemographics.ageGenderBreakdown}
                        />
                      </div>

                      {/* Country Chart */}
                      <div className="glass rounded-xl p-5">
                        <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                          Geographic Distribution
                        </h4>
                        <CountryChart
                          data={apiResult.aggregatedDemographics.regionBreakdown}
                        />
                      </div>

                      {/* Media Type Chart - temporarily disabled */}
                    </div>
                  </div>
                )}

                {/* Product Market Analysis - API */}
                {apiResult && apiResult.productAnalysis && apiResult.productAnalysis.products.length > 0 && (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-lg text-[var(--text-primary)]">
                        Product <span className="italic text-[var(--accent-green-light)]">Analysis</span>
                      </h3>
                      <div className="text-xs text-[var(--text-muted)]">
                        {apiResult.productAnalysis.products.length} products across {apiResult.productAnalysis.allMarkets.length} markets
                      </div>
                    </div>
                    <ProductMarketTable data={apiResult.productAnalysis} />
                  </div>
                )}

                {/* Spend Analysis - Temporarily disabled while updating CPM benchmarks */}

                {/* Demographics Results - Scraper */}
                {adResult && !apiResult && (adResult as AdLibraryResultWithDemographics).aggregatedDemographics && (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-lg text-[var(--text-primary)]">
                        Audience <span className="italic text-[var(--accent-green-light)]">Demographics</span>
                      </h3>
                      {/* Scrape metadata */}
                      <div className="text-xs text-[var(--text-muted)]">
                        {(adResult as AdLibraryResultWithDemographics).demographicsScraped || 0} of {(adResult as AdLibraryResultWithDemographics).topPerformersAnalyzed || 0} ads had data
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="glass rounded-xl p-5">
                      <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                        Key Insights
                      </h4>
                      <DemographicsSummary
                        demographics={(adResult as AdLibraryResultWithDemographics).aggregatedDemographics!}
                      />
                    </div>

                    {/* Charts - stacked vertically in column layout */}
                    <div className="space-y-4">
                      {/* Age/Gender Chart */}
                      <div className="glass rounded-xl p-5">
                        <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                          Age & Gender Breakdown
                        </h4>
                        <AgeGenderChart
                          data={(adResult as AdLibraryResultWithDemographics).aggregatedDemographics!.ageGenderBreakdown}
                        />
                      </div>

                      {/* Country Chart */}
                      <div className="glass rounded-xl p-5">
                        <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                          Geographic Distribution
                        </h4>
                        <CountryChart
                          data={(adResult as AdLibraryResultWithDemographics).aggregatedDemographics!.regionBreakdown}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sitemap Results - Collapsible when we have sitemap data */}
          {result && (
            <div className="mb-8 animate-fade-in">
              <details className="group" open={!apiResult && !adResult}>
                <summary className="cursor-pointer list-none">
                  <div className="glass rounded-2xl p-4 hover:bg-[var(--bg-elevated)] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-[var(--accent-yellow)] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-[var(--text-primary)]">Sitemap Analysis</span>
                        <span className="text-xs text-[var(--text-muted)]">({result.totalUrls.toLocaleString()} URLs found)</span>
                      </div>
                    </div>
                  </div>
                </summary>
                <div className="mt-2 glass rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h2 className="font-serif text-xl text-[var(--text-primary)] mb-1">
                        Sitemap <span className="italic text-[var(--accent-green-light)]">Analysis</span>
                      </h2>
                      <p className="text-sm text-[var(--text-secondary)]">
                        URLs discovered and categorized from the sitemap
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[var(--text-primary)]">
                        {result.totalUrls.toLocaleString()}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">Total URLs</div>
                    </div>
                  </div>

                  <ResultsTable
                    urls={result.data.urls}
                    summary={result.data.summary}
                    analyzedUrl={result.analyzedUrl}
                    totalUrls={result.totalUrls}
                    adDestinationUrls={adDestinationUrls}
                    adCountMap={adCountMap}
                    adLibraryLinksMap={adLibraryLinksMap}
                    totalActiveAds={totalActiveAds}
                  />
                </div>
              </details>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-20 pt-8 border-t border-[var(--border-subtle)] text-center">
            <p className="text-xs text-[var(--text-muted)]">
              Built for competitive research. Data sourced from Facebook Ad Library API.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
