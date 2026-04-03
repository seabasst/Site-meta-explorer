'use client';

import { useState, useRef, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Wand2,
  Loader2,
  Search,
  Globe,
  AlertTriangle,
  Sparkles,
  FileText,
  BarChart3,
  Target,
} from 'lucide-react';
import { V2Shell } from '../v2-shell';
import { useV2 } from '../v2-context';
import { ConfigScreen } from './config-screen';
import { GenerationGallery } from './generation-gallery';
import { UGCBriefView } from './ugc-brief-view';
import { AnalysisView } from './analysis-view';
import { StrategyView } from './strategy-view';
import type {
  GenerationConfig,
  GenerationSuggestion,
  GenerationResult,
  UGCBrief,
} from '@/lib/creative-lab-types';
import { OnboardingPrompt } from '@/components/onboarding-prompt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  pageId: string;
  pageName: string;
  adCount: number;
  iconUrl?: string;
  category: string | null;
  source: string;
}

type FlowState = 'search' | 'mode-select' | 'analysis' | 'strategy' | 'config' | 'gallery' | 'brief-loading' | 'brief';

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CreativeLabPageWrapper() {
  return (
    <Suspense>
      <CreativeLabPage />
    </Suspense>
  );
}

function CreativeLabPage() {
  const { darkMode } = useV2();
  const searchParams = useSearchParams();

  // -- State ----------------------------------------------------------------

  const [flowState, setFlowState] = useState<FlowState>('search');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<SearchResult | null>(null);

  // Config state
  const [config, setConfig] = useState<GenerationConfig | null>(null);
  const [suggestions, setSuggestions] = useState<GenerationSuggestion[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState('');

  // Gallery state
  const [results, setResults] = useState<GenerationResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Brief state
  const [brief, setBrief] = useState<UGCBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState('');

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-100';

  // -- Deep link: ?pageId=X&pageName=Y&mode=analysis ----------------------

  const deepLinked = useRef(false);
  useEffect(() => {
    if (deepLinked.current) return;
    const pageId = searchParams.get('pageId');
    const pageName = searchParams.get('pageName');
    const mode = searchParams.get('mode');
    if (pageId && pageName) {
      deepLinked.current = true;
      const brand: SearchResult = {
        pageId,
        pageName,
        adCount: 0,
        category: searchParams.get('category') || null,
        source: 'api',
      };
      setSelectedBrand(brand);
      setSearchQuery(pageName);
      if (mode === 'analysis') {
        setFlowState('analysis');
      } else if (mode === 'strategy') {
        setFlowState('strategy');
      } else if (mode === 'generate') {
        setFlowState('mode-select');
      } else {
        setFlowState('mode-select');
      }
    }
  }, [searchParams]);

  // -- Search ---------------------------------------------------------------

  const searchPages = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search-pages?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // Silently fail -- search is not critical
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchPages(value), 300);
  }

  // -- Brand selection -> mode select ---------------------------------------

  function handleSelectBrand(brand: SearchResult) {
    setSelectedBrand(brand);
    setSearchResults([]);
    setSearchQuery(brand.pageName);
    setFlowState('mode-select');
  }

  // -- Mode: Analyze Brand ---------------------------------------------------

  function handleChooseAnalysis() {
    setFlowState('analysis');
  }

  function handleChooseStrategy() {
    setFlowState('strategy');
  }

  // -- Mode: Generate Ad Creatives -> load config ---------------------------

  async function handleChooseCreatives() {
    if (!selectedBrand) return;
    setFlowState('config');
    setConfigLoading(true);
    setConfigError('');

    try {
      const res = await fetch('/api/creative-lab/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: selectedBrand.pageId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404 && data.error?.includes('No cached analysis')) {
          // Auto-redirect to analysis which will classify + cache
          setConfigLoading(false);
          setFlowState('analysis');
          return;
        }
        setConfigError(data.error || 'Failed to generate config. Please try again.');
        return;
      }

      const data: GenerationConfig = await res.json();
      setConfig(data);
      setSuggestions(data.suggestions);
    } catch {
      setConfigError('Network error. Please check your connection and try again.');
    } finally {
      setConfigLoading(false);
    }
  }

  // -- Mode: Generate UGC Brief --------------------------------------------

  async function handleGenerateBrief() {
    if (!selectedBrand) return;
    setBriefLoading(true);
    setBriefError('');
    setFlowState('brief-loading');

    try {
      const res = await fetch('/api/creative-lab/generate-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: selectedBrand.pageId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404 && data.error?.includes('No cached analysis')) {
          // Auto-redirect to analysis which will classify + cache
          setBriefLoading(false);
          setFlowState('analysis');
          return;
        }
        setBriefError(data.error || 'Failed to generate brief. Please try again.');
        return;
      }

      const data: UGCBrief = await res.json();
      setBrief(data);
      setFlowState('brief');
    } catch {
      setBriefError('Network error. Please check your connection and try again.');
    } finally {
      setBriefLoading(false);
    }
  }

  // -- Generation ------------------------------------------------------------

  async function handleGenerate() {
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) return;

    setIsGenerating(true);
    setFlowState('gallery');

    // Initialize results with idle status
    const initialResults: GenerationResult[] = selected.map((s) => ({
      suggestion: s,
      status: 'idle',
      imageUrl: null,
    }));
    setResults(initialResults);

    // Generate with concurrency limit of 3
    const CONCURRENCY = 3;

    async function generateOne(suggestion: GenerationSuggestion, index: number) {
      // Set to loading
      setResults((prev) =>
        prev.map((r, i) => (i === index ? { ...r, status: 'loading' as const } : r))
      );

      try {
        const res = await fetch('/api/creative-lab/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: suggestion.imagePrompt,
            aspectRatio: suggestion.aspectRatio,
            useBrandGuidelines: true,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Generation failed');
        }

        const data = await res.json();
        setResults((prev) =>
          prev.map((r, i) =>
            i === index
              ? { ...r, status: 'success' as const, imageUrl: data.imageUrl }
              : r
          )
        );
      } catch (err) {
        setResults((prev) =>
          prev.map((r, i) =>
            i === index
              ? {
                  ...r,
                  status: 'error' as const,
                  error: err instanceof Error ? err.message : 'Unknown error',
                }
              : r
          )
        );
      }
    }

    // Process in batches of CONCURRENCY
    for (let i = 0; i < selected.length; i += CONCURRENCY) {
      const batch = selected.slice(i, i + CONCURRENCY);
      const batchIndices = batch.map((_, bIdx) => i + bIdx);
      await Promise.allSettled(
        batch.map((s, bIdx) => generateOne(s, batchIndices[bIdx]))
      );
    }

    setIsGenerating(false);
  }

  // -- Navigation -----------------------------------------------------------

  function handleBackToConfig() {
    setFlowState('config');
    setResults([]);
  }

  function handleBackToSearch() {
    setFlowState('search');
    setConfig(null);
    setSuggestions([]);
    setConfigError('');
    setBrief(null);
    setBriefError('');
    setSelectedBrand(null);
    setSearchQuery('');
  }

  function handleBackToModeSelect() {
    setFlowState('mode-select');
    // Clear config state
    setConfig(null);
    setSuggestions([]);
    setConfigError('');
    setConfigLoading(false);
    // Clear brief state
    setBrief(null);
    setBriefError('');
    setBriefLoading(false);
  }

  // -- Shared brand header --------------------------------------------------

  function renderBrandHeader(backHandler: () => void) {
    return (
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={backHandler}
          className={`text-sm ${muted} hover:text-[#1235e2] transition-colors`}
        >
          &larr; Back
        </button>
        {selectedBrand && (
          <div className="flex items-center gap-2">
            {selectedBrand.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedBrand.iconUrl}
                alt=""
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <Globe className="w-5 h-5 text-[#1235e2]" />
            )}
            <span className="text-sm font-semibold">{selectedBrand.pageName}</span>
          </div>
        )}
      </div>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <V2Shell title="Creative Lab">
      <OnboardingPrompt darkMode={darkMode} />

      {/* Search state */}
      {flowState === 'search' && (
        <div className="max-w-2xl mx-auto pt-12">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#1235e2]/10 flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-8 h-8 text-[#1235e2]" />
            </div>
            <h1 className="text-2xl font-black mb-2">Creative Lab</h1>
            <p className={`text-sm ${muted} max-w-md mx-auto`}>
              Search for a brand to analyze creative strategy and benchmark against competitors.
            </p>
          </div>

          {/* Search input */}
          <div className="relative">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                darkMode
                  ? 'bg-[#1235e2]/5 border-[#1235e2]/20 focus-within:border-[#1235e2]/40'
                  : 'bg-white border-slate-200 focus-within:border-[#1235e2]'
              }`}
            >
              {searching ? (
                <Loader2 className="w-5 h-5 text-[#1235e2] animate-spin shrink-0" />
              ) : (
                <Search className={`w-5 h-5 ${muted} shrink-0`} />
              )}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search for a brand..."
                className={`w-full bg-transparent outline-none text-sm ${
                  darkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div
                className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-20 overflow-hidden ${
                  darkMode ? 'bg-[#101322] border-[#1235e2]/20' : 'bg-white border-slate-200'
                }`}
              >
                {searchResults.map((result) => (
                  <button
                    key={result.pageId}
                    onClick={() => handleSelectBrand(result)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      darkMode ? 'hover:bg-[#1235e2]/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    {result.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={result.iconUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          darkMode ? 'bg-slate-800' : 'bg-slate-100'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-[#1235e2]" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{result.pageName}</p>
                      <p className={`text-xs ${muted}`}>
                        {result.adCount} ads &middot; {result.source}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode select state */}
      {flowState === 'mode-select' && (
        <div className="max-w-3xl mx-auto">
          {renderBrandHeader(handleBackToSearch)}

          <div className="text-center mb-8">
            <h2 className="text-lg font-bold mb-1">What would you like to do?</h2>
            <p className={`text-sm ${muted}`}>
              Choose an analysis mode for {selectedBrand?.pageName}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Analyze Brand */}
            <button
              onClick={handleChooseAnalysis}
              className={`group text-left rounded-xl border-2 p-6 transition-all ${
                darkMode
                  ? 'border-[#1235e2]/10 bg-[#101322] hover:border-[#1235e2]/40 hover:bg-[#1235e2]/5'
                  : 'border-slate-200 bg-white hover:border-[#1235e2] hover:bg-blue-50/30'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-[#1235e2]/10 flex items-center justify-center mb-4 group-hover:bg-[#1235e2]/20 transition-colors">
                <BarChart3 className="w-6 h-6 text-[#1235e2]" />
              </div>
              <h3 className="text-base font-bold mb-1">Analyze Brand</h3>
              <p className={`text-sm ${muted}`}>
                Benchmark creative strategy against category with 8-dimension diversity analysis.
              </p>
            </button>

            {/* Strategy */}
            <button
              onClick={handleChooseStrategy}
              className={`group text-left rounded-xl border-2 p-6 transition-all relative ${
                darkMode
                  ? 'border-[#1235e2]/30 bg-[#101322] hover:border-[#1235e2]/60 hover:bg-[#1235e2]/5'
                  : 'border-[#1235e2]/20 bg-white hover:border-[#1235e2] hover:bg-blue-50/30'
              }`}
            >
              <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1235e2]/10 text-[#1235e2]">
                New
              </span>
              <div className="w-12 h-12 rounded-xl bg-[#1235e2]/10 flex items-center justify-center mb-4 group-hover:bg-[#1235e2]/20 transition-colors">
                <Target className="w-6 h-6 text-[#1235e2]" />
              </div>
              <h3 className="text-base font-bold mb-1">Strategy</h3>
              <p className={`text-sm ${muted}`}>
                Taxonomy-based gap analysis with interactive concept generation.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Analysis state */}
      {flowState === 'analysis' && selectedBrand && (
        <div className="max-w-4xl mx-auto">
          <AnalysisView
            brand={selectedBrand}
            darkMode={darkMode}
            onBack={handleBackToModeSelect}
          />
        </div>
      )}

      {/* Strategy state */}
      {flowState === 'strategy' && selectedBrand && (
        <div className="max-w-6xl mx-auto">
          <StrategyView
            brand={selectedBrand}
            darkMode={darkMode}
            onBack={handleBackToModeSelect}
          />
        </div>
      )}

      {/* Config state */}
      {flowState === 'config' && (
        <div className="max-w-4xl mx-auto">
          {renderBrandHeader(handleBackToModeSelect)}

          {/* Loading skeleton */}
          {configLoading && (
            <div className="space-y-4 animate-pulse">
              <div className={`h-20 rounded-xl ${mutedBg}`} />
              <div className={`h-12 rounded-xl ${mutedBg}`} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-40 rounded-xl ${mutedBg}`} />
                ))}
              </div>
            </div>
          )}

          {/* Config error */}
          {configError && !configLoading && (
            <div
              className={`rounded-xl border p-6 text-center ${
                darkMode ? 'border-red-500/20 bg-red-500/5' : 'border-red-100 bg-red-50'
              }`}
            >
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-red-400 mb-1">Unable to Load Config</p>
              <p className={`text-sm ${muted}`}>{configError}</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                {configError.includes('analyzed') ? (
                  <>
                    <button
                      onClick={handleChooseAnalysis}
                      className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
                    >
                      Run Analysis First
                    </button>
                    <button
                      onClick={handleBackToModeSelect}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'} transition-colors`}
                    >
                      Back
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleBackToModeSelect}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Config screen */}
          {config && !configLoading && !configError && (
            <ConfigScreen
              config={config}
              suggestions={suggestions}
              onSuggestionsChange={setSuggestions}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              darkMode={darkMode}
            />
          )}
        </div>
      )}

      {/* Brief loading state */}
      {flowState === 'brief-loading' && (
        <div className="max-w-4xl mx-auto">
          {renderBrandHeader(handleBackToModeSelect)}

          {briefError ? (
            <div
              className={`rounded-xl border p-6 text-center ${
                darkMode ? 'border-red-500/20 bg-red-500/5' : 'border-red-100 bg-red-50'
              }`}
            >
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-red-400 mb-1">Unable to Generate Brief</p>
              <p className={`text-sm ${muted}`}>{briefError}</p>
              <button
                onClick={handleBackToModeSelect}
                className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-pulse">
              <div className={`h-24 rounded-xl ${mutedBg}`} />
              <div className={`h-16 rounded-xl ${mutedBg}`} />
              <div className={`h-48 rounded-xl ${mutedBg}`} />
              <div className={`h-32 rounded-xl ${mutedBg}`} />
              <div className={`h-20 rounded-xl ${mutedBg}`} />
            </div>
          )}
        </div>
      )}

      {/* Brief state */}
      {flowState === 'brief' && brief && (
        <div className="max-w-4xl mx-auto">
          <UGCBriefView
            brief={brief}
            darkMode={darkMode}
            onBack={handleBackToModeSelect}
          />
        </div>
      )}

      {/* Gallery state */}
      {flowState === 'gallery' && (
        <div className="max-w-6xl mx-auto">
          <GenerationGallery
            results={results}
            darkMode={darkMode}
            onBack={handleBackToConfig}
          />
        </div>
      )}
    </V2Shell>
  );
}
