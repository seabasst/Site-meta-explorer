'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3,
  Target,
  Grid3X3,
  Copy,
  Check,
  X,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Globe,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { TAXONOMY, CATEGORY_KEYS } from '@/lib/classification/taxonomy';
import { GapMatrix } from './gap-matrix';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrategyViewProps {
  brand: {
    pageId: string;
    pageName: string;
    adCount: number;
    iconUrl?: string;
    category: string | null;
    source: string;
  };
  darkMode: boolean;
  onBack: () => void;
}

interface StrategyData {
  brand: {
    pageName: string;
    category: string | null;
    website: string | null;
    activeAdCount: number;
    demographics: unknown;
  };
  classificationCoverage: { classified: number; total: number };
  taxonomyBreakdown: Record<string, Record<string, number>>;
  diversityScores: Record<string, number>;
  gapMatrix: Record<string, Record<string, number>>;
  maxCellCount: number;
}

interface Concept {
  visualFormat: string;
  creativeMechanic: string;
  hook: string;
  messagingAngle: string;
  productionBrief: string;
}

// ---------------------------------------------------------------------------
// Score color helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score <= 30) return '#ef4444';    // red
  if (score <= 60) return '#f59e0b';    // amber
  return '#22c55e';                      // green
}

function scoreBg(score: number, darkMode: boolean): string {
  if (score <= 30) return darkMode ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)';
  if (score <= 60) return darkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)';
  return darkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)';
}

// ---------------------------------------------------------------------------
// Category labels for diversity pills
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  assetType: 'Asset Type',
  visualFormat: 'Visual Format',
  hookTactic: 'Hook Tactic',
  messagingAngle: 'Messaging',
  awarenessStage: 'Awareness',
  creativeMechanic: 'Mechanic',
  offerType: 'Offer Type',
  intendedAudience: 'Audience',
  overall: 'Overall',
};

// ---------------------------------------------------------------------------
// StrategyView
// ---------------------------------------------------------------------------

export function StrategyView({ brand, darkMode, onBack }: StrategyViewProps) {
  // Data loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [strategyData, setStrategyData] = useState<StrategyData | null>(null);

  // Concept generation
  const [selectedCell, setSelectedCell] = useState<{ stage: string; format: string } | null>(null);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [concept, setConcept] = useState<Concept | null>(null);
  const [conceptError, setConceptError] = useState('');

  // Copy state
  const [copied, setCopied] = useState(false);

  // Taxonomy section collapse
  const [taxonomyExpanded, setTaxonomyExpanded] = useState(true);

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-100';
  const cardBorder = darkMode ? 'border-slate-700/50' : 'border-slate-200';
  const cardBg = darkMode ? 'bg-[#101322]' : 'bg-white';

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  useEffect(() => {
    async function loadStrategy() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/strategy/${brand.pageId}`);
        if (res.status === 422) {
          const data = await res.json().catch(() => ({}));
          setError(
            data.needsClassification
              ? `Only ${data.classifiedCount} of ${data.totalAds} ads classified. Classify more ads from the Ad Library before using Strategy.`
              : data.error || 'Insufficient classification data.'
          );
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load strategy data');
        }
        const data: StrategyData = await res.json();
        setStrategyData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    loadStrategy();
  }, [brand.pageId]);

  // -------------------------------------------------------------------------
  // Concept generation
  // -------------------------------------------------------------------------

  async function handleCellClick(awarenessStage: string, visualFormat: string, _count: number) {
    setSelectedCell({ stage: awarenessStage, format: visualFormat });
    setGeneratingConcept(true);
    setConcept(null);
    setConceptError('');
    setCopied(false);

    try {
      const res = await fetch('/api/strategy/generate-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: brand.pageId, awarenessStage, visualFormat }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate concept');
      }
      const data = await res.json();
      setConcept(data.concept);
    } catch (err) {
      setConceptError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGeneratingConcept(false);
    }
  }

  function handleGenerateAnother() {
    if (selectedCell) {
      handleCellClick(selectedCell.stage, selectedCell.format, 0);
    }
  }

  function handleCloseModal() {
    setSelectedCell(null);
    setConcept(null);
    setConceptError('');
    setCopied(false);
  }

  // -------------------------------------------------------------------------
  // Copy to clipboard
  // -------------------------------------------------------------------------

  async function handleCopy() {
    if (!concept || !selectedCell) return;

    const stageLabel =
      TAXONOMY.awarenessStage.labels[selectedCell.stage as keyof typeof TAXONOMY.awarenessStage.labels] ||
      selectedCell.stage;
    const formatLabel =
      TAXONOMY.visualFormat.labels[selectedCell.format as keyof typeof TAXONOMY.visualFormat.labels] ||
      selectedCell.format;

    const text = `Strategy Concept: ${stageLabel} x ${formatLabel}
---
Visual Format: ${concept.visualFormat}
Creative Mechanic: ${concept.creativeMechanic}
Hook: "${concept.hook}"
Messaging Angle: ${concept.messagingAngle}

Production Brief:
${concept.productionBrief}`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
    }
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className={`text-sm ${muted} hover:text-[#1235e2] transition-colors`}
        >
          &larr; Back
        </button>
        <div className="max-w-2xl mx-auto pt-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#1235e2]/10 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-[#1235e2] animate-spin" />
            </div>
            <h2 className="text-lg font-bold mb-2">
              Loading strategy for {brand.pageName}...
            </h2>
            <p className={`text-sm ${muted}`}>
              Assembling taxonomy breakdown and gap matrix
            </p>
          </div>
          <div className="space-y-4 animate-pulse">
            <div className={`h-16 rounded-xl ${mutedBg}`} />
            <div className={`h-48 rounded-xl ${mutedBg}`} />
            <div className={`h-64 rounded-xl ${mutedBg}`} />
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className={`text-sm ${muted} hover:text-[#1235e2] transition-colors`}
        >
          &larr; Back
        </button>
        <div className="max-w-lg mx-auto pt-8">
          <div
            className={`rounded-xl border p-8 text-center ${
              darkMode ? 'border-red-500/20 bg-red-500/5' : 'border-red-100 bg-red-50'
            }`}
          >
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-red-400 mb-1">Strategy Unavailable</p>
            <p className={`text-sm ${muted} mb-6`}>{error}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={onBack}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  darkMode
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!strategyData) return null;

  const { classificationCoverage, taxonomyBreakdown, diversityScores, gapMatrix, maxCellCount } =
    strategyData;
  const coveragePct =
    classificationCoverage.total > 0
      ? Math.round((classificationCoverage.classified / classificationCoverage.total) * 100)
      : 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* A. Brand Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`text-sm ${muted} hover:text-[#1235e2] transition-colors`}
          >
            &larr; Back
          </button>
          <div className="flex items-center gap-2">
            {brand.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.iconUrl}
                alt=""
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <Globe className="w-5 h-5 text-[#1235e2]" />
            )}
            <span className="font-bold">{strategyData.brand.pageName}</span>
            {strategyData.brand.category && (
              <span className={`text-xs ${muted}`}>&middot; {strategyData.brand.category}</span>
            )}
          </div>
        </div>

        {/* Coverage badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            coveragePct >= 50
              ? darkMode
                ? 'bg-green-500/10 text-green-400'
                : 'bg-green-50 text-green-600'
              : darkMode
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-amber-50 text-amber-600'
          }`}
        >
          <BarChart3 className="w-3 h-3" />
          {classificationCoverage.classified} of {classificationCoverage.total} classified ({coveragePct}%)
        </div>
      </div>

      {/* B. Diversity Overview */}
      <div
        className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}
      >
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#1235e2]" />
          Diversity Scores
        </h3>

        {/* Overall score prominent */}
        <div className="flex items-center gap-4 mb-4">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-lg font-black"
            style={{
              backgroundColor: scoreBg(diversityScores.overall ?? 0, darkMode),
              color: scoreColor(diversityScores.overall ?? 0),
            }}
          >
            <span className="text-sm font-medium opacity-70">Overall</span>
            <span>{diversityScores.overall ?? 0}</span>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORY_KEYS.map((key) => {
            const score = diversityScores[key] ?? 0;
            return (
              <div
                key={key}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: scoreBg(score, darkMode),
                  color: scoreColor(score),
                }}
              >
                <span className="opacity-70">{CATEGORY_LABELS[key] || key}</span>
                <span className="font-black">{score}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* C. Taxonomy Breakdown */}
      <div
        className={`rounded-xl border ${cardBorder} ${cardBg}`}
      >
        <button
          onClick={() => setTaxonomyExpanded(!taxonomyExpanded)}
          className="w-full flex items-center justify-between p-5 text-left"
        >
          <h3 className="text-sm font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#1235e2]" />
            Taxonomy Breakdown
          </h3>
          {taxonomyExpanded ? (
            <ChevronDown className={`w-4 h-4 ${muted}`} />
          ) : (
            <ChevronRight className={`w-4 h-4 ${muted}`} />
          )}
        </button>

        {taxonomyExpanded && (
          <div className="px-5 pb-5 space-y-6">
            {CATEGORY_KEYS.map((key) => {
              const distribution = taxonomyBreakdown[key] || {};
              const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a);
              const maxCount = entries.length > 0 ? entries[0][1] : 0;
              const taxCat = TAXONOMY[key];

              return (
                <div key={key}>
                  <h4
                    className="text-xs font-semibold mb-2 uppercase tracking-wider"
                    title={taxCat.description}
                  >
                    {CATEGORY_LABELS[key] || key}
                  </h4>
                  <div className="space-y-1">
                    {entries.map(([value, count]) => {
                      const label =
                        (taxCat.labels as Record<string, string>)[value] || value;
                      const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

                      return (
                        <div key={value} className="flex items-center gap-2 text-xs">
                          <span
                            className={`w-28 shrink-0 truncate ${muted}`}
                            title={label}
                          >
                            {label}
                          </span>
                          <div
                            className={`flex-1 h-5 rounded-sm overflow-hidden ${
                              darkMode ? 'bg-slate-800' : 'bg-slate-100'
                            }`}
                          >
                            <div
                              className="h-full rounded-sm bg-[#1235e2]/60 transition-all"
                              style={{ width: `${pct}%`, minWidth: count > 0 ? '4px' : '0px' }}
                            />
                          </div>
                          <span className="w-8 text-right font-mono font-medium tabular-nums">
                            {count}
                          </span>
                        </div>
                      );
                    })}

                    {entries.length === 0 && (
                      <p className={`text-xs ${muted}`}>No data</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* D. Gap Matrix */}
      <div
        className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}
      >
        <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
          <Grid3X3 className="w-4 h-4 text-[#1235e2]" />
          Creative Gap Matrix
        </h3>
        <p className={`text-xs ${muted} mb-4`}>
          Awareness Stages vs Visual Formats — click any cell to generate a concept
        </p>

        <GapMatrix
          gapMatrix={gapMatrix}
          maxCellCount={maxCellCount}
          darkMode={darkMode}
          onCellClick={handleCellClick}
          loadingCell={
            generatingConcept && selectedCell
              ? { stage: selectedCell.stage, format: selectedCell.format }
              : null
          }
        />
      </div>

      {/* E. Concept Modal */}
      {selectedCell && (concept || generatingConcept || conceptError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className={`relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl ${
              darkMode
                ? 'bg-[#101322] border-slate-700/50'
                : 'bg-white border-slate-200'
            }`}
          >
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b ${cardBorder}">
              <div>
                <h3 className="text-sm font-bold">
                  Concept for{' '}
                  {TAXONOMY.awarenessStage.labels[
                    selectedCell.stage as keyof typeof TAXONOMY.awarenessStage.labels
                  ] || selectedCell.stage}{' '}
                  x{' '}
                  {TAXONOMY.visualFormat.labels[
                    selectedCell.format as keyof typeof TAXONOMY.visualFormat.labels
                  ] || selectedCell.format}
                </h3>
                <p className={`text-xs ${muted} mt-0.5`}>{brand.pageName}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className={`p-1.5 rounded-lg transition-colors ${
                  darkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5">
              {/* Loading skeleton */}
              {generatingConcept && !concept && (
                <div className="space-y-4 animate-pulse">
                  <div className={`h-8 rounded-lg ${mutedBg}`} />
                  <div className={`h-8 rounded-lg ${mutedBg}`} />
                  <div className={`h-12 rounded-lg ${mutedBg}`} />
                  <div className={`h-8 rounded-lg ${mutedBg}`} />
                  <div className={`h-24 rounded-lg ${mutedBg}`} />
                </div>
              )}

              {/* Error state */}
              {conceptError && (
                <div className="text-center py-6">
                  <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm text-red-400 mb-4">{conceptError}</p>
                  <button
                    onClick={handleGenerateAnother}
                    className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              )}

              {/* Concept content */}
              {concept && (
                <div className="space-y-4">
                  {/* Visual Format */}
                  <div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>
                      Visual Format
                    </span>
                    <p className="text-sm font-medium mt-0.5">{concept.visualFormat}</p>
                  </div>

                  {/* Creative Mechanic */}
                  <div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>
                      Creative Mechanic
                    </span>
                    <p className="text-sm font-medium mt-0.5">{concept.creativeMechanic}</p>
                  </div>

                  {/* Hook - prominent */}
                  <div
                    className={`rounded-lg border p-4 ${
                      darkMode
                        ? 'border-[#1235e2]/20 bg-[#1235e2]/5'
                        : 'border-[#1235e2]/10 bg-blue-50/50'
                    }`}
                  >
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>
                      Hook
                    </span>
                    <p className="text-sm font-bold mt-1 text-[#1235e2]">
                      &ldquo;{concept.hook}&rdquo;
                    </p>
                  </div>

                  {/* Messaging Angle */}
                  <div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>
                      Messaging Angle
                    </span>
                    <p className="text-sm font-medium mt-0.5">{concept.messagingAngle}</p>
                  </div>

                  {/* Production Brief - multi-line callout */}
                  <div
                    className={`rounded-lg p-4 ${
                      darkMode ? 'bg-slate-800/60' : 'bg-slate-50'
                    }`}
                  >
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>
                      Production Brief
                    </span>
                    <p className={`text-sm mt-1 leading-relaxed whitespace-pre-wrap ${muted}`}>
                      {concept.productionBrief}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            {concept && (
              <div
                className={`sticky bottom-0 flex items-center gap-2 p-4 border-t ${
                  darkMode ? 'border-slate-700/50 bg-[#101322]' : 'border-slate-200 bg-white'
                }`}
              >
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    copied
                      ? 'bg-green-500/10 text-green-500'
                      : darkMode
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy to Clipboard'}
                </button>
                <button
                  onClick={handleGenerateAnother}
                  disabled={generatingConcept}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generatingConcept ? 'animate-spin' : ''}`} />
                  Generate Another
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
