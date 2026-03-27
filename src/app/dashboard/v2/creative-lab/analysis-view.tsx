'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  FileText,
  BarChart3,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { V2Card } from '../v2-shell';
import { BenchmarkComparison } from './benchmark-comparison';
import type { BenchmarkResult } from './benchmark-comparison';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiversityScores {
  assetType: number;
  visualFormat: number;
  hookTactic: number;
  messagingAngle: number;
  awarenessStage: number;
  creativeMechanic: number;
  offerType: number;
  intendedAudience: number;
  overall: number;
}

interface DiversityResult {
  brandName: string;
  totalAdsAnalyzed: number;
  diversityScores: DiversityScores;
  distribution: Record<string, Record<string, number>>;
  andromedaMetrics: Record<string, unknown>;
  andromedaScore: number;
}

interface AnalysisViewProps {
  brand: { pageId: string; pageName: string; iconUrl?: string; category?: string | null; source: string };
  darkMode: boolean;
  onGenerateCreatives: () => void;
  onGenerateBrief: () => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Score pill config
// ---------------------------------------------------------------------------

const CATEGORY_PILLS: { key: keyof DiversityScores; label: string; color: string }[] = [
  { key: 'assetType', label: 'Asset Type', color: '#3b82f6' },
  { key: 'visualFormat', label: 'Visual Format', color: '#8b5cf6' },
  { key: 'hookTactic', label: 'Hook Tactic', color: '#f59e0b' },
  { key: 'messagingAngle', label: 'Messaging', color: '#10b981' },
  { key: 'awarenessStage', label: 'Awareness', color: '#ec4899' },
  { key: 'creativeMechanic', label: 'Mechanic', color: '#06b6d4' },
  { key: 'offerType', label: 'Offer Type', color: '#f97316' },
  { key: 'intendedAudience', label: 'Audience', color: '#a855f7' },
  { key: 'overall', label: 'Overall', color: '#1235e2' },
];

// ---------------------------------------------------------------------------
// AnalysisView
// ---------------------------------------------------------------------------

export function AnalysisView({
  brand,
  darkMode,
  onGenerateCreatives,
  onGenerateBrief,
  onBack,
}: AnalysisViewProps) {
  const [diversity, setDiversity] = useState<DiversityResult | null>(null);
  const [diversityLoading, setDiversityLoading] = useState(true);
  const [diversityError, setDiversityError] = useState('');

  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-100';

  // -- Fetch diversity analysis -----------------------------------------------

  const runAnalysis = useCallback(async () => {
    setDiversityLoading(true);
    setDiversityError('');
    setDiversity(null);
    setBenchmark(null);

    try {
      const res = await fetch('/api/analyze/diversity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: brand.pageId, pageName: brand.pageName, category: brand.category }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.needsClassification) {
          setDiversityError(`${data.classifiedCount} of ${data.totalAds} ads classified. Classify more ads to enable analysis.`);
        } else {
          setDiversityError(data.error || 'Failed to analyze brand. Please try again.');
        }
        return;
      }

      const data: DiversityResult = await res.json();
      setDiversity(data);

      // After diversity succeeds, fetch benchmark (non-blocking, skip if no category)
      if (brand.category) {
        fetchBenchmark();
      }
    } catch {
      setDiversityError('Network error. Please check your connection and try again.');
    } finally {
      setDiversityLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.pageId]);

  async function fetchBenchmark() {
    setBenchmarkLoading(true);
    try {
      const res = await fetch('/api/analyze/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: brand.pageId, category: brand.category }),
      });

      if (res.ok) {
        const data: BenchmarkResult = await res.json();
        setBenchmark(data);
      }
      // If benchmark fails, we just don't show it -- not fatal
    } catch {
      // Silently fail -- benchmark is optional
    } finally {
      setBenchmarkLoading(false);
    }
  }

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  // -- Loading state ----------------------------------------------------------

  if (diversityLoading) {
    return (
      <div className="space-y-6">
        {/* Back button */}
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
              Analyzing {brand.pageName}&apos;s creative strategy...
            </h2>
            <p className={`text-sm ${muted}`}>
              (This may take up to a minute for first-time analysis)
            </p>
          </div>

          {/* Skeleton */}
          <div className="space-y-4 animate-pulse">
            <div className={`h-16 rounded-xl ${mutedBg}`} />
            <div className={`h-48 rounded-xl ${mutedBg}`} />
            <div className={`h-32 rounded-xl ${mutedBg}`} />
          </div>
        </div>
      </div>
    );
  }

  // -- Error state ------------------------------------------------------------

  if (diversityError) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className={`text-sm ${muted} hover:text-[#1235e2] transition-colors`}
        >
          &larr; Back
        </button>

        <div className="max-w-lg mx-auto pt-8">
          <V2Card
            className={`p-8 text-center border ${
              darkMode ? 'border-red-500/20' : 'border-red-100'
            }`}
          >
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-red-400 mb-1">Analysis Failed</p>
            <p className={`text-sm ${muted} mb-6`}>{diversityError}</p>
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
              <button
                onClick={runAnalysis}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </V2Card>
        </div>
      </div>
    );
  }

  // -- Success state ----------------------------------------------------------

  if (!diversity) return null;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={onBack}
        className={`text-sm ${muted} hover:text-[#1235e2] transition-colors`}
      >
        &larr; Back
      </button>

      {/* Diversity scores summary */}
      <div>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#1235e2]" />
          Diversity Scores
        </h3>
        <div className="flex flex-wrap gap-3">
          {CATEGORY_PILLS.map(({ key, label, color }) => (
            <div
              key={key}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: `${color}15`,
                color,
              }}
            >
              <span className="opacity-70">{label}</span>
              <span className="text-base font-black">{diversity.diversityScores[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Benchmark comparison (if available) */}
      <BenchmarkComparison
        result={benchmark}
        loading={benchmarkLoading}
        darkMode={darkMode}
      />

      {/* Action CTAs */}
      <div>
        <h3 className="text-lg font-bold mb-4">Take Action</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Generate Ad Creatives */}
          <button
            onClick={onGenerateCreatives}
            className={`text-left rounded-xl border-2 p-6 transition-all group ${
              darkMode
                ? 'border-[#1235e2]/10 bg-[#101322] hover:border-[#1235e2]/40 hover:bg-[#1235e2]/5'
                : 'border-slate-200 bg-white hover:border-[#1235e2] hover:bg-blue-50/30'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-[#1235e2]/10 flex items-center justify-center mb-4 group-hover:bg-[#1235e2]/20 transition-colors">
              <Sparkles className="w-6 h-6 text-[#1235e2]" />
            </div>
            <h4 className="text-base font-bold mb-1">Generate Ad Creatives</h4>
            <p className={`text-sm ${muted}`}>
              AI will create images targeting your diversity gaps.
            </p>
          </button>

          {/* Generate UGC Brief */}
          <button
            onClick={onGenerateBrief}
            className={`text-left rounded-xl border-2 p-6 transition-all group ${
              darkMode
                ? 'border-[#1235e2]/10 bg-[#101322] hover:border-[#1235e2]/40 hover:bg-[#1235e2]/5'
                : 'border-slate-200 bg-white hover:border-[#1235e2] hover:bg-blue-50/30'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-[#1235e2]/10 flex items-center justify-center mb-4 group-hover:bg-[#1235e2]/20 transition-colors">
              <FileText className="w-6 h-6 text-[#1235e2]" />
            </div>
            <h4 className="text-base font-bold mb-1">Generate UGC Brief</h4>
            <p className={`text-sm ${muted}`}>
              Get a structured creator brief based on this brand&apos;s data.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
