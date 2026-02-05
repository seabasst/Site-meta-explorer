'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { DemographicsSummary } from '@/components/demographics/demographics-summary';
import { AgeGenderChart } from '@/components/demographics/age-gender-chart';
import { CountryChart } from '@/components/demographics/country-chart';
import { ProductMarketTable } from '@/components/analytics/product-market-table';
import { AdLongevity } from '@/components/analytics/ad-longevity';
import { AdCopyAnalysis } from '@/components/analytics/ad-copy-analysis';
import { BrandComparison } from '@/components/analytics/brand-comparison';
import { TrendAnalysis } from '@/components/analytics/trend-analysis';
import { LandingPageAnalysis } from '@/components/analytics/landing-page-analysis';
import { FavoritesPanel } from '@/components/favorites/favorites-panel';
import { useFavorites, FavoriteBrand } from '@/hooks/use-favorites';
import { exportAdsToCSV, exportDemographicsToCSV, exportFullReportToCSV } from '@/lib/export-utils';
import { exportToPDF } from '@/lib/pdf-export';
import { extractPageIdFromUrl } from '@/lib/facebook-api';
import { ResultsSkeleton } from '@/components/loading/results-skeleton';
import { ApiErrorAlert } from '@/components/error/api-error-alert';
import { validateAdLibraryUrl } from '@/lib/validation';
import { getUserFriendlyMessage } from '@/lib/errors';
import { AdPreviewCard } from '@/components/ads/ad-preview-card';
import { BrandAnalysis } from '@/components/analytics/brand-analysis';
import { AccountSummary } from '@/components/summary/account-summary';
import { SearchBar } from '@/components/search/search-bar';
import { Play, Image as ImageIcon, Menu, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { SignInButton } from '@/components/auth/sign-in-button';
import { UserMenu } from '@/components/auth/user-menu';
import { SubscriptionStatus } from '@/components/subscription/subscription-status';
import { DepthSelector } from '@/components/tier/depth-selector';
import { FeatureGate } from '@/components/tier/feature-gate';
import { KiriMediaPopup } from '@/components/promo/kiri-media-popup';
import { FeedbackPopup } from '@/components/feedback/feedback-popup';
// Spend analysis temporarily disabled - updating CPM benchmarks
// import { SpendAnalysisSection } from '@/components/spend/spend-analysis';
import type { FacebookApiResult } from '@/lib/facebook-api';
import { buildSnapshotFromApiResult } from '@/lib/snapshot-builder';
import { extractHooksFromAds } from '@/lib/hook-extractor';

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

function ActiveChartFilter({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-tertiary)] border border-emerald-500/50 text-sm">
      <span className="text-[var(--text-secondary)]">Filtered by:</span>
      <span className="font-medium text-emerald-400">{label}</span>
      <button
        onClick={onClear}
        className="ml-1 p-2.5 -m-2 rounded-full hover:bg-[var(--bg-elevated)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        aria-label="Clear filter"
      >
        <X className="w-3.5 h-3.5" />
      </button>
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
  { name: 'Dope Snow', domain: 'dopesnow.com', adLibrary: 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=159906574695624' },
];

export default function Home() {
  // Auth state
  const { data: session, status: authStatus } = useSession();


  // Input mode: search bar vs URL paste
  const [inputMode, setInputMode] = useState<'search' | 'url'>('search');

  // Selected page from search (before analysis is triggered)
  const [selectedPage, setSelectedPage] = useState<{ pageId: string; pageName: string } | null>(null);

  // Ad Library state
  const [adLibraryUrl, setAdLibraryUrl] = useState('');
  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [adError, setAdError] = useState<Error | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Active status filter: 'ACTIVE' shows only running ads, 'ALL' shows all ads including inactive
  const [activeStatus, setActiveStatus] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  // Region filter: 'global' shows all ads, 'eu' shows only EU ads (with full demographic data)
  const [regionFilter, setRegionFilter] = useState<'global' | 'eu'>('eu');

  // Analysis depth - number of ads to analyze (tier-gated via DepthSelector)
  const [analysisLimit, setAnalysisLimit] = useState<number>(100);

  // Date range filter
  const [dateStart, setDateStart] = useState<string | null>(null);
  const [dateEnd, setDateEnd] = useState<string | null>(null);

  // Facebook API result
  const [apiResult, setApiResult] = useState<FacebookApiResult | null>(null);

  // Timeline-specific ads (always fetches ALL ads regardless of activeStatus filter)
  const [timelineAds, setTimelineAds] = useState<FacebookApiResult['ads'] | null>(null);

  // Brand comparison mode
  const [comparisonBrands, setComparisonBrands] = useState<FacebookApiResult[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonUrl, setComparisonUrl] = useState('');
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // Results view tab: 'audience' shows demographics, 'ads' shows ad-related data, 'expert' shows brand analysis
  const [resultsTab, setResultsTab] = useState<'audience' | 'ads' | 'expert'>('audience');

  // Chart filter state (click-to-filter from charts)
  const [chartFilter, setChartFilter] = useState<{
    type: 'country' | 'mediaType' | 'ageGender';
    value: string;
    label: string;
  } | null>(null);

  // PDF export loading state
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ step: string; current: number; total: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Export dropdown tap-to-toggle (mobile support)
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Favorites
  const { favorites, isLoaded: favoritesLoaded, addFavorite, removeFavorite, isFavorite, toggleFavorite } = useFavorites();

  // Dashboard tracking state
  const [trackingAction, setTrackingAction] = useState<string | null>(null);

  // Save Brand state
  const [saving, setSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportOpen]);

  // Filtered ads based on chart filter
  const filteredAds = useMemo(() => {
    if (!chartFilter || !apiResult) return apiResult?.ads ?? [];
    switch (chartFilter.type) {
      case 'country':
        return apiResult.ads.filter(ad =>
          ad.demographics?.regionBreakdown?.some(d => d.region === chartFilter.value)
        );
      case 'mediaType':
        return apiResult.ads.filter(ad => ad.mediaType === chartFilter.value.toLowerCase());
      default:
        return apiResult.ads;
    }
  }, [chartFilter, apiResult]);

  // URL validation on blur
  // Track brand on dashboard
  const handleTrackBrand = async (mode: 'own' | 'competitor') => {
    if (!apiResult || !session) return;
    setTrackingAction(mode);
    try {
      const endpoint = mode === 'own' ? '/api/dashboard/own-brand' : '/api/dashboard/competitors';
      const method = mode === 'own' ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facebookPageId: apiResult.pageId,
          pageName: apiResult.pageName || `Page ${apiResult.pageId}`,
          adLibraryUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      toast.success(mode === 'own' ? 'Set as your brand!' : 'Added to competitors!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to track brand');
    } finally {
      setTrackingAction(null);
    }
  };

  // Save brand with demographic snapshot
  const handleSaveBrand = async () => {
    if (!apiResult || !session) return;
    setSaving(true);
    try {
      const snapshotData = buildSnapshotFromApiResult(apiResult);
      const hookGroups = extractHooksFromAds(apiResult.rawAdBodies || []);
      const res = await fetch('/api/brands/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facebookPageId: apiResult.pageId,
          pageName: apiResult.pageName || `Page ${apiResult.pageId}`,
          adLibraryUrl,
          snapshot: {
            ...snapshotData,
            totalReach: Number(snapshotData.totalReach), // BigInt -> Number for JSON serialization
          },
          hookGroups: hookGroups.map(g => ({
            hookText: g.hookText,
            normalizedText: g.normalizedText,
            frequency: g.frequency,
            totalReach: g.totalReach,
            avgReachPerAd: g.avgReachPerAd,
            adIds: g.adIds,
          })),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save brand');
      }
      toast.success('Brand saved!');
      setBrandSaved(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  const handleUrlBlur = () => {
    if (!adLibraryUrl.trim()) {
      setUrlError(null); // Don't show error for empty field
      return;
    }

    const result = validateAdLibraryUrl(adLibraryUrl.trim());
    setUrlError(result.valid ? null : result.error || null);
  };

  const handleAdLibrarySubmit = async (e: React.FormEvent, overrideUrl?: string) => {
    e.preventDefault();
    const urlToUse = overrideUrl || adLibraryUrl.trim();
    if (!urlToUse) return;

    // Validate before submitting
    const validation = validateAdLibraryUrl(urlToUse);
    if (!validation.valid) {
      setUrlError(validation.error || 'Invalid URL');
      return;
    }

    // Sync the URL state if we used an override
    if (overrideUrl) {
      setAdLibraryUrl(overrideUrl);
    }

    setIsLoadingAds(true);
    setAdError(null);
    setUrlError(null);
    setApiResult(null);
    setTimelineAds(null);
    setChartFilter(null);
    setBrandSaved(false);

    // EU countries (full demographic data available via DSA transparency)
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

    // Global = major non-EU markets + EU countries
    const globalCountries = ['US', 'GB', 'CA', 'AU', 'NZ', 'NO', 'CH', ...euCountries];

    // Use selected region's country list
    const selectedCountries = regionFilter === 'eu' ? euCountries : globalCountries;

    try {
      // Fetch main results and timeline data in parallel
      // Timeline always fetches ALL ads to show complete historical activity
      const [mainRes, timelineRes] = await Promise.all([
        fetch('/api/facebook-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adLibraryUrl: urlToUse,
            countries: selectedCountries,
            limit: analysisLimit,
            activeStatus,
            ...(dateStart && { dateMin: dateStart }),
            ...(dateEnd && { dateMax: dateEnd }),
          }),
        }),
        // Only fetch timeline separately if activeStatus is not already 'ALL'
        // Timeline uses higher limit (500) to get enough historical data for 8-week chart
        activeStatus === 'ALL' ? Promise.resolve(null) : fetch('/api/facebook-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adLibraryUrl: urlToUse,
            countries: selectedCountries,
            limit: 500, // Higher limit for timeline to include historical/inactive ads
            activeStatus: 'ALL',
            ...(dateStart && { dateMin: dateStart }),
            ...(dateEnd && { dateMax: dateEnd }),
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

  // Add brand to comparison by URL
  const handleAddToComparison = async (url: string) => {
    if (!url.trim() || comparisonBrands.length >= 3) return;

    const validation = validateAdLibraryUrl(url.trim());
    if (!validation.valid) {
      toast.error('Invalid URL', { description: validation.error || 'Please paste a valid Ad Library URL' });
      return;
    }

    // Check if already added
    const pageId = extractPageIdFromUrl(url.trim());
    if (pageId && comparisonBrands.some(b => b.pageId === pageId)) {
      toast.error('Brand already added');
      return;
    }

    setIsLoadingComparison(true);

    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];

    try {
      const res = await fetch('/api/facebook-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adLibraryUrl: url.trim(),
          countries: euCountries,
          limit: 100,
          activeStatus: 'ACTIVE',
        }),
      });

      const response = await res.json();

      if (response.success) {
        setComparisonBrands(prev => [...prev, response]);
        setComparisonUrl('');
        toast.success(`Added ${response.pageName || 'brand'} to comparison`);
      } else {
        toast.error('Failed to fetch brand', { description: response.error });
      }
    } catch (error) {
      toast.error('Failed to fetch brand', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsLoadingComparison(false);
    }
  };

  return (
    <>
      {/* Background effects */}
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      {/* Kiri Media Popup - appears after 60 seconds */}
      <KiriMediaPopup />
      <FeedbackPopup />

      <main className="min-h-screen">
        {/* Top Navigation Bar */}
        <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            {/* Left - Logo / Brand */}
            <a href="/" className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              Ad Analyser
            </a>

            {/* Center - Nav Links (desktop) */}
            <div className="hidden md:flex items-center gap-1">
              {/* How it works - dropdown */}
              <div className="relative group">
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]"
                >
                  How it works
                </button>
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-80 p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100]">
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
              <a href="/about" className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]">
                About us
              </a>
              <a href="/contact" className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]">
                Contact us
              </a>
              <a href="/feedback" className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]">
                Feedback
              </a>
            </div>

            {/* Right - Coming Soon CTA */}
            <div className="flex items-center gap-3">
              <a
                href="/coming-soon"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green-light)] transition-colors"
              >
                Pro — Coming Soon
              </a>

              {/* Mobile menu button */}
              <button
                type="button"
                className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                onClick={() => {
                  const menu = document.getElementById('mobile-nav-menu');
                  menu?.classList.toggle('hidden');
                }}
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile Nav Menu */}
          <div id="mobile-nav-menu" className="hidden md:hidden border-t border-[var(--border-subtle)] px-6 py-3 space-y-1">
            <a href="/about" className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]">
              About us
            </a>
            <a href="/contact" className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]">
              Contact us
            </a>
            <a href="/feedback" className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]">
              Feedback
            </a>
          </div>
        </nav>

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
            <div className="relative z-20 glass rounded-2xl p-6 glow-gold">
              {inputMode === 'search' ? (
                <>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Search for a brand
                  </label>
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    Type a brand name to find their Facebook page and analyse their ads.
                  </p>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <SearchBar
                        disabled={isLoadingAds}
                        placeholder="Search for a brand (e.g. Nike, Adidas, Gymshark)..."
                        onSelect={(pageId, pageName) => {
                          setSelectedPage({ pageId, pageName });
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!selectedPage || isLoadingAds}
                      onClick={() => {
                        if (!selectedPage) return;
                        const constructedUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=${selectedPage.pageId}`;
                        handleAdLibrarySubmit(
                          { preventDefault: () => {} } as React.FormEvent,
                          constructedUrl,
                        );
                      }}
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
                  {selectedPage && !isLoadingAds && (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Selected: <span className="font-medium text-[var(--text-primary)]">{selectedPage.pageName}</span>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setInputMode('url')}
                    className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent-green-light)] transition-colors"
                  >
                    Or paste an Ad Library URL
                  </button>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Enter a Facebook Ad Library URL
                  </label>
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    First, search for a brand on{' '}
                    <a
                      href="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&media_type=all"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-gold)] hover:underline font-medium inline-flex items-center gap-1"
                    >
                      Facebook Ad Library
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    , then copy the URL and paste it here.
                  </p>
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

                  <button
                    type="button"
                    onClick={() => setInputMode('search')}
                    className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent-green-light)] transition-colors"
                  >
                    Or search by brand name
                  </button>
                </>
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

                <div className="w-px h-6 bg-[var(--border-subtle)] hidden sm:block" />

                <span className="text-xs text-[var(--text-muted)]">Region:</span>
                <div className="relative group/region">
                  <div className="flex rounded-lg bg-[var(--bg-tertiary)] p-1 border border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setRegionFilter('eu')}
                      disabled={isLoadingAds}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        regionFilter === 'eu'
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
                      }`}
                    >
                      EU Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegionFilter('global')}
                      disabled={isLoadingAds}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        regionFilter === 'global'
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-subtle)]'
                      }`}
                    >
                      Global
                    </button>
                  </div>
                  {/* Region info tooltip */}
                  <div className="absolute left-0 top-full mt-1 w-64 p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-xl opacity-0 invisible group-hover/region:opacity-100 group-hover/region:visible transition-all z-50">
                    <p className="text-xs text-[var(--text-secondary)]">
                      <span className="font-medium text-[var(--accent-green-light)]">EU Only:</span> Shows ads targeting EU countries with full demographic data (age, gender, location) via DSA transparency laws.
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2">
                      <span className="font-medium text-[var(--text-primary)]">Global:</span> Shows all ads including US, UK, etc. Demographics only available for EU-targeted ads.
                    </p>
                  </div>
                </div>

                <div className="w-px h-6 bg-[var(--border-subtle)] hidden sm:block" />

                <span className="text-xs text-[var(--text-muted)]">Depth:</span>
                <DepthSelector
                  value={analysisLimit}
                  onChange={setAnalysisLimit}
                  disabled={isLoadingAds}
                />

                <div className="w-px h-6 bg-[var(--border-subtle)] hidden sm:block" />

                <span className="text-xs text-[var(--text-muted)]">Date range:</span>
                <input
                  type="date"
                  value={dateStart || ''}
                  onChange={(e) => setDateStart(e.target.value || null)}
                  disabled={isLoadingAds}
                  className="px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-green)]"
                  placeholder="Start"
                />
                <span className="text-xs text-[var(--text-muted)]">to</span>
                <input
                  type="date"
                  value={dateEnd || ''}
                  onChange={(e) => setDateEnd(e.target.value || null)}
                  disabled={isLoadingAds}
                  className="px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent-green)]"
                  placeholder="End"
                />

              </div>

              {/* Quick start examples - always visible for easy brand switching */}
              {!isLoadingAds && (
                <div className="mt-4 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-[var(--text-muted)]">Examples:</span>
                  {EXAMPLE_BRANDS.map((brand) => {
                    const pageIdMatch = brand.adLibrary.match(/view_all_page_id=(\d+)/);
                    return (
                      <button
                        key={brand.domain}
                        type="button"
                        onClick={() => {
                          if (inputMode === 'search' && pageIdMatch) {
                            setSelectedPage({ pageId: pageIdMatch[1], pageName: brand.name });
                          } else {
                            setAdLibraryUrl(brand.adLibrary);
                            if (inputMode === 'search') setInputMode('url');
                          }
                        }}
                        className="text-xs px-3 py-3 min-h-[48px] rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-green)] hover:border-[var(--accent-green)] transition-colors"
                      >
                        {brand.name}
                      </button>
                    );
                  })}
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
                    onSelect={(brand) => {
                      if (inputMode === 'search') {
                        const match = brand.adLibraryUrl.match(/view_all_page_id=(\d+)/);
                        if (match) {
                          setSelectedPage({ pageId: match[1], pageName: brand.pageName });
                          return;
                        }
                      }
                      setAdLibraryUrl(brand.adLibraryUrl);
                      if (inputMode === 'search') setInputMode('url');
                    }}
                    onRemove={removeFavorite}
                  />
                </div>
              )}
            </div>
          </form>

          {/* Brand Comparison Panel */}
          {comparisonBrands.length > 0 && (
            <div className="relative z-10 mb-8 animate-fade-in">
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
                      key={brand.pageId || `brand-${index}`}
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
                  {comparisonBrands.length < 3 && !isLoadingComparison && (
                    <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] animate-pulse-subtle">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {3 - comparisonBrands.length} slot{comparisonBrands.length < 2 ? 's' : ''} remaining
                    </div>
                  )}
                  {isLoadingComparison && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)]">
                      <LoadingSpinner size="sm" />
                      Loading brand...
                    </div>
                  )}
                </div>

                {/* Add Brand Input */}
                {comparisonBrands.length < 3 && (
                  <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={comparisonUrl}
                        onChange={(e) => setComparisonUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddToComparison(comparisonUrl);
                          }
                        }}
                        placeholder="Paste a Facebook Ad Library URL..."
                        className="input-field flex-1 text-sm"
                        disabled={isLoadingComparison}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddToComparison(comparisonUrl)}
                        disabled={isLoadingComparison || !comparisonUrl.trim()}
                        className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap"
                      >
                        {isLoadingComparison ? (
                          <>
                            <LoadingSpinner size="sm" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Brand
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[var(--text-muted)]">Quick add:</span>
                      {EXAMPLE_BRANDS
                        .filter(brand => {
                          const brandPageId = extractPageIdFromUrl(brand.adLibrary);
                          return !comparisonBrands.some(b => b.pageId === brandPageId);
                        })
                        .map((brand) => (
                          <button
                            key={brand.domain}
                            type="button"
                            onClick={() => handleAddToComparison(brand.adLibrary)}
                            disabled={isLoadingComparison}
                            className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-green)] hover:border-[var(--accent-green)] transition-colors disabled:opacity-50"
                          >
                            {brand.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

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
            <div className="relative z-10 animate-fade-in mb-8">
              <div id="analysis-results" className="glass rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-serif text-2xl text-[var(--text-primary)] mb-1">
                      {apiResult?.pageName || 'Analysing'}
                    </h2>
                    <p className="text-sm text-[var(--text-muted)]">
                      Facebook Ad Library Analysis
                    </p>
                  </div>
                  {apiResult && (
                    <div className="flex items-center gap-2">
                          {/* Save Brand */}
                          {session && !brandSaved && (
                            <button
                              type="button"
                              data-pdf-hide
                              onClick={handleSaveBrand}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-2 min-h-[48px] text-xs font-medium rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                              </svg>
                              {saving ? 'Saving...' : 'Save Brand'}
                            </button>
                          )}
                          {session && brandSaved && (
                            <span
                              data-pdf-hide
                              className="flex items-center gap-1.5 px-3 py-2 min-h-[48px] text-xs font-medium rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-muted)]"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Saved
                            </span>
                          )}
                          {/* Export Dropdown */}
                          <div className="relative group" data-pdf-hide ref={exportRef}>
                            <button
                              type="button"
                              onClick={() => setExportOpen(prev => !prev)}
                              className="flex items-center gap-1.5 px-3 py-2 min-h-[48px] text-xs font-medium rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              {isPdfExporting && pdfProgress ? pdfProgress.step : isPdfExporting ? 'Exporting...' : 'Export'}
                            </button>
                            <div className={`absolute right-0 top-full mt-1 w-48 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-xl transition-all z-10 ${exportOpen ? 'opacity-100 visible' : 'opacity-0 invisible'} group-hover:opacity-100 group-hover:visible`}>
                              {/* PDF Export */}
                              <button
                                onClick={async () => {
                                  setExportOpen(false);
                                  if (isPdfExporting) return;
                                  setIsPdfExporting(true);
                                  setPdfProgress(null);
                                  try {
                                    await exportToPDF(apiResult, 'analysis-results', {
                                      onProgress: (step, current, total) => {
                                        setPdfProgress({ step, current, total });
                                      },
                                      showAllTabs: async () => {
                                        setIsExporting(true);
                                        // Wait for React to render all tab content
                                        await new Promise(r => setTimeout(r, 100));
                                        return () => setIsExporting(false);
                                      },
                                    });
                                    toast.success('PDF exported successfully');
                                  } catch (error) {
                                    toast.error('Failed to export PDF', {
                                      description: error instanceof Error ? error.message : 'Unknown error',
                                    });
                                  } finally {
                                    setIsPdfExporting(false);
                                    setPdfProgress(null);
                                  }
                                }}
                                disabled={isPdfExporting}
                                className="w-full px-4 py-2 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
                              >
                                {isPdfExporting && pdfProgress ? pdfProgress.step : isPdfExporting ? 'Exporting...' : 'Full Report (PDF)'}
                              </button>
                              <div className="border-t border-[var(--border-subtle)] my-1" />
                              <button
                                onClick={() => { setExportOpen(false); exportFullReportToCSV(apiResult); }}
                                className="w-full px-4 py-2 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                              >
                                Full Report (CSV)
                              </button>
                              <button
                                onClick={() => { setExportOpen(false); exportAdsToCSV(apiResult); }}
                                className="w-full px-4 py-2 text-left text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                              >
                                Ads Only (CSV)
                              </button>
                              {apiResult.aggregatedDemographics && (
                                <button
                                  onClick={() => { setExportOpen(false); exportDemographicsToCSV(apiResult); }}
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
                            data-pdf-hide
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
                          {/* Dashboard tracking buttons - hidden until Pro launch */}
                    </div>
                  )}
                </div>

                {/* Account Summary - Key metrics at a glance */}
                {apiResult && (
                  <div data-pdf-section="account-summary">
                    <AccountSummary result={apiResult} />
                  </div>
                )}

                {/* Tab Navigation */}
                {apiResult && (
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] w-fit max-w-full overflow-x-auto mb-6" data-pdf-hide>
                    <button
                      onClick={() => setResultsTab('audience')}
                      className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                        resultsTab === 'audience'
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <svg className="w-4 h-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Audience Overview
                    </button>
                    <button
                      onClick={() => setResultsTab('ads')}
                      className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                        resultsTab === 'ads'
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <svg className="w-4 h-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Ad Overview
                    </button>
                    <button
                      onClick={() => setResultsTab('expert')}
                      className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                        resultsTab === 'expert'
                          ? 'bg-[var(--accent-green)] text-white'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                      }`}
                    >
                      <svg className="w-4 h-4 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

                {/* AUDIENCE OVERVIEW TAB CONTENT */}
                {(resultsTab === 'audience' || isExporting) && apiResult && (
                  <>
                    {/* Demographics Results */}
                    {apiResult.aggregatedDemographics && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif text-lg text-[var(--text-primary)]">
                            Audience <span className="italic text-[var(--accent-green-light)]">Demographics</span>
                          </h3>
                          <div className="text-xs text-[var(--text-muted)]">
                            {apiResult.aggregatedDemographics.adsWithDemographics} ads with demographic data
                          </div>
                        </div>

                        {chartFilter && (
                          <div data-pdf-hide>
                            <ActiveChartFilter label={chartFilter.label} onClear={() => setChartFilter(null)} />
                          </div>
                        )}

                        {/* Summary */}
                        <div className="glass rounded-xl p-5" data-pdf-section="key-insights">
                          <h4 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
                            Key Insights
                          </h4>
                          <DemographicsSummary
                            demographics={apiResult.aggregatedDemographics}
                          />
                        </div>

                        {/* Charts */}
                        <div className="space-y-3">
                          {/* Age/Gender Chart */}
                          <details className="group glass rounded-xl overflow-hidden" data-pdf-section="age-gender-chart" open>
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
                                onSegmentClick={(filter) => setChartFilter(prev => prev?.value === filter.value && prev?.type === filter.type ? null : filter)}
                                activeFilter={chartFilter}
                              />
                            </div>
                          </details>

                          {/* Country Chart */}
                          <details className="group glass rounded-xl overflow-hidden" data-pdf-section="country-chart" open>
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
                                onSegmentClick={(filter) => setChartFilter(prev => prev?.value === filter.value && prev?.type === filter.type ? null : filter)}
                                activeFilter={chartFilter}
                              />
                            </div>
                          </details>
                        </div>
                      </div>
                    )}

                    {/* No demographics available */}
                    {!apiResult.aggregatedDemographics && (
                      <div className="glass rounded-xl p-8 text-center">
                        <svg className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No Demographic Data Available</h3>
                        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
                          Demographics are only available for ads targeting EU countries due to DSA transparency requirements.
                          Try selecting "EU Only" in the region filter for demographic insights.
                        </p>
                      </div>
                    )}

                    {/* Info about data source */}
                    <div className="mt-6 flex gap-2 text-xs text-[var(--text-muted)]">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Demographics based on EU DSA transparency requirements. Data shows reach by age, gender, and country for EU-targeted ads.
                      </span>
                    </div>
                  </>
                )}

                {/* AD OVERVIEW TAB CONTENT */}
                {(resultsTab === 'ads' || isExporting) && apiResult && (
                  <>
                    {chartFilter && (
                      <div className="mb-4" data-pdf-hide>
                        <ActiveChartFilter label={chartFilter.label} onClear={() => setChartFilter(null)} />
                      </div>
                    )}

                    {/* Top Ads by Reach - Featured ad previews */}
                    {apiResult.ads.length > 0 && (
                      <FeatureGate feature="adPreviews">
                        <div className="glass rounded-xl p-5 mb-6" data-pdf-section="ad-previews">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-serif text-lg text-[var(--text-primary)]">
                              Top <span className="italic text-[var(--accent-green-light)]">Performers</span>
                            </h3>
                            <span className="text-xs text-[var(--text-muted)]">By EU reach</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...apiResult.ads]
                              .sort((a, b) => b.euTotalReach - a.euTotalReach)
                              .slice(0, 6)
                              .map((ad, index) => (
                                <AdPreviewCard key={ad.adArchiveId || index} ad={ad} />
                              ))}
                          </div>
                        </div>
                      </FeatureGate>
                    )}

                    {/* Trend Analysis */}
                    {timelineAds && timelineAds.length > 0 && (
                      <div className="space-y-4 mb-6" data-pdf-section="time-trends">
                        <div className="flex items-center justify-between">
                          <h3 className="font-serif text-lg text-[var(--text-primary)]">
                            Trend <span className="italic text-[var(--accent-green-light)]">Analysis</span>
                          </h3>
                          <div className="text-xs text-[var(--text-muted)]">
                            {activeStatus === 'ACTIVE' && timelineAds.length !== apiResult.ads.length && (
                              <span className="text-[var(--accent-yellow)] mr-2">Includes inactive ads</span>
                            )}
                            Advertising trends over time
                          </div>
                        </div>
                        <div className="glass rounded-xl p-5">
                          <TrendAnalysis ads={timelineAds} />
                        </div>
                      </div>
                    )}

                    {/* Ad Copy Analysis */}
                    {apiResult.ads.length > 0 && (
                      <div className="space-y-4 mb-6" data-pdf-section="ad-copy-analysis">
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

                    {/* Ad Longevity Analysis */}
                    {apiResult.ads.length > 0 && (
                      <div className="space-y-4 mb-6" data-pdf-section="ad-longevity">
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

                    {/* Landing Page Analysis */}
                    {apiResult.ads.length > 0 && (
                      <div className="space-y-4 mb-6" data-pdf-section="landing-pages">
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

                    {/* Product Market Analysis (if available) */}
                    {apiResult.productAnalysis && apiResult.productAnalysis.products.length > 0 && (
                      <div className="space-y-4 mb-6" data-pdf-section="product-analysis">
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

                    {/* All Active Ads - expandable list (at bottom) */}
                    {apiResult.ads.length > 0 && (
                      <div className="mt-6" data-pdf-section="ad-table">
                        <details className="group">
                          <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-green-light)] transition-colors">
                            <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            View all {apiResult.totalAdsFound} ads
                            {chartFilter && !isExporting && filteredAds.length !== apiResult.ads.length && (
                              <span className="text-xs text-emerald-400 font-normal ml-1">(showing {filteredAds.length})</span>
                            )}
                          </summary>
                          <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                          <div className="max-h-[400px] overflow-y-auto bg-[var(--bg-tertiary)]">
                            <table className="w-full text-sm min-w-[640px]">
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
                                {(isExporting ? apiResult.ads : filteredAds).map((ad, index) => (
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
                          </div>
                        </details>
                      </div>
                    )}

                    {/* Info about API data source */}
                    <div className="mt-6 flex gap-2 text-xs text-[var(--text-muted)]">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        Data fetched via official Facebook API. Reach numbers represent people reached in selected EU countries.
                      </span>
                    </div>
                  </>
                )}

                {/* EXPERT ANALYSIS TAB CONTENT */}
                {(resultsTab === 'expert' || isExporting) && apiResult && apiResult.ads.length > 0 && (
                  <div className="mt-4" data-pdf-section="expert-analysis">
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
