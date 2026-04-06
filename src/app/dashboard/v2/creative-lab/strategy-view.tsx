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
  Lightbulb,
  TrendingUp,
  Zap,
  ArrowRight,
  Sparkles,
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

interface BrandContext {
  name: string;
  positioning: string | null;
  brandVoice: string | null;
  demographics: string[];
  painPoints: string[];
  interests: string[];
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
  brandContext?: BrandContext | null;
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
// Summary & Recommendations helpers
// ---------------------------------------------------------------------------

function getOverallVerdict(score: number): { label: string; description: string } {
  if (score >= 75) return { label: 'Strong', description: 'This account has a well-diversified creative strategy. Most taxonomy categories are covered, which helps avoid audience fatigue and keeps performance stable.' };
  if (score >= 50) return { label: 'Moderate', description: 'This account has reasonable creative diversity but there are clear gaps. Some ad categories are over-indexed while others are underused, which can limit reach and cause fatigue.' };
  if (score >= 30) return { label: 'Narrow', description: 'This account relies heavily on a few creative approaches. The lack of diversity means the algorithm has fewer signals to optimize against, and audiences will fatigue faster.' };
  return { label: 'Very Narrow', description: 'This account has minimal creative diversity. Most ads follow the same pattern, severely limiting Meta\'s ability to find new audiences and optimize delivery.' };
}

function generateRecommendations(
  diversityScores: Record<string, number>,
  taxonomyBreakdown: Record<string, Record<string, number>>,
  gapMatrix: Record<string, Record<string, number>>,
  brandContext?: BrandContext | null,
): Array<{ priority: 'high' | 'medium' | 'low'; title: string; detail: string }> {
  const recs: Array<{ priority: 'high' | 'medium' | 'low'; title: string; detail: string }> = [];

  // Brand context helpers — always guard for null/empty
  const hasDemographics = brandContext?.demographics && brandContext.demographics.length > 0;
  const hasPainPoints = brandContext?.painPoints && brandContext.painPoints.length > 0;
  const hasPositioning = brandContext?.positioning && brandContext.positioning.trim().length > 0;

  // Find weakest categories
  const weakCategories = CATEGORY_KEYS
    .filter(k => (diversityScores[k] ?? 0) < 40)
    .sort((a, b) => (diversityScores[a] ?? 0) - (diversityScores[b] ?? 0));

  // 1. Weakest category recommendations
  for (const key of weakCategories.slice(0, 3)) {
    const score = diversityScores[key] ?? 0;
    const dist = taxonomyBreakdown[key] || {};
    const entries = Object.entries(dist).sort(([, a], [, b]) => b - a);
    const topValue = entries[0]?.[0];
    const topCount = entries[0]?.[1] || 0;
    const total = entries.reduce((s, [, c]) => s + c, 0);
    const topPct = total > 0 ? Math.round((topCount / total) * 100) : 0;
    const label = CATEGORY_LABELS[key] || key;
    const taxCat = TAXONOMY[key];
    const topLabel = topValue ? ((taxCat.labels as Record<string, string>)[topValue] || topValue) : 'one type';

    // Find unused values
    const usedValues = new Set(entries.map(([v]) => v));
    const unusedValues = taxCat.values.filter((v: string) => !usedValues.has(v));
    const unusedLabels = unusedValues
      .slice(0, 3)
      .map((v: string) => (taxCat.labels as Record<string, string>)[v] || v);

    // Enhance with brand context for hookTactic
    let audienceHint = '';
    if (key === 'hookTactic' && hasDemographics) {
      audienceHint = ` Your audience (${brandContext!.demographics.join(', ')}) may respond well to problem-agitation hooks targeting their pain points.`;
    }

    recs.push({
      priority: score <= 20 ? 'high' : 'medium',
      title: `Diversify ${label}`,
      detail: `${topPct}% of ads use "${topLabel}". ${unusedLabels.length > 0 ? `Try: ${unusedLabels.join(', ')}.` : 'Experiment with different approaches.'}${audienceHint}`,
    });
  }

  // 2. Gap matrix recommendations — find empty cells
  const emptyGaps: Array<{ stage: string; format: string }> = [];
  for (const [stage, formats] of Object.entries(gapMatrix)) {
    for (const [format, count] of Object.entries(formats)) {
      if (count === 0) {
        emptyGaps.push({ stage, format });
      }
    }
  }

  if (emptyGaps.length > 0) {
    const topGaps = emptyGaps.slice(0, 3).map(g => {
      const stageLabel = (TAXONOMY.awarenessStage.labels as Record<string, string>)[g.stage] || g.stage;
      const formatLabel = (TAXONOMY.visualFormat.labels as Record<string, string>)[g.format] || g.format;
      return `${stageLabel} × ${formatLabel}`;
    });

    // Enhance with pain points reference
    const painPointHint = hasPainPoints
      ? ` Address "${brandContext!.painPoints[0]}" in your messaging to fill these gaps.`
      : '';

    recs.push({
      priority: emptyGaps.length > 5 ? 'high' : 'medium',
      title: 'Fill creative gaps',
      detail: `${emptyGaps.length} empty cells in the gap matrix. Start with: ${topGaps.join(', ')}.${painPointHint}`,
    });
  }

  // 3. Overall diversity tip
  const overall = diversityScores.overall ?? 0;
  if (overall < 50) {
    // Enhance with positioning reference
    const positioningHint = hasPositioning
      ? ` Lean into your positioning ("${brandContext!.positioning!.slice(0, 80)}${brandContext!.positioning!.length > 80 ? '...' : ''}") across different creative formats to maintain consistency while adding variety.`
      : '';

    recs.push({
      priority: 'high',
      title: 'Increase creative volume and variety',
      detail: `With a low overall diversity score, the algorithm has limited creative options. Aim to test 3-5 new creative concepts per week across different formats and messaging angles.${positioningHint}`,
    });
  }

  // 4. Awareness stage balance
  const awarenessEntries = Object.entries(taxonomyBreakdown.awarenessStage || {}).sort(([, a], [, b]) => b - a);
  const totalAwareness = awarenessEntries.reduce((s, [, c]) => s + c, 0);
  if (awarenessEntries.length > 0 && totalAwareness > 0) {
    const topStagePct = Math.round((awarenessEntries[0][1] / totalAwareness) * 100);
    if (topStagePct > 60) {
      const topStageLabel = (TAXONOMY.awarenessStage.labels as Record<string, string>)[awarenessEntries[0][0]] || awarenessEntries[0][0];
      recs.push({
        priority: 'medium',
        title: 'Rebalance funnel stages',
        detail: `${topStagePct}% of ads target ${topStageLabel}. A balanced funnel (awareness → consideration → conversion) prevents over-saturation at one stage.`,
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recs.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recs.slice(0, 5);
}

function ReportSummary({
  diversityScores,
  taxonomyBreakdown,
  gapMatrix,
  classificationCoverage,
  darkMode,
  brandContext,
  pageId,
}: {
  diversityScores: Record<string, number>;
  taxonomyBreakdown: Record<string, Record<string, number>>;
  gapMatrix: Record<string, Record<string, number>>;
  classificationCoverage: { classified: number; total: number };
  darkMode: boolean;
  brandContext?: BrandContext | null;
  pageId: string;
}) {
  const [aiInsights, setAiInsights] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const cardBorder = darkMode ? 'border-slate-700/50' : 'border-slate-200';
  const cardBg = darkMode ? 'bg-[#101322]' : 'bg-white';
  const overall = diversityScores.overall ?? 0;
  const verdict = getOverallVerdict(overall);
  const recs = generateRecommendations(diversityScores, taxonomyBreakdown, gapMatrix, brandContext);

  // Compute weak categories and gap count for the AI endpoint
  const weakCategories = CATEGORY_KEYS
    .filter(k => (diversityScores[k] ?? 0) < 40)
    .map(k => k);
  const gapCount = Object.values(gapMatrix).reduce(
    (total, formats) => total + Object.values(formats).filter(c => c === 0).length,
    0,
  );

  async function handleGenerateInsights() {
    setAiLoading(true);
    setAiError('');
    setAiInsights(null);

    try {
      const res = await fetch('/api/strategy/personalized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId,
          diversityScores,
          weakCategories,
          gapCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate insights');
      }

      if (data.needsProfile) {
        setAiError(data.message || 'Create a brand profile to unlock personalized AI insights');
        return;
      }

      setAiInsights(data.insights);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAiLoading(false);
    }
  }

  const priorityStyles = {
    high: {
      bg: darkMode ? 'bg-red-500/8' : 'bg-red-50',
      border: darkMode ? 'border-red-500/20' : 'border-red-100',
      dot: 'bg-red-500',
      label: 'High',
      labelColor: 'text-red-500',
    },
    medium: {
      bg: darkMode ? 'bg-amber-500/8' : 'bg-amber-50',
      border: darkMode ? 'border-amber-500/20' : 'border-amber-100',
      dot: 'bg-amber-500',
      label: 'Medium',
      labelColor: 'text-amber-500',
    },
    low: {
      bg: darkMode ? 'bg-blue-500/8' : 'bg-blue-50',
      border: darkMode ? 'border-blue-500/20' : 'border-blue-100',
      dot: 'bg-blue-500',
      label: 'Low',
      labelColor: 'text-blue-500',
    },
  };

  return (
    <>
      {/* Summary card */}
      <div className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-[#1235e2]" />
          Report Summary
        </h3>
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-lg font-black"
            style={{
              backgroundColor: scoreBg(overall, darkMode),
              color: scoreColor(overall),
            }}
          >
            {overall}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-1" style={{ color: scoreColor(overall) }}>
              {verdict.label} Creative Diversity
            </p>
            <p className={`text-xs leading-relaxed ${muted}`}>
              {verdict.description}
            </p>
            <p className={`text-xs mt-2 ${muted}`}>
              Based on {classificationCoverage.classified} classified ads out of {classificationCoverage.total} active.
              The diversity score measures how evenly your ads are distributed across {CATEGORY_KEYS.length} creative dimensions
              (format, hook, messaging, audience, funnel stage, etc). Higher scores mean the algorithm has more creative variation to test and optimize.
            </p>
          </div>
        </div>
      </div>

      {/* Recommendations card */}
      {recs.length > 0 && (
        <div className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}>
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#1235e2]" />
            Recommendations
          </h3>
          <div className="space-y-3">
            {recs.map((rec, i) => {
              const style = priorityStyles[rec.priority];
              return (
                <div
                  key={i}
                  className={`rounded-lg border p-3.5 ${style.bg} ${style.border}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: scoreColor(rec.priority === 'high' ? 20 : rec.priority === 'medium' ? 50 : 70) }} />
                    <span className="text-sm font-semibold">{rec.title}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ml-auto ${style.labelColor}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${muted} pl-5.5`}>
                    {rec.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Insights section — only when brand profile exists */}
      {brandContext && (
        <div
          className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}
          style={{
            borderImage: darkMode
              ? 'linear-gradient(135deg, rgba(18,53,226,0.3), rgba(99,102,241,0.15)) 1'
              : 'linear-gradient(135deg, rgba(18,53,226,0.2), rgba(99,102,241,0.1)) 1',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1235e2]" />
              AI-Powered Insights
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  darkMode ? 'bg-[#1235e2]/15 text-[#6b8aff]' : 'bg-[#1235e2]/10 text-[#1235e2]'
                }`}
              >
                AI-Powered
              </span>
            </h3>
            {!aiInsights && !aiLoading && (
              <button
                onClick={handleGenerateInsights}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Generate AI Insights
              </button>
            )}
          </div>

          {/* Loading state */}
          {aiLoading && (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="w-5 h-5 text-[#1235e2] animate-spin" />
              <span className={`text-sm ${muted}`}>Generating personalized insights...</span>
            </div>
          )}

          {/* Error state */}
          {aiError && !aiLoading && (
            <div className={`rounded-lg border p-3 ${darkMode ? 'border-red-500/20 bg-red-500/5' : 'border-red-100 bg-red-50'}`}>
              <p className="text-xs text-red-400">{aiError}</p>
            </div>
          )}

          {/* Insights display */}
          {aiInsights && aiInsights.length > 0 && (
            <div className="space-y-3">
              {aiInsights.map((insight, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3.5 ${
                    darkMode
                      ? 'border-[#1235e2]/20 bg-[#1235e2]/5'
                      : 'border-[#1235e2]/10 bg-blue-50/50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                        darkMode ? 'bg-[#1235e2]/20 text-[#6b8aff]' : 'bg-[#1235e2]/10 text-[#1235e2]'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <p className={`text-xs leading-relaxed ${muted}`}>{insight}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={handleGenerateInsights}
                disabled={aiLoading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  darkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                <RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
            </div>
          )}

          {/* Empty state — prompt to generate */}
          {!aiInsights && !aiLoading && !aiError && (
            <p className={`text-xs ${muted}`}>
              Get personalized strategy recommendations based on your brand profile ({brandContext.name}).
              AI insights will reference your audience, positioning, and pain points.
            </p>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// StrategyView
// ---------------------------------------------------------------------------

export function StrategyView({ brand, darkMode, onBack }: StrategyViewProps) {
  // Data loading
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
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
  // Data loading (with auto-classify)
  // -------------------------------------------------------------------------

  useEffect(() => {
    async function loadStrategy() {
      setLoading(true);
      setError('');
      setStatusMsg('');
      try {
        const res = await fetch(`/api/strategy/${brand.pageId}`);
        if (res.status === 422) {
          const data = await res.json().catch(() => ({}));
          if (data.needsClassification && data.brandId) {
            // Auto-classify inline, then retry
            setStatusMsg('Classifying ads with AI...');
            const classRes = await fetch('/api/classify/inline', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ brandId: data.brandId, limit: 30 }),
            });
            const classData = await classRes.json();

            if (!classRes.ok || (classData.classified === 0 && classData.alreadyClassified < 3)) {
              setError(`Classification insufficient. ${classData.alreadyClassified || 0} ads classified (need at least 3).`);
              return;
            }

            setStatusMsg(`Classified ${classData.classified} ads. Loading strategy...`);

            // Retry strategy load
            const retryRes = await fetch(`/api/strategy/${brand.pageId}`);
            if (!retryRes.ok) {
              const retryData = await retryRes.json().catch(() => ({}));
              throw new Error(retryData.error || 'Failed to load strategy after classification');
            }
            const retryData: StrategyData = await retryRes.json();
            setStrategyData(retryData);
            setStatusMsg('');
            return;
          }
          setError(data.error || 'Insufficient classification data.');
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
              {statusMsg ? 'Preparing strategy...' : `Loading strategy for ${brand.pageName}...`}
            </h2>
            <p className={`text-sm ${muted}`}>
              {statusMsg || 'Assembling taxonomy breakdown and gap matrix'}
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

      {/* B2. Report Summary + Recommendations */}
      <ReportSummary
        diversityScores={diversityScores}
        taxonomyBreakdown={taxonomyBreakdown}
        gapMatrix={gapMatrix}
        classificationCoverage={classificationCoverage}
        darkMode={darkMode}
        brandContext={strategyData.brandContext}
        pageId={brand.pageId}
      />

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
