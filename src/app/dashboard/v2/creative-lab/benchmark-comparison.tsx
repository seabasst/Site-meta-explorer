'use client';

import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import { V2Card } from '../v2-shell';

// ---------------------------------------------------------------------------
// Types (duplicated to avoid circular imports)
// ---------------------------------------------------------------------------

interface DiversityScores {
  format: number;
  tone: number;
  journeyPhase: number;
  visualStyle: number;
  messenger: number;
  overall: number;
}

interface PillarIndex {
  brand: number;
  category: number;
  diff: number;
  status: 'strength' | 'gap' | 'neutral';
}

interface BenchmarkRecommendation {
  pillar: string;
  brandScore: number;
  categoryAvg: number;
  diff: number;
  status: 'strength' | 'gap';
  message: string;
}

export interface BenchmarkResult {
  brand: {
    name: string;
    scores: DiversityScores;
    andromedaScore: number;
  };
  category: {
    name: string;
    slug: string;
    totalBrands: number;
    analyzedBrands: number;
    avgScores: DiversityScores;
    avgAndromedaScore: number;
  };
  indexing: {
    format: PillarIndex;
    tone: PillarIndex;
    journeyPhase: PillarIndex;
    visualStyle: PillarIndex;
    messenger: PillarIndex;
    overall: PillarIndex;
    andromeda: PillarIndex;
  };
  gaps: BenchmarkRecommendation[];
  strengths: BenchmarkRecommendation[];
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Default Pillar Config
// ---------------------------------------------------------------------------

const DEFAULT_PILLAR_CONFIG: Record<string, { label: string; color: string; allValues: string[] }> = {
  format: { label: 'Format', color: '#3b82f6', allValues: ['static-image', 'video', 'carousel', 'reel', 'story'] },
  tone: { label: 'Tone', color: '#8b5cf6', allValues: ['aspirational', 'problem-solving', 'educational', 'social-proof', 'humor', 'urgency'] },
  journeyPhase: { label: 'Journey Phase', color: '#f59e0b', allValues: ['awareness', 'consideration', 'conversion'] },
  visualStyle: { label: 'Visual Style', color: '#10b981', allValues: ['studio', 'ugc', 'minimal', 'lifestyle', 'before-after', 'product-shot'] },
  messenger: { label: 'Messenger', color: '#ec4899', allValues: ['brand', 'influencer', 'customer', 'expert', 'anonymous'] },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BenchmarkComparisonProps {
  result: BenchmarkResult | null;
  loading: boolean;
  darkMode: boolean;
  pillarConfig?: Record<string, { label: string; color: string; allValues: string[] }>;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PillarComparisonBar({ label, index, color, darkMode }: {
  label: string;
  index: PillarIndex;
  color: string;
  darkMode: boolean;
}) {
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-100';
  const statusColor = index.status === 'strength' ? 'text-emerald-400' : index.status === 'gap' ? 'text-red-400' : muted;
  const StatusIcon = index.status === 'strength' ? TrendingUp : index.status === 'gap' ? TrendingDown : Minus;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-sm">
        <span className="font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-bold" style={{ color }}>{index.brand}</span>
          <span className={`text-xs ${muted}`}>vs</span>
          <span className={muted}>{index.category}</span>
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${statusColor}`}>
            <StatusIcon className="w-3 h-3" />
            {index.diff > 0 ? '+' : ''}{index.diff}
          </span>
        </span>
      </div>
      <div className={`relative h-3 rounded-full ${mutedBg}`}>
        <div
          className="absolute h-full rounded-full opacity-30"
          style={{ width: `${Math.min(index.category, 100)}%`, backgroundColor: color }}
        />
        <div
          className="absolute h-full rounded-full"
          style={{ width: `${Math.min(index.brand, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ScoreCard({ label, index, color, darkMode }: {
  label: string;
  index: PillarIndex;
  color: string;
  darkMode: boolean;
}) {
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const statusColor = index.status === 'strength' ? 'text-emerald-400' : index.status === 'gap' ? 'text-red-400' : muted;
  const StatusIcon = index.status === 'strength' ? TrendingUp : index.status === 'gap' ? TrendingDown : Minus;
  const borderColor = index.status === 'strength' ? 'border-emerald-500/20' : index.status === 'gap' ? 'border-red-500/20' : darkMode ? 'border-[#1235e2]/10' : 'border-slate-200';

  return (
    <V2Card className={`p-5 text-center border ${borderColor}`}>
      <p className={`text-xs font-medium mb-2 ${muted}`}>{label}</p>
      <div className="text-3xl font-black mb-1" style={{ color }}>{index.brand}</div>
      <p className={`text-xs ${muted} mb-2`}>vs {index.category} avg</p>
      <span className={`inline-flex items-center gap-1 text-sm font-semibold ${statusColor}`}>
        <StatusIcon className="w-4 h-4" />
        {index.diff > 0 ? '+' : ''}{index.diff}
      </span>
    </V2Card>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const PILLAR_KEYS = ['format', 'tone', 'journeyPhase', 'visualStyle', 'messenger'] as const;

export function BenchmarkComparison({ result, loading, darkMode, pillarConfig }: BenchmarkComparisonProps) {
  const config = pillarConfig ?? DEFAULT_PILLAR_CONFIG;
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  // Loading state
  if (loading && !result) {
    return (
      <div className="mb-8">
        <V2Card className="p-8 text-center">
          <div className={`animate-pulse space-y-3`}>
            <div className={`h-4 w-48 mx-auto rounded ${darkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
            <div className={`h-3 w-64 mx-auto rounded ${darkMode ? 'bg-slate-700/60' : 'bg-slate-200/60'}`} />
            <p className={`text-sm ${muted} mt-4`}>Loading category benchmark...</p>
          </div>
        </V2Card>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="mb-8">
      {/* Section header */}
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-[#1235e2]" />
        Category Benchmark
      </h3>

      {/* Category metadata */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <span className="text-sm font-medium">{result.category.name}</span>
        <span className={`text-xs ${muted}`}>
          {result.category.analyzedBrands} of {result.category.totalBrands} brands analyzed
        </span>
        {result.category.analyzedBrands < 3 && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            Limited data — benchmark may not be representative
          </span>
        )}
      </div>

      {/* Overall + Andromeda score cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <ScoreCard label="Overall Diversity" index={result.indexing.overall} color="#1235e2" darkMode={darkMode} />
        <ScoreCard label="Andromeda Score" index={result.indexing.andromeda} color="#10b981" darkMode={darkMode} />
      </div>

      {/* Per-pillar comparison bars */}
      <V2Card className="p-6 mb-6">
        <h4 className="text-sm font-bold mb-4">Five Pillars Comparison</h4>
        <div className="space-y-4">
          {PILLAR_KEYS.map((key) => {
            const cfg = config[key];
            const index = result.indexing[key];
            if (!cfg || !index) return null;
            return (
              <PillarComparisonBar
                key={key}
                label={cfg.label}
                index={index}
                color={cfg.color}
                darkMode={darkMode}
              />
            );
          })}
        </div>
      </V2Card>

      {/* Gaps and Strengths */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gaps */}
        <V2Card className={`p-5 border ${darkMode ? 'border-red-500/10' : 'border-red-100'}`}>
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-red-400">
            <TrendingDown className="w-4 h-4" />
            Areas to Improve
          </h4>
          {result.gaps.length > 0 ? (
            <div className="space-y-3">
              {result.gaps.map((gap, i) => {
                const cfg = config[gap.pillar];
                return (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium" style={{ color: cfg?.color }}>{cfg?.label || gap.pillar}</span>
                      <span className="text-xs text-red-400 font-semibold">{gap.diff}</span>
                    </div>
                    <p className={`text-xs ${muted}`}>{gap.message}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`text-xs ${muted}`}>No significant gaps detected.</p>
          )}
        </V2Card>

        {/* Strengths */}
        <V2Card className={`p-5 border ${darkMode ? 'border-emerald-500/10' : 'border-emerald-100'}`}>
          <h4 className="text-sm font-bold mb-3 flex items-center gap-2 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
            Competitive Advantages
          </h4>
          {result.strengths.length > 0 ? (
            <div className="space-y-3">
              {result.strengths.map((str, i) => {
                const cfg = config[str.pillar];
                return (
                  <div key={i} className="text-sm">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium" style={{ color: cfg?.color }}>{cfg?.label || str.pillar}</span>
                      <span className="text-xs text-emerald-400 font-semibold">+{str.diff}</span>
                    </div>
                    <p className={`text-xs ${muted}`}>{str.message}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`text-xs ${muted}`}>Run more analyses to build benchmark data.</p>
          )}
        </V2Card>
      </div>
    </div>
  );
}
