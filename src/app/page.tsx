'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DemographicsSummary } from '@/components/demographics/demographics-summary';
import { AgeGenderChart } from '@/components/demographics/age-gender-chart';
import { CountryChart } from '@/components/demographics/country-chart';
import { ProductMarketTable } from '@/components/analytics/product-market-table';
import { AdLongevity } from '@/components/analytics/ad-longevity';
import { AdCopyAnalysis } from '@/components/analytics/ad-copy-analysis';
import { BrandComparison } from '@/components/analytics/brand-comparison';
import { TimeTrends } from '@/components/analytics/time-trends';
import { LandingPageAnalysis } from '@/components/analytics/landing-page-analysis';
import { FavoritesPanel } from '@/components/favorites/favorites-panel';
import { useFavorites, FavoriteBrand } from '@/hooks/use-favorites';
import { exportAdsToCSV, exportDemographicsToCSV, exportFullReportToCSV } from '@/lib/export-utils';
import { extractPageIdFromUrl } from '@/lib/facebook-api';
import { ResultsSkeleton } from '@/components/loading/results-skeleton';
import { ApiErrorAlert } from '@/components/error/api-error-alert';
import { validateAdLibraryUrl } from '@/lib/validation';
import { getUserFriendlyMessage } from '@/lib/errors';
import { AdPreviewCard } from '@/components/ads/ad-preview-card';
import { BrandAnalysis } from '@/components/analytics/brand-analysis';
import { Play, Image as ImageIcon } from 'lucide-react';
// Spend analysis temporarily disabled - updating CPM benchmarks
// import { SpendAnalysisSection } from '@/components/spend/spend-analysis';
import type { FacebookApiResult } from '@/lib/facebook-api';

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

// Pricing tiers configuration
const PRICING_TIERS = {
  250: {
    name: 'Pro',
    price: 29,
    ads: 250,
    features: [
      'Analyse up to 250 ads',
      'Full demographic breakdowns',
      'Ad copy analysis',
      'Monthly reports (coming soon)',
      'Priority support',
    ],
  },
  500: {
    name: 'Business',
    price: 59,
    ads: 500,
    features: [
      'Analyse up to 500 ads',
      'Full demographic breakdowns',
      'Ad copy analysis',
      'Advanced competitive insights',
      'Monthly reports (coming soon)',
      'API access (coming soon)',
      'Priority support',
    ],
  },
  1000: {
    name: 'Enterprise',
    price: 99,
    ads: 1000,
    features: [
      'Analyse 1,000+ ads',
      'Full demographic breakdowns',
      'Ad copy analysis',
      'Advanced competitive insights',
      'Custom monthly reports',
      'Full API access',
      'Dedicated support',
      'Custom integrations',
    ],
  },
} as const;

function PricingModal({
  tier,
  onClose,
}: {
  tier: 250 | 500 | 1000;
  onClose: () => void;
}) {
  const pricing = PRICING_TIERS[tier];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass rounded-2xl p-8 max-w-md w-full animate-fade-in glow-gold">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-yellow)]/20 text-[var(--accent-yellow)] text-xs font-medium mb-4">
            {pricing.name} Plan
          </div>
          <h2 className="font-serif text-2xl text-[var(--text-primary)] mb-2">
            Unlock <span className="italic text-[var(--accent-green-light)]">{pricing.ads} Ads</span> Analysis
          </h2>
          <p className="text-[var(--text-secondary)] text-sm">
            Get deeper insights into your competitors&apos; advertising strategies
          </p>
        </div>

        {/* Price */}
        <div className="text-center mb-6">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-[var(--text-primary)]">${pricing.price}</span>
            <span className="text-[var(--text-muted)]">/month</span>
          </div>
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-8">
          {pricing.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3 text-sm">
              <svg className="w-5 h-5 text-[var(--accent-green-light)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-[var(--text-secondary)]">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          disabled
          className="w-full py-3 text-base font-semibold rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed"
        >
          Coming Soon
        </button>

        <p className="text-center text-xs text-[var(--text-muted)] mt-4">
          Paid plans launching soon. Stay tuned!
        </p>
      </div>
    </div>
  );
}

// Example brands with their Ad Library URLs
const EXAMPLE_BRANDS = [
  { name: 'Estrid', domain: 'estrid.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=2350793288288464' },
  { name: 'Ninepine', domain: 'ninepine.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=829738024024491' },
  { name: 'Loop Earplugs', domain: 'loopearplugs.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=517850318391712' },
  { name: 'ZeekSack', domain: 'zeeksack.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=600002290036230' },
  { name: 'Stronger', domain: 'strongerlabel.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=1836637016477201' },
  { name: 'Aimn', domain: 'aimn.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=527417557349551' },
  { name: 'Burga', domain: 'burga.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=347221038990658' },
];

export default function Home() {
  // Ad Library state
  const [adLibraryUrl, setAdLibraryUrl] = useState('');
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [adError, setAdError] = useState<Error | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Active status filter: 'ACTIVE' shows only running ads, 'ALL' shows all ads including inactive
  const [activeStatus, setActiveStatus] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  // Analysis depth - number of ads to analyze (tiered: Free=100, Pro=250, Business=500/1000)
  const [analysisLimit, setAnalysisLimit] = useState<100 | 250 | 500 | 1000>(100);

  // Pricing modal state
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedPricingTier, setSelectedPricingTier] = useState<250 | 500 | 1000 | null>(null);

  // Facebook API result
  const [apiResult, setApiResult] = useState<FacebookApiResult | null>(null);

  // Timeline-specific ads (always fetches ALL ads regardless of activeStatus filter)
  const [timelineAds, setTimelineAds] = useState<FacebookApiResult['ads'] | null>(null);

  // Brand comparison mode
  const [comparisonBrands, setComparisonBrands] = useState<FacebookApiResult[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Results view tab: 'overview' shows ads/demographics, 'expert' shows brand analysis
  const [resultsTab, setResultsTab] = useState<'overview' | 'expert'>('overview');

  // Favorites
  const { favorites, isLoaded: favoritesLoaded, addFavorite, removeFavorite, isFavorite, toggleFavorite } = useFavorites();

  // URL validation on blur
  const handleUrlBlur = () => {
    if (!adLibraryUrl.trim()) {
      setUrlError(null); // Don't show error for empty field
      return;
    }

    const result = validateAdLibraryUrl(adLibraryUrl.trim());
    setUrlError(result.valid ? null : result.error || null);
  };

  const handleAdLibrarySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adLibraryUrl.trim()) return;

    // Validate before submitting
    const validation = validateAdLibraryUrl(adLibraryUrl.trim());
    if (!validation.valid) {
      setUrlError(validation.error || 'Invalid URL');
      return;
    }

    setIsLoadingAds(true);
    setAdError(null);
    setUrlError(null);
    setApiResult(null);
    setTimelineAds(null);

    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

    try {
      // Fetch main results and timeline data in parallel
      // Timeline always fetches ALL ads to show complete historical activity
      const [mainRes, timelineRes] = await Promise.all([
        fetch('/api/facebook-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adLibraryUrl: adLibraryUrl.trim(),
            countries: euCountries,
            limit: analysisLimit,
            activeStatus,
          }),
        }),
        // Only fetch timeline separately if activeStatus is not already 'ALL'
        // Timeline uses higher limit (500) to get enough historical data for 8-week chart
        activeStatus === 'ALL' ? Promise.resolve(null) : fetch('/api/facebook-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adLibraryUrl: adLibraryUrl.trim(),
            countries: euCountries,
            limit: 500, // Higher limit for timeline to include historical/inactive ads
            activeStatus: 'ALL',
          }),
        }),
      ]);

      const response = await mainRes.json();

      if (response.success) {
        setApiResult(response);
        setAdError(null);

        // Set timeline ads - use separate fetch if available, otherwise use main response
        if (timelineRes) {
          const timelineResponse = await timelineRes.json();
          if (timelineResponse.success) {
            setTimelineAds(timelineResponse.ads);
          } else {
            // Fallback to main ads if timeline fetch failed
            setTimelineAds(response.ads);
          }
        } else {
          // activeStatus was already 'ALL', use main response
          setTimelineAds(response.ads);
        }
      } else {
        const errorObj = new Error(response.error || 'Failed to fetch Ad Library data');
        setAdError(errorObj);
        toast.error('Failed to analyze ads', {
          description: getUserFriendlyMessage(errorObj),
        });
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Failed to fetch Ad Library data');
      setAdError(errorObj);
      toast.error('Failed to analyze ads', {
        description: getUserFriendlyMessage(errorObj),
      });
    } finally {
      setIsLoadingAds(false);
    }
  };

  // Retry handler for error alert
  const handleRetry = () => {
    setAdError(null);
    handleAdLibrarySubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <>
      {/* Pricing Modal */}
      {showPricingModal && selectedPricingTier && (
        <PricingModal
          tier={selectedPricingTier}
          onClose={() => {
            setShowPricingModal(false);
            setSelectedPricingTier(null);
          }}
        />
      )}

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
                  onChange={(e) => {
                    setAdLibraryUrl(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  onBlur={handleUrlBlur}
                  placeholder="https://www.facebook.com/ads/library/?...&view_all_page_id=..."
                  className={`input-field flex-1 ${urlError ? 'border-red-500 focus:ring-red-500' : ''}`}
                  disabled={isLoadingAds}
                  aria-invalid={!!urlError}
                  aria-describedby={urlError ? 'url-error' : undefined}
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

              {/* URL Validation Error */}
              {urlError && (
                <p id="url-error" className="mt-2 text-sm text-red-500" role="alert">
                  {urlError}
                </p>
              )}

              {/* Options */}
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <span className="text-xs text-[var(--text-muted)]">Ads:</span>
                <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 border border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => setActiveStatus('ACTIVE')}
                    disabled={isLoadingAds}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeStatus === 'ACTIVE'
                        ? 'bg-[var(--accent-green)] text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
                    }`}
                  >
                    Active Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStatus('ALL')}
                    disabled={isLoadingAds}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      activeStatus === 'ALL'
                        ? 'bg-[var(--accent-green)] text-white'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
                    }`}
                  >
                    All Ads
                  </button>
                </div>

                <div className="w-px h-6 bg-[var(--border-subtle)]" />

                <span className="text-xs text-[var(--text-muted)]">Depth:</span>
                <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 border border-[var(--border-subtle)]">
                  {([100, 250, 500, 1000] as const).map((limit) => {
                    const isPaid = limit > 100;
                    return (
                      <button
                        key={limit}
                        type="button"
                        onClick={() => {
                          if (isPaid) {
                            setSelectedPricingTier(limit as 250 | 500 | 1000);
                            setShowPricingModal(true);
                          } else {
                            setAnalysisLimit(limit);
                          }
                        }}
                        disabled={isLoadingAds}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          analysisLimit === limit
                            ? 'bg-[var(--accent-green)] text-white'
                            : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
                        }`}
                      >
                        {limit === 1000 ? '1K' : limit}
                        {limit === 100 && <span className="ml-1 opacity-60">Free</span>}
                        {isPaid && <span className="ml-1 opacity-60">Pro</span>}
                      </button>
                    );
                  })}
                </div>

                {/* How it works info dropdown */}
                <div className="relative group">
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>How it works</span>
                  </button>
                  <div className="absolute left-0 top-full mt-1 w-80 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <h4 className="font-medium text-[var(--text-primary)] mb-2">Which ads are analysed?</h4>
                    <div className="space-y-2 text-xs text-[var(--text-secondary)]">
                      <p>
                        We fetch the <span className="text-[var(--accent-green-light)] font-medium">newest ads</span> from the brand&apos;s Facebook Ad Library, sorted by start date (most recent first).
                      </p>
                      <p>
                        The depth setting controls how many ads to analyse. With 100 ads, you get the 100 most recently launched campaigns.
                      </p>
                      <p className="pt-2 border-t border-[var(--border-subtle)]">
                        <span className="font-medium text-[var(--text-primary)]">Why newest first?</span><br />
                        Recent ads reflect current strategy, messaging, and targeting. They show what&apos;s working <em>now</em> for the brand.
                      </p>
                      <p className="pt-2 border-t border-[var(--border-subtle)]">
                        <span className="font-medium text-[var(--text-primary)]">Data source</span><br />
                        Demographics come from Facebook&apos;s EU DSA transparency data, which includes reach by age, gender, and country.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick start examples - always visible for easy brand switching */}
              {!isLoadingAds && (
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

              {/* Favorites section */}
              {!apiResult && !isLoadingAds && favoritesLoaded && favorites.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[var(--accent-yellow)]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Your Favorites</span>
                  </div>
                  <FavoritesPanel
                    favorites={favorites}
                    onSelect={(brand) => setAdLibraryUrl(brand.adLibraryUrl)}
                    onRemove={removeFavorite}
                  />
                </div>
              )}
            </div>
          </form>

          {/* Brand Comparison Panel */}
          {comparisonBrands.length > 0 && (
            <div className="mb-8 animate-fade-in">
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="font-serif text-xl text-[var(--text-primary)]">
                      Brand <span className="italic text-[var(--accent-green-light)]">Comparison</span>
                    </h2>
                    <span className="text-xs px-2 py-1 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                      {comparisonBrands.length}/3 brands
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowComparison(!showComparison)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        showComparison
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {showComparison ? 'Hide Comparison' : 'Show Comparison'}
                    </button>
                    <button
                      onClick={() => {
                        setComparisonBrands([]);
                        setShowComparison(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Saved brand pills */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {comparisonBrands.map((brand, index) => (
                    <div
                      key={brand.pageId}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                        index === 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' :
                        index === 1 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      }`}
                    >
                      {brand.pageName || `Brand ${index + 1}`}
                      <button
                        onClick={() => setComparisonBrands(comparisonBrands.filter((_, i) => i !== index))}
                        className="hover:opacity-70"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {comparisonBrands.length < 3 && (
                    <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)]">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add brand above
                    </div>
                  )}
                </div>

                {/* Comparison View */}
                {showComparison && comparisonBrands.length >= 2 && (
                  <BrandComparison
                    brands={comparisonBrands}
                    onRemoveBrand={(index) => setComparisonBrands(comparisonBrands.filter((_, i) => i !== index))}
                  />
                )}

                {showComparison && comparisonBrands.length < 2 && (
                  <div className="text-center py-8 text-[var(--text-muted)]">
                    Add at least 2 brands to compare. Analyze a brand above and click "Compare" to save it.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ad Library Results - Full Width */}
          {(apiResult || isLoadingAds) && (
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
                  {apiResult && (
                    <div className="flex items-center gap-4 text-right">
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
                          {/* Export Dropdown */}
                          <div className="relative group">
                            <button
                              type="button"
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Export
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-48 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                              <button
                                onClick={() => exportFullReportToCSV(apiResult)}
                                className="w-full px-4 py-2 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                              >
                                Full Report (CSV)
                              </button>
                              <button
                                onClick={() => exportAdsToCSV(apiResult)}
                                className="w-full px-4 py-2 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                              >
                                Ads Only (CSV)
                              </button>
                              {apiResult.aggregatedDemographics && (
                                <button
                                  onClick={() => exportDemographicsToCSV(apiResult)}
                                  className="w-full px-4 py-2 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                                >
                                  Demographics (CSV)
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Save for Comparison */}
                          <button
                            type="button"
                            onClick={() => {
                              if (comparisonBrands.length < 3 && !comparisonBrands.find(b => b.pageId === apiResult.pageId)) {
                                setComparisonBrands([...comparisonBrands, apiResult]);
                              }
                            }}
                            disabled={comparisonBrands.length >= 3 || comparisonBrands.some(b => b.pageId === apiResult.pageId)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                              comparisonBrands.some(b => b.pageId === apiResult.pageId)
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                : comparisonBrands.length >= 3
                                  ? 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed'
                                  : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)]'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {comparisonBrands.some(b => b.pageId === apiResult.pageId) ? 'Saved' : 'Compare'}
                          </button>
                          {/* Favorite Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const totalReach = apiResult.ads.reduce((sum, ad) => sum + ad.euTotalReach, 0);
                              toggleFavorite({
                                pageId: apiResult.pageId,
                                pageName: apiResult.pageName || `Page ${apiResult.pageId}`,
                                adLibraryUrl: adLibraryUrl,
                                lastAnalyzed: new Date().toISOString(),
                                totalAds: apiResult.totalAdsFound,
                                totalReach,
                              });
                            }}
                            className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                              isFavorite(apiResult.pageId)
                                ? 'bg-[var(--accent-yellow)]/20 border-[var(--accent-yellow)]/50 text-[var(--accent-yellow)]'
                                : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--accent-yellow)] hover:border-[var(--accent-yellow)]'
                            }`}
                            title={isFavorite(apiResult.pageId) ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <svg
                              className="w-4 h-4"
                              fill={isFavorite(apiResult.pageId) ? 'currentColor' : 'none'}
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                    </div>
                  )}
                </div>

                {/* Tab Navigation */}
                {apiResult && (
                  <div className="mt-4 flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] w-fit">
                    <button
                      onClick={() => setResultsTab('overview')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                        resultsTab === 'overview'
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setResultsTab('expert')}
                      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        resultsTab === 'expert'
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Expert Analysis
                    </button>
                  </div>
                )}

                {/* Ad Library Loading - Skeleton UI */}
                {isLoadingAds && !apiResult && (
                  <ResultsSkeleton />
                )}

                {/* Ad Library Error with Retry */}
                {adError && !isLoadingAds && (
                  <ApiErrorAlert
                    error={adError}
                    onRetry={handleRetry}
                    className="mt-4"
                  />
                )}

                {/* OVERVIEW TAB CONTENT */}
                {resultsTab === 'overview' && apiResult && (
                  <>
                    {/* Ad Library Results Summary - API Result */}
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
                        <p className="mb-2 font-medium text-[var(--text-primary)]">Top Ads by Reach</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
                          {[...apiResult.ads]
                            .sort((a, b) => b.euTotalReach - a.euTotalReach)
                            .slice(0, 6)
                            .map((ad, index) => (
                              <AdPreviewCard key={ad.adArchiveId || index} ad={ad} />
                            ))}
                        </div>
                        {apiResult.ads.length > 6 && (
                          <p className="text-center text-xs text-[var(--text-muted)] mt-4">
                            +{apiResult.ads.length - 6} more ads (expand &quot;View all&quot; below)
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-3 text-xs text-[var(--text-muted)]">
                      Countries: {apiResult.metadata.countries.join(', ')} • Fetched: {new Date(apiResult.metadata.fetchedAt).toLocaleTimeString()}
                    </div>
                  </div>

                {/* All Active Ads - expandable list */}
                {apiResult.ads.length > 0 && (
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
                              <th className="px-4 py-2 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide w-16">Type</th>
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
                                  {ad.mediaType === 'video' && (
                                    <span className="inline-flex items-center gap-1 text-purple-500" title="Video">
                                      <Play className="w-4 h-4" />
                                    </span>
                                  )}
                                  {ad.mediaType === 'image' && (
                                    <span className="inline-flex items-center gap-1 text-blue-500" title="Image">
                                      <ImageIcon className="w-4 h-4" />
                                    </span>
                                  )}
                                  {ad.mediaType === 'unknown' && (
                                    <span className="text-[var(--text-muted)]">-</span>
                                  )}
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

                    {/* Charts - collapsible */}
                    <div className="space-y-3">
                      {/* Age/Gender Chart - Collapsible */}
                      <details className="group glass rounded-xl overflow-hidden">
                        <summary className="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors">
                          <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">Age & Gender Breakdown</h4>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            {(() => {
                              const topSegment = apiResult.aggregatedDemographics.ageGenderBreakdown[0];
                              return topSegment ? (
                                <span>Top: <span className="text-[var(--accent-green-light)]">{topSegment.gender} {topSegment.age}</span> ({topSegment.percentage.toFixed(1)}%)</span>
                              ) : null;
                            })()}
                          </div>
                        </summary>
                        <div className="px-5 pb-5">
                          <AgeGenderChart
                            data={apiResult.aggregatedDemographics.ageGenderBreakdown}
                          />
                        </div>
                      </details>

                      {/* Country Chart - Collapsible */}
                      <details className="group glass rounded-xl overflow-hidden">
                        <summary className="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-[var(--bg-tertiary)] transition-colors">
                          <div className="flex items-center gap-3">
                            <svg className="w-4 h-4 text-[var(--text-muted)] transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <h4 className="text-sm font-medium text-[var(--text-primary)]">Geographic Distribution</h4>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            {(() => {
                              const topCountries = apiResult.aggregatedDemographics.regionBreakdown.slice(0, 3);
                              return topCountries.length > 0 ? (
                                <span>Top: <span className="text-[var(--accent-green-light)]">{topCountries.map(c => c.region).join(', ')}</span></span>
                              ) : null;
                            })()}
                          </div>
                        </summary>
                        <div className="px-5 pb-5">
                          <CountryChart
                            data={apiResult.aggregatedDemographics.regionBreakdown}
                          />
                        </div>
                      </details>
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

                {/* Ad Longevity Analysis - API */}
                {apiResult && apiResult.ads.length > 0 && (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-lg text-[var(--text-primary)]">
                        Ad <span className="italic text-[var(--accent-green-light)]">Longevity</span>
                      </h3>
                      <div className="text-xs text-[var(--text-muted)]">
                        Identify evergreen winners
                      </div>
                    </div>
                    <div className="glass rounded-xl p-5">
                      <AdLongevity ads={apiResult.ads} />
                    </div>
                  </div>
                )}

                {/* Ad Copy Analysis - API */}
                {apiResult && apiResult.ads.length > 0 && (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-lg text-[var(--text-primary)]">
                        Copy <span className="italic text-[var(--accent-green-light)]">Analysis</span>
                      </h3>
                      <div className="text-xs text-[var(--text-muted)]">
                        Hooks, CTAs & messaging patterns
                      </div>
                    </div>
                    <div className="glass rounded-xl p-5">
                      <AdCopyAnalysis ads={apiResult.ads} />
                    </div>
                  </div>
                )}

                {/* Time Trends - API (uses ALL ads for complete historical view) */}
                {apiResult && timelineAds && timelineAds.length > 0 && (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-lg text-[var(--text-primary)]">
                        Activity <span className="italic text-[var(--accent-green-light)]">Timeline</span>
                      </h3>
                      <div className="text-xs text-[var(--text-muted)]">
                        {activeStatus === 'ACTIVE' && timelineAds.length !== apiResult.ads.length && (
                          <span className="text-[var(--accent-yellow)] mr-2">Includes inactive ads</span>
                        )}
                        Advertising intensity over time
                      </div>
                    </div>
                    <div className="glass rounded-xl p-5">
                      <TimeTrends ads={timelineAds} />
                    </div>
                  </div>
                )}

                {/* Landing Page Analysis - API */}
                {apiResult && apiResult.ads.length > 0 && (
                  <div className="mt-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-lg text-[var(--text-primary)]">
                        Landing <span className="italic text-[var(--accent-green-light)]">Pages</span>
                      </h3>
                      <div className="text-xs text-[var(--text-muted)]">
                        Where ads drive traffic
                      </div>
                    </div>
                    <div className="glass rounded-xl p-5">
                      <LandingPageAnalysis
                        apiAds={apiResult.ads}
                      />
                    </div>
                  </div>
                )}
                  </>
                )}

                {/* EXPERT ANALYSIS TAB CONTENT */}
                {resultsTab === 'expert' && apiResult && apiResult.ads.length > 0 && (
                  <div className="mt-4">
                    <BrandAnalysis
                      brandName={apiResult.pageName || `Page ${apiResult.pageId}`}
                      ads={apiResult.ads}
                      demographics={apiResult.aggregatedDemographics}
                      mediaBreakdown={apiResult.mediaTypeBreakdown}
                    />
                  </div>
                )}

              </div>
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
