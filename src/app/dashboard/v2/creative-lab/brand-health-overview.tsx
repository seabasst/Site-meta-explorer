'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  ArrowUp,
  ArrowDown,
  Minus,
  Globe,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  Users,
  Sparkles,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BrandHealthOverviewProps {
  brand: {
    pageId: string;
    pageName: string;
    iconUrl?: string;
    category?: string | null;
    source: string;
  };
  darkMode: boolean;
  onBack: () => void;
}

interface PillarComparison {
  user: number;
  competitorAvg: number;
  diff: number;
  status: 'ahead' | 'behind' | 'even';
}

interface CompetitorEntry {
  name: string;
  pageId: string;
  iconUrl: string | null;
  notes: string | null;
  scores: Record<string, number> | null;
  andromedaScore: number | null;
  metrics: Record<string, number> | null;
  hasAnalysis: boolean;
}

interface HealthData {
  userBrand: {
    name: string;
    pageId: string;
    iconUrl: string | null;
    scores: Record<string, number>;
    andromedaScore: number;
    metrics: Record<string, number>;
  };
  competitors: CompetitorEntry[];
  comparison: {
    indexing: Record<string, PillarComparison>;
    strengths: string[];
    gaps: string[];
    analyzedCompetitorCount: number;
    totalCompetitorCount: number;
  } | null;
  needsAnalysis?: boolean;
}

// ---------------------------------------------------------------------------
// Score color helpers (matching strategy-view.tsx)
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score <= 30) return '#ef4444';
  if (score <= 60) return '#f59e0b';
  return '#22c55e';
}

function scoreBg(score: number, darkMode: boolean): string {
  if (score <= 30) return darkMode ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)';
  if (score <= 60) return darkMode ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.08)';
  return darkMode ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.08)';
}

function getOverallVerdict(score: number): { label: string; description: string } {
  if (score >= 75) return { label: 'Strong', description: 'Well-diversified creative strategy with broad coverage across categories.' };
  if (score >= 50) return { label: 'Moderate', description: 'Reasonable diversity with room for improvement in some areas.' };
  if (score >= 30) return { label: 'Narrow', description: 'Heavy reliance on a few creative approaches. Opportunities to expand.' };
  return { label: 'Very Narrow', description: 'Minimal creative diversity. Significant room for improvement.' };
}

// Pillar labels
const PILLAR_LABELS: Record<string, string> = {
  assetType: 'Asset Type',
  visualFormat: 'Visual Format',
  hookTactic: 'Hook Tactic',
  messagingAngle: 'Messaging Angle',
  awarenessStage: 'Awareness Stage',
  creativeMechanic: 'Creative Mechanic',
  offerType: 'Offer Type',
  intendedAudience: 'Intended Audience',
  overall: 'Overall',
  andromeda: 'Andromeda',
};

const PILLAR_ORDER = [
  'overall',
  'andromeda',
  'assetType',
  'visualFormat',
  'hookTactic',
  'messagingAngle',
  'awarenessStage',
  'creativeMechanic',
  'offerType',
  'intendedAudience',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BrandHealthOverview({ brand, darkMode, onBack }: BrandHealthOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<HealthData | null>(null);
  const [competitorsExpanded, setCompetitorsExpanded] = useState(false);

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const cardBorder = darkMode ? 'border-slate-700/50' : 'border-slate-200';
  const cardBg = darkMode ? 'bg-[#101322]' : 'bg-white';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-100';

  useEffect(() => {
    async function loadHealth() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/brand-health?pageId=${encodeURIComponent(brand.pageId)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load brand health data');
        }
        const body: HealthData = await res.json();
        setData(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    loadHealth();
  }, [brand.pageId]);

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
            <h2 className="text-lg font-bold mb-2">Loading brand health for {brand.pageName}...</h2>
            <p className={`text-sm ${muted}`}>Comparing scores against linked competitors</p>
          </div>
          <div className="space-y-4 animate-pulse">
            <div className={`h-20 rounded-xl ${mutedBg}`} />
            <div className={`h-48 rounded-xl ${mutedBg}`} />
            <div className={`h-32 rounded-xl ${mutedBg}`} />
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
          <div className={`rounded-xl border p-8 text-center ${darkMode ? 'border-red-500/20 bg-red-500/5' : 'border-red-100 bg-red-50'}`}>
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-red-400 mb-1">Health Overview Unavailable</p>
            <p className={`text-sm ${muted} mb-6`}>{error}</p>
            <button
              onClick={onBack}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Needs analysis empty state
  // -------------------------------------------------------------------------

  if (!data || data.needsAnalysis) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className={`text-sm ${muted} hover:text-[#1235e2] transition-colors`}
        >
          &larr; Back
        </button>
        <div className="max-w-lg mx-auto pt-8">
          <div className={`rounded-xl border p-8 text-center ${cardBorder} ${cardBg}`}>
            <Sparkles className="w-10 h-10 text-[#1235e2] mx-auto mb-3" />
            <p className="text-sm font-semibold mb-1">Analysis Required</p>
            <p className={`text-sm ${muted} mb-6`}>
              Run Andromeda analysis for {brand.pageName} first to see your brand health scores.
            </p>
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { userBrand, competitors, comparison } = data;
  const overallScore = userBrand.scores.overall ?? 0;
  const verdict = getOverallVerdict(overallScore);
  const hasComparison = comparison !== null && Object.keys(comparison.indexing).length > 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* Header */}
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
              <img src={brand.iconUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <Globe className="w-5 h-5 text-[#1235e2]" />
            )}
            <span className="font-bold">{userBrand.name}</span>
            <span className={`text-xs ${muted}`}>&middot; Brand Health</span>
          </div>
        </div>
        {hasComparison && (
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-blue-50 text-[#1235e2]'
          }`}>
            <Users className="w-3 h-3" />
            vs {comparison!.analyzedCompetitorCount} competitor{comparison!.analyzedCompetitorCount !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Overall Health Card */}
      <div className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}>
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#1235e2]" />
          Overall Health
        </h3>
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 w-16 h-16 rounded-xl flex items-center justify-center text-xl font-black"
            style={{
              backgroundColor: scoreBg(overallScore, darkMode),
              color: scoreColor(overallScore),
            }}
          >
            {overallScore}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-1" style={{ color: scoreColor(overallScore) }}>
              {verdict.label} Creative Diversity
            </p>
            <p className={`text-xs leading-relaxed ${muted}`}>
              {verdict.description}
            </p>
            {hasComparison && (
              <p className={`text-xs mt-2 ${muted}`}>
                Compared against {comparison!.analyzedCompetitorCount} of {comparison!.totalCompetitorCount} linked competitor{comparison!.totalCompetitorCount !== 1 ? 's' : ''}.
                {comparison!.totalCompetitorCount !== comparison!.analyzedCompetitorCount && (
                  <> {comparison!.totalCompetitorCount - comparison!.analyzedCompetitorCount} not yet analyzed.</>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pillar Comparison Grid */}
      <div className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}>
        <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#1235e2]" />
          {hasComparison ? 'Score Comparison' : 'Diversity Scores'}
        </h3>

        <div className="space-y-2.5">
          {PILLAR_ORDER.map((pillar) => {
            const label = PILLAR_LABELS[pillar] || pillar;
            const userScore = pillar === 'andromeda'
              ? userBrand.andromedaScore
              : userBrand.scores[pillar];

            if (userScore == null) return null;

            const comp = hasComparison ? comparison!.indexing[pillar] : null;

            return (
              <div
                key={pillar}
                className={`flex items-center gap-3 py-1.5 ${
                  pillar === 'overall' || pillar === 'andromeda'
                    ? `px-3 rounded-lg ${darkMode ? 'bg-slate-800/40' : 'bg-slate-50'}`
                    : ''
                }`}
              >
                <span className={`w-32 text-xs font-medium shrink-0 ${
                  (pillar === 'overall' || pillar === 'andromeda') ? 'font-bold' : muted
                }`}>
                  {label}
                </span>

                {/* User score pill */}
                <span
                  className="text-sm font-black w-10 text-right"
                  style={{ color: scoreColor(userScore) }}
                >
                  {userScore}
                </span>

                {comp && (
                  <>
                    <span className={`text-xs ${muted}`}>vs</span>
                    <span className={`text-xs w-10 text-right ${muted}`}>
                      {comp.competitorAvg}
                    </span>

                    {/* Diff badge */}
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      comp.status === 'ahead'
                        ? darkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'
                        : comp.status === 'behind'
                        ? darkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'
                        : darkMode ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {comp.status === 'ahead' && <ArrowUp className="w-3 h-3" />}
                      {comp.status === 'behind' && <ArrowDown className="w-3 h-3" />}
                      {comp.status === 'even' && <Minus className="w-3 h-3" />}
                      {comp.diff > 0 ? '+' : ''}{comp.diff}
                    </div>
                  </>
                )}

                {!comp && !hasComparison && (
                  <div className="flex-1">
                    <div
                      className={`h-2 rounded-full ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(userScore, 100)}%`,
                          backgroundColor: scoreColor(userScore),
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths & Gaps Cards */}
      {hasComparison && (comparison!.strengths.length > 0 || comparison!.gaps.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strengths */}
          <div className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className={darkMode ? 'text-green-400' : 'text-green-600'}>Strengths</span>
            </h3>
            {comparison!.strengths.length > 0 ? (
              <ul className="space-y-2">
                {comparison!.strengths.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${darkMode ? 'bg-green-400' : 'bg-green-500'}`} />
                    <span className={muted}>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-xs ${muted}`}>
                No clear strengths detected vs competitors. Focus on improving weaker areas.
              </p>
            )}
          </div>

          {/* Gaps */}
          <div className={`rounded-xl border p-5 ${cardBorder} ${cardBg}`}>
            <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className={darkMode ? 'text-red-400' : 'text-red-600'}>Gaps</span>
            </h3>
            {comparison!.gaps.length > 0 ? (
              <ul className="space-y-2">
                {comparison!.gaps.map((g, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${darkMode ? 'bg-red-400' : 'bg-red-500'}`} />
                    <span className={muted}>{g}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`text-xs ${muted}`}>
                No significant gaps! Your brand is performing at or above competitor levels.
              </p>
            )}
          </div>
        </div>
      )}

      {/* No Competitors Empty State */}
      {competitors.length === 0 && (
        <div className={`rounded-xl border p-8 text-center ${cardBorder} ${cardBg}`}>
          <Users className="w-10 h-10 text-[#1235e2] mx-auto mb-3" />
          <p className="text-sm font-semibold mb-1">No Competitors Linked</p>
          <p className={`text-sm ${muted} max-w-md mx-auto`}>
            Add competitors to your brand profile to see how your creative strategy compares.
            Go to your brand profile settings to link competitor brands.
          </p>
        </div>
      )}

      {/* Competitor Breakdown */}
      {competitors.length > 0 && (
        <div className={`rounded-xl border ${cardBorder} ${cardBg}`}>
          <button
            onClick={() => setCompetitorsExpanded(!competitorsExpanded)}
            className="w-full flex items-center justify-between p-5 text-left"
          >
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1235e2]" />
              Competitor Breakdown ({competitors.length})
            </h3>
            {competitorsExpanded ? (
              <ChevronDown className={`w-4 h-4 ${muted}`} />
            ) : (
              <ChevronRight className={`w-4 h-4 ${muted}`} />
            )}
          </button>

          {competitorsExpanded && (
            <div className="px-5 pb-5 space-y-4">
              {competitors.map((comp) => (
                <div
                  key={comp.pageId}
                  className={`rounded-lg border p-4 ${cardBorder} ${
                    comp.hasAnalysis
                      ? ''
                      : darkMode ? 'opacity-60' : 'opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {comp.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={comp.iconUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        darkMode ? 'bg-slate-800' : 'bg-slate-100'
                      }`}>
                        <Globe className="w-4 h-4 text-[#1235e2]" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{comp.name}</p>
                      {comp.notes && (
                        <p className={`text-xs ${muted} truncate`}>{comp.notes}</p>
                      )}
                    </div>
                    {!comp.hasAnalysis && (
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        darkMode ? 'bg-slate-700/50 text-slate-400' : 'bg-slate-100 text-slate-500'
                      }`}>
                        Not yet analyzed
                      </span>
                    )}
                  </div>

                  {comp.hasAnalysis && comp.scores && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(comp.scores).map(([key, score]) => (
                        <div
                          key={key}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{
                            backgroundColor: scoreBg(score, darkMode),
                            color: scoreColor(score),
                          }}
                        >
                          <span className="opacity-70">
                            {PILLAR_LABELS[key] || key}
                          </span>
                          <span className="font-black">{score}</span>
                        </div>
                      ))}
                      {comp.andromedaScore != null && (
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{
                            backgroundColor: scoreBg(comp.andromedaScore, darkMode),
                            color: scoreColor(comp.andromedaScore),
                          }}
                        >
                          <span className="opacity-70">Andromeda</span>
                          <span className="font-black">{comp.andromedaScore}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {!comp.hasAnalysis && (
                    <p className={`text-xs ${muted}`}>
                      Run Andromeda analysis on this competitor to see their scores.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
