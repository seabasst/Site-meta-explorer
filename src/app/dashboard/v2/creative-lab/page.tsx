'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Wand2,
  Loader2,
  Search,
  Globe,
  ArrowLeft,
  X,
  FileText,
  ImageIcon,
  AlertTriangle,
  TrendingUp,
  Sparkles,
  Download,
  Clock,
  Zap,
  RefreshCw,
  Type,
  Target,
  Layers,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { V2Shell, V2Card } from '../v2-shell';
import { useV2 } from '../v2-context';
import { BenchmarkComparison } from './benchmark-comparison';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchResult {
  pageId: string;
  pageName: string;
  adCount: number;
  iconUrl?: string;
  source: string;
}

interface PillarDistribution {
  format: Record<string, number>;
  tone: Record<string, number>;
  journeyPhase: Record<string, number>;
  visualStyle: Record<string, number>;
  messenger: Record<string, number>;
}

interface DiversityScores {
  format: number;
  tone: number;
  journeyPhase: number;
  visualStyle: number;
  messenger: number;
  overall: number;
}

interface HookEntry {
  adId: string;
  firstLine: string;
  score: number;
}

interface ConceptCluster {
  concept: string;
  count: number;
  adIds: string[];
}

interface AndromedaMetrics {
  creativeVolume: {
    totalActive: number;
    weeklyNewAds: { week: string; count: number }[];
    avgRefreshRate: number;
    status: string;
  };
  adFatigue: {
    staleAds: number;
    stalePercentage: number;
    oldestAdDays: number;
    status: string;
  };
  funnelBalance: {
    awareness: number;
    consideration: number;
    conversion: number;
    idealDeviation: number;
    status: string;
  };
  hookQuality: {
    avgScore: number;
    distribution: { weak: number; average: number; strong: number };
    topHooks: HookEntry[];
    bottomHooks: HookEntry[];
  };
  ctaDiversity: {
    uniqueCtas: number;
    totalAds: number;
    ratio: number;
    distribution: Record<string, number>;
    status: string;
  };
  copyLength: {
    short: number;
    medium: number;
    long: number;
    status: string;
  };
  conceptDiversity: {
    uniqueConcepts: number;
    totalAds: number;
    ratio: number;
    clusters: ConceptCluster[];
    redundancyFlag: boolean;
    dominantConcept: string | null;
    dominantPercentage: number;
  };
}

interface Recommendation {
  pillar: string;
  gap: string;
  suggestion: string;
  briefTitle: string;
  briefDescription: string;
  imagePrompt: string;
  priority: 'high' | 'medium' | 'low';
}

interface DiversityResult {
  brandName: string;
  category: string | null;
  totalAdsAnalyzed: number;
  distribution: PillarDistribution;
  diversityScores: DiversityScores;
  andromedaMetrics: AndromedaMetrics;
  andromedaScore: number;
  summary: string;
  biggestGap: string;
  recommendations: Recommendation[];
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

interface BenchmarkResult {
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

type Step = 'setup' | 'analyzing' | 'results' | 'brief' | 'generating-image' | 'image-result';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PILLAR_CONFIG: Record<string, { label: string; color: string; allValues: string[] }> = {
  format: {
    label: 'Format',
    color: '#3b82f6',
    allValues: ['static-image', 'video', 'carousel', 'reel', 'story', 'collection'],
  },
  tone: {
    label: 'Tone & Angle',
    color: '#8b5cf6',
    allValues: ['aspirational', 'problem-solving', 'educational', 'social-proof', 'humor', 'urgency', 'price-focused', 'emotional'],
  },
  journeyPhase: {
    label: 'Journey Phase',
    color: '#f59e0b',
    allValues: ['awareness', 'consideration', 'conversion'],
  },
  visualStyle: {
    label: 'Visual Style',
    color: '#10b981',
    allValues: ['studio', 'ugc', 'minimal', 'lifestyle', 'before-after', 'product-shot', 'illustration', 'selfie'],
  },
  messenger: {
    label: 'Messenger & Voice',
    color: '#ef4444',
    allValues: ['brand', 'founder', 'influencer', 'customer', 'expert'],
  },
};

const METRIC_CONFIG: Record<string, { label: string; color: string }> = {
  refreshRate: { label: 'Refresh Rate', color: '#06b6d4' },
  hookQuality: { label: 'Hook Quality', color: '#f97316' },
  conceptDiversity: { label: 'Concept Diversity', color: '#a855f7' },
  funnelBalance: { label: 'Funnel Balance', color: '#f59e0b' },
  ctaDiversity: { label: 'CTA Diversity', color: '#14b8a6' },
  copyLength: { label: 'Copy Length', color: '#64748b' },
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'healthy')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400">
        <CheckCircle className="w-3 h-3" /> Healthy
      </span>
    );
  if (status === 'warning')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400">
        <AlertCircle className="w-3 h-3" /> Warning
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400">
      <XCircle className="w-3 h-3" /> Critical
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CreativeLabPage() {
  const { darkMode } = useV2();

  const [step, setStep] = useState<Step>('setup');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [myBrand, setMyBrand] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [diversityResult, setDiversityResult] = useState<DiversityResult | null>(null);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ slug: string; label: string; brandCount: number; analyzedBrands?: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => {});
  }, []);

  const card = `rounded-xl border ${darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200'}`;
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-100';

  // Search
  const searchPages = async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/search-pages?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch { /* ignore */ }
    setSearching(false);
  };

  const handleSearchInput = (val: string) => {
    setSearchQuery(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchPages(val), 400);
  };

  const selectBrand = (brand: SearchResult) => {
    setMyBrand(brand);
    setSearchResults([]);
    setSearchQuery('');
  };

  const runAnalysis = async () => {
    if (!myBrand) return;
    setStep('analyzing');
    setError('');
    setProgress('Classifying ads across the Five Pillars + Andromeda metrics...');

    try {
      const res = await fetch('/api/analyze/diversity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: myBrand.pageId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed');
      }

      const data: DiversityResult = await res.json();
      setDiversityResult(data);
      setStep('results');

      // Fetch benchmark if category was selected
      if (selectedCategory) {
        setBenchmarkLoading(true);
        try {
          const benchRes = await fetch('/api/analyze/benchmark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pageId: myBrand.pageId, category: selectedCategory }),
          });
          if (benchRes.ok) {
            const benchData = await benchRes.json();
            if (!benchData.needsAnalysis) {
              setBenchmarkResult(benchData);
            }
          }
        } catch { /* benchmark is optional, don't fail */ }
        setBenchmarkLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('setup');
    }
  };

  const generateImage = async (rec: Recommendation) => {
    setSelectedRec(rec);
    setStep('generating-image');
    setGeneratedImageUrl(null);

    try {
      const res = await fetch('/api/analyze/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: rec.imagePrompt, aspectRatio: '1:1' }),
      });
      if (!res.ok) throw new Error('Image generation failed');
      const data = await res.json();
      setGeneratedImageUrl(data.imageUrl);
      setStep('image-result');
    } catch {
      setError('Image generation failed. Try again.');
      setStep('results');
    }
  };

  const resetToStart = () => {
    setStep('setup');
    setMyBrand(null);
    setDiversityResult(null);
    setSelectedRec(null);
    setGeneratedImageUrl(null);
    setBenchmarkResult(null);
    setSelectedCategory('');
    setBenchmarkLoading(false);
    setError('');
  };

  // ---------------------------------------------------------------------------
  // Step: Setup
  // ---------------------------------------------------------------------------

  if (step === 'setup') {
    return (
      <V2Shell title="Creative Lab">
        <div className="max-w-2xl mx-auto mt-8">
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-[#1235e2]/10 flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-7 h-7 text-[#1235e2]" />
            </div>
            <h2 className="text-2xl font-black mb-2">Andromeda Creative Analyzer</h2>
            <p className={`max-w-md mx-auto ${muted}`}>
              Analyze your ad creatives against Meta Andromeda best practices.
              Five Pillars diversity, hook quality, concept redundancy, refresh rate, and more.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
              {error}
              <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
            </div>
          )}

          <V2Card className="p-6 mb-6">
            <h3 className="font-bold mb-1 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#1235e2]" />
              Select Your Brand
            </h3>
            <p className={`text-sm mb-4 ${muted}`}>
              Search for a Facebook page to analyze its creative strategy.
            </p>

            {myBrand ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1235e2]/10 flex items-center justify-center text-sm font-bold text-[#1235e2]">
                    {myBrand.pageName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{myBrand.pageName}</p>
                    <p className={`text-xs ${muted}`}>{myBrand.adCount} ads</p>
                  </div>
                </div>
                <button onClick={() => setMyBrand(null)} className={`text-xs ${muted} hover:text-red-400`}>Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${muted}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Search for a brand..."
                  className={`w-full pl-10 pr-4 py-3 rounded-lg border text-sm ${
                    darkMode ? 'bg-slate-800/50 border-[#1235e2]/20 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 placeholder:text-slate-400'
                  }`}
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#1235e2]" />}
                {searchResults.length > 0 && (
                  <div className={`absolute z-20 w-full mt-1 rounded-lg border shadow-xl max-h-60 overflow-y-auto ${darkMode ? 'bg-[#101322] border-[#1235e2]/20' : 'bg-white border-slate-200'}`}>
                    {searchResults.map((r) => (
                      <button
                        key={r.pageId}
                        onClick={() => selectBrand(r)}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${darkMode ? 'hover:bg-[#1235e2]/10' : 'hover:bg-slate-50'}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-[#1235e2]/10 flex items-center justify-center text-xs font-bold text-[#1235e2]">{r.pageName.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.pageName}</p>
                          <p className={`text-xs ${muted}`}>{r.adCount} ads &middot; {r.source}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </V2Card>

          <V2Card className="p-6 mb-6">
            <h3 className="font-bold mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#1235e2]" />
              Benchmark Against Category
            </h3>
            <p className={`text-sm mb-4 ${muted}`}>
              Optional: Compare your brand against a category average.
            </p>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full px-4 py-3 rounded-lg border text-sm ${
                darkMode
                  ? 'bg-slate-800/50 border-[#1235e2]/20 text-white'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <option value="">Skip benchmarking</option>
              {categories.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {cat.label} ({cat.brandCount} brands)
                </option>
              ))}
            </select>
          </V2Card>

          {myBrand && (
            <button
              onClick={runAnalysis}
              className="w-full py-3 rounded-xl bg-[#1235e2] text-white font-semibold hover:bg-[#0f2dc4] transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              Run Andromeda Analysis
            </button>
          )}
        </div>
      </V2Shell>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: Analyzing
  // ---------------------------------------------------------------------------

  if (step === 'analyzing') {
    return (
      <V2Shell title="Creative Lab">
        <div className="max-w-md mx-auto mt-24 text-center">
          <Loader2 className="w-12 h-12 text-[#1235e2] animate-spin mx-auto mb-6" />
          <h3 className="text-lg font-bold mb-2">Analyzing Creative Strategy</h3>
          <p className={`text-sm ${muted}`}>{progress}</p>
          <p className={`text-xs mt-2 ${muted}`}>This takes 30-60 seconds...</p>
        </div>
      </V2Shell>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: Brief
  // ---------------------------------------------------------------------------

  if (step === 'brief' && selectedRec) {
    const pillarCfg = PILLAR_CONFIG[selectedRec.pillar] || METRIC_CONFIG[selectedRec.pillar];
    return (
      <V2Shell title="Creative Lab">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => { setStep('results'); setSelectedRec(null); }} className={`flex items-center gap-1 text-sm mb-6 ${muted} hover:text-[#1235e2]`}>
            <ArrowLeft className="w-4 h-4" /> Back to results
          </button>
          <div className={`${card} p-8`}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${selectedRec.priority === 'high' ? 'bg-red-500/10 text-red-400' : selectedRec.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'}`}>{selectedRec.priority} priority</span>
                <h2 className="text-xl font-black">{selectedRec.briefTitle}</h2>
                <p className={`text-sm mt-1 ${muted}`}>
                  Addresses: <span className="font-medium" style={{ color: pillarCfg?.color || '#1235e2' }}>{pillarCfg?.label || selectedRec.pillar}</span>
                </p>
              </div>
              <FileText className="w-6 h-6 text-[#1235e2]" />
            </div>
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: pillarCfg?.color }}>Gap Identified</h4>
                <p className={`text-sm ${muted}`}>{selectedRec.gap}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-[#1235e2]">Creative Brief</h4>
                <p className="text-sm leading-relaxed">{selectedRec.briefDescription}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-[#1235e2]">Visual Direction</h4>
                <p className={`text-sm ${muted}`}>{selectedRec.imagePrompt}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-8 pt-6 border-t border-slate-200/10">
              <button onClick={() => generateImage(selectedRec)} className="flex-1 py-3 rounded-xl bg-[#1235e2] text-white font-semibold hover:bg-[#0f2dc4] transition-colors flex items-center justify-center gap-2">
                <ImageIcon className="w-4 h-4" /> Generate AI Image
              </button>
              <button
                onClick={() => {
                  const text = `CREATIVE BRIEF: ${selectedRec.briefTitle}\n\nPillar: ${pillarCfg?.label || selectedRec.pillar}\nPriority: ${selectedRec.priority}\n\nGap: ${selectedRec.gap}\n\nSuggestion: ${selectedRec.suggestion}\n\nBrief:\n${selectedRec.briefDescription}\n\nVisual Direction:\n${selectedRec.imagePrompt}`;
                  navigator.clipboard.writeText(text);
                }}
                className={`px-4 py-3 rounded-xl border font-semibold text-sm transition-colors ${darkMode ? 'border-[#1235e2]/20 hover:bg-[#1235e2]/10' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                Copy Brief
              </button>
            </div>
          </div>
        </div>
      </V2Shell>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: Generating image / Image result
  // ---------------------------------------------------------------------------

  if (step === 'generating-image') {
    return (
      <V2Shell title="Creative Lab">
        <div className="max-w-md mx-auto mt-24 text-center">
          <Loader2 className="w-12 h-12 text-[#1235e2] animate-spin mx-auto mb-6" />
          <h3 className="text-lg font-bold mb-2">Generating Ad Creative</h3>
          <p className={`text-sm ${muted}`}>Creating an AI image based on the brief...</p>
        </div>
      </V2Shell>
    );
  }

  if (step === 'image-result' && selectedRec) {
    return (
      <V2Shell title="Creative Lab">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => { setStep('results'); setSelectedRec(null); setGeneratedImageUrl(null); }} className={`flex items-center gap-1 text-sm mb-6 ${muted} hover:text-[#1235e2]`}>
            <ArrowLeft className="w-4 h-4" /> Back to results
          </button>
          <div className={`${card} overflow-hidden`}>
            {generatedImageUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={generatedImageUrl} alt="Generated ad creative" className="w-full" />
            )}
            <div className="p-6">
              <h3 className="font-bold text-lg mb-1">{selectedRec.briefTitle}</h3>
              <p className={`text-sm ${muted} mb-4`}>{selectedRec.suggestion}</p>
              <div className={`${mutedBg} rounded-lg p-4 mb-4`}>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-2 text-[#1235e2]">Brief</h4>
                <p className="text-sm leading-relaxed">{selectedRec.briefDescription}</p>
              </div>
              <div className="flex gap-3">
                {generatedImageUrl && (
                  <a href={generatedImageUrl} download="ad-creative.webp" target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl bg-[#1235e2] text-white font-semibold hover:bg-[#0f2dc4] transition-colors flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Download Image
                  </a>
                )}
                <button onClick={() => generateImage(selectedRec)} className={`px-4 py-3 rounded-xl border font-semibold text-sm transition-colors ${darkMode ? 'border-[#1235e2]/20 hover:bg-[#1235e2]/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                  Regenerate
                </button>
              </div>
            </div>
          </div>
        </div>
      </V2Shell>
    );
  }

  // ---------------------------------------------------------------------------
  // Step: Results Dashboard
  // ---------------------------------------------------------------------------

  if (step === 'results' && diversityResult) {
    const dr = diversityResult;
    const am = dr.andromedaMetrics;

    return (
      <V2Shell title="Creative Lab">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <button onClick={resetToStart} className={`flex items-center gap-1 text-sm mb-2 ${muted} hover:text-[#1235e2]`}>
                <ArrowLeft className="w-4 h-4" /> Analyze another brand
              </button>
              <h2 className="text-2xl font-black">{dr.brandName}</h2>
              <p className={`text-sm ${muted}`}>{dr.totalAdsAnalyzed} ads analyzed &middot; {dr.category || 'Uncategorized'}</p>
            </div>
            <div className="text-right flex items-center gap-6">
              <div>
                <div className="text-3xl font-black text-[#1235e2]">{dr.diversityScores.overall}</div>
                <p className={`text-[10px] ${muted}`}>Diversity Score</p>
              </div>
              <div>
                <div className="text-3xl font-black text-emerald-400">{dr.andromedaScore}</div>
                <p className={`text-[10px] ${muted}`}>Andromeda Score</p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <V2Card className="p-6 mb-6">
            <p className="text-sm leading-relaxed">{dr.summary}</p>
            <div className="mt-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-400 font-medium">{dr.biggestGap}</p>
            </div>
          </V2Card>

          {/* Five Pillar Scores */}
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#1235e2]" />
            Five Pillars of Creative Diversity
          </h3>

          <div className="grid grid-cols-5 gap-3 mb-4">
            {Object.entries(PILLAR_CONFIG).map(([key, cfg]) => {
              const score = dr.diversityScores[key as keyof DiversityScores] as number;
              return (
                <div key={key} className={`${card} p-4 text-center`}>
                  <div className="text-2xl font-black mb-1" style={{ color: cfg.color }}>{score}</div>
                  <p className="text-xs font-medium">{cfg.label}</p>
                  <div className={`h-1.5 rounded-full mt-2 ${mutedBg}`}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: cfg.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pillar Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {Object.entries(PILLAR_CONFIG).map(([key, cfg]) => {
              const dist = dr.distribution[key as keyof PillarDistribution];
              const total = Object.values(dist).reduce((s, v) => s + v, 0);
              const allEntries = cfg.allValues.map((val) => ({
                label: val,
                count: dist[val] || 0,
                pct: total > 0 ? Math.round(((dist[val] || 0) / total) * 100) : 0,
              }));
              return (
                <V2Card key={key} className="p-5">
                  <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                    {cfg.label}
                  </h4>
                  <div className="space-y-2">
                    {allEntries.map((entry) => (
                      <div key={entry.label} className="flex items-center gap-2">
                        <span className={`text-xs w-24 truncate ${entry.count === 0 ? 'text-red-400/60' : muted}`}>{entry.label}</span>
                        <div className={`flex-1 h-2 rounded-full ${mutedBg}`}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${entry.pct}%`, backgroundColor: entry.count === 0 ? 'transparent' : cfg.color, minWidth: entry.count > 0 ? '4px' : '0' }} />
                        </div>
                        <span className={`text-xs font-mono w-8 text-right ${entry.count === 0 ? 'text-red-400/60' : ''}`}>{entry.count}</span>
                      </div>
                    ))}
                  </div>
                </V2Card>
              );
            })}
          </div>

          {/* Andromeda Best Practices */}
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-400" />
            Andromeda Best Practices
          </h3>

          {/* Row 1: Status cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Creative Volume & Refresh */}
            <V2Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold">Refresh Rate</h4>
                </div>
                <StatusBadge status={am.creativeVolume.status} />
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-black text-cyan-400">{am.creativeVolume.avgRefreshRate}</span>
                <span className={`text-xs ${muted}`}>new ads/week</span>
              </div>
              <p className={`text-xs ${muted}`}>{am.creativeVolume.totalActive} active ads total</p>
              {/* Mini sparkline */}
              <div className="flex items-end gap-0.5 mt-3 h-8">
                {am.creativeVolume.weeklyNewAds.map((w, i) => {
                  const max = Math.max(...am.creativeVolume.weeklyNewAds.map((x) => x.count), 1);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-cyan-400/30"
                      style={{ height: `${Math.max((w.count / max) * 100, 4)}%` }}
                      title={`${w.week}: ${w.count} ads`}
                    />
                  );
                })}
              </div>
              <p className={`text-[10px] mt-1 ${muted}`}>Last 8 weeks</p>
            </V2Card>

            {/* Ad Fatigue */}
            <V2Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold">Ad Fatigue</h4>
                </div>
                <StatusBadge status={am.adFatigue.status} />
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-black text-amber-400">{am.adFatigue.stalePercentage}%</span>
                <span className={`text-xs ${muted}`}>stale (3+ weeks)</span>
              </div>
              <p className={`text-xs ${muted}`}>{am.adFatigue.staleAds} of {dr.totalAdsAnalyzed} ads &middot; Oldest: {am.adFatigue.oldestAdDays}d</p>
              <div className={`h-3 rounded-full mt-3 ${mutedBg} overflow-hidden`}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${am.adFatigue.stalePercentage}%`,
                    backgroundColor: am.adFatigue.status === 'healthy' ? '#10b981' : am.adFatigue.status === 'warning' ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className={`text-[10px] ${muted}`}>Fresh</span>
                <span className={`text-[10px] ${muted}`}>Stale</span>
              </div>
            </V2Card>

            {/* Funnel Balance */}
            <V2Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  <h4 className="text-sm font-bold">Funnel Balance</h4>
                </div>
                <StatusBadge status={am.funnelBalance.status} />
              </div>
              <div className="space-y-2 mt-2">
                {[
                  { label: 'Awareness', pct: am.funnelBalance.awareness, ideal: 40, color: '#3b82f6' },
                  { label: 'Consideration', pct: am.funnelBalance.consideration, ideal: 30, color: '#f59e0b' },
                  { label: 'Conversion', pct: am.funnelBalance.conversion, ideal: 30, color: '#10b981' },
                ].map((f) => (
                  <div key={f.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{f.label}</span>
                      <span>
                        <span className="font-bold" style={{ color: f.color }}>{f.pct}%</span>
                        <span className={`ml-1 ${muted}`}>(ideal ~{f.ideal}%)</span>
                      </span>
                    </div>
                    <div className={`h-2 rounded-full ${mutedBg} relative`}>
                      <div className="h-full rounded-full" style={{ width: `${f.pct}%`, backgroundColor: f.color }} />
                      <div className="absolute top-0 h-full w-0.5 bg-white/30" style={{ left: `${f.ideal}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </V2Card>
          </div>

          {/* Row 2: Hook Quality + Concept Diversity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Hook Quality */}
            <V2Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <h4 className="text-sm font-bold">Hook Quality</h4>
                </div>
                <span className="text-2xl font-black text-orange-400">{am.hookQuality.avgScore}<span className="text-sm font-normal text-orange-400/60">/10</span></span>
              </div>

              <div className="flex gap-2 mb-4">
                {[
                  { label: 'Weak (1-3)', count: am.hookQuality.distribution.weak, color: '#ef4444' },
                  { label: 'Average (4-6)', count: am.hookQuality.distribution.average, color: '#f59e0b' },
                  { label: 'Strong (7-10)', count: am.hookQuality.distribution.strong, color: '#10b981' },
                ].map((b) => (
                  <div key={b.label} className="flex-1 text-center">
                    <div className="text-lg font-bold" style={{ color: b.color }}>{b.count}</div>
                    <p className={`text-[10px] ${muted}`}>{b.label}</p>
                  </div>
                ))}
              </div>

              {am.hookQuality.topHooks.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-1.5">Top Hooks</p>
                  <div className="space-y-1">
                    {am.hookQuality.topHooks.map((h, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs ${muted}`}>
                        <span className="font-bold text-emerald-400 w-4">{h.score}</span>
                        <span className="truncate">{h.firstLine || '(empty)'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {am.hookQuality.bottomHooks.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1.5">Weakest Hooks</p>
                  <div className="space-y-1">
                    {am.hookQuality.bottomHooks.map((h, i) => (
                      <div key={i} className={`flex items-center gap-2 text-xs ${muted}`}>
                        <span className="font-bold text-red-400 w-4">{h.score}</span>
                        <span className="truncate">{h.firstLine || '(empty)'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </V2Card>

            {/* Concept Diversity */}
            <V2Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-bold">Concept Diversity</h4>
                </div>
                <span className="text-2xl font-black text-purple-400">{am.conceptDiversity.uniqueConcepts}</span>
              </div>

              {am.conceptDiversity.redundancyFlag && (
                <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {am.conceptDiversity.dominantPercentage}% of ads use the same concept: &ldquo;{am.conceptDiversity.dominantConcept}&rdquo;
                </div>
              )}

              <p className={`text-xs mb-3 ${muted}`}>
                {am.conceptDiversity.uniqueConcepts} unique concepts across {am.conceptDiversity.totalAds} ads.
                Andromeda suppresses ads with &gt;60% similarity.
              </p>

              <div className="space-y-1.5">
                {am.conceptDiversity.clusters.slice(0, 8).map((cluster) => {
                  const pct = Math.round((cluster.count / am.conceptDiversity.totalAds) * 100);
                  const isRedundant = pct > 60;
                  return (
                    <div key={cluster.concept} className="flex items-center gap-2">
                      <span className={`text-xs w-32 truncate ${isRedundant ? 'text-red-400 font-medium' : muted}`}>{cluster.concept}</span>
                      <div className={`flex-1 h-2 rounded-full ${mutedBg}`}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isRedundant ? '#ef4444' : '#a855f7',
                            minWidth: '4px',
                          }}
                        />
                      </div>
                      <span className={`text-xs font-mono w-8 text-right ${isRedundant ? 'text-red-400' : ''}`}>{cluster.count}</span>
                    </div>
                  );
                })}
              </div>
            </V2Card>
          </div>

          {/* Row 3: CTA Diversity + Copy Length */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {/* CTA Diversity */}
            <V2Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-teal-400" />
                  <h4 className="text-sm font-bold">CTA Diversity</h4>
                </div>
                <StatusBadge status={am.ctaDiversity.status} />
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-black text-teal-400">{am.ctaDiversity.uniqueCtas}</span>
                <span className={`text-xs ${muted}`}>unique CTAs across {am.ctaDiversity.totalAds} ads</span>
              </div>
              <div className="space-y-1.5">
                {Object.entries(am.ctaDiversity.distribution)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([cta, count]) => {
                    const pct = Math.round((count / am.ctaDiversity.totalAds) * 100);
                    return (
                      <div key={cta} className="flex items-center gap-2">
                        <span className={`text-xs w-28 truncate ${muted}`}>{cta}</span>
                        <div className={`flex-1 h-2 rounded-full ${mutedBg}`}>
                          <div className="h-full rounded-full bg-teal-400" style={{ width: `${pct}%`, minWidth: '4px' }} />
                        </div>
                        <span className={`text-xs font-mono w-8 text-right`}>{count}</span>
                      </div>
                    );
                  })}
              </div>
            </V2Card>

            {/* Copy Length */}
            <V2Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Type className="w-4 h-4 text-slate-400" />
                  <h4 className="text-sm font-bold">Copy Length Mix</h4>
                </div>
                <StatusBadge status={am.copyLength.status} />
              </div>
              <p className={`text-xs mb-4 ${muted}`}>Healthy accounts mix short punchy copy with longer storytelling.</p>

              <div className="flex gap-3">
                {[
                  { label: 'Short', sublabel: '<50 chars', count: am.copyLength.short, color: '#3b82f6' },
                  { label: 'Medium', sublabel: '50-200', count: am.copyLength.medium, color: '#f59e0b' },
                  { label: 'Long', sublabel: '200+', count: am.copyLength.long, color: '#10b981' },
                ].map((b) => {
                  const total = am.copyLength.short + am.copyLength.medium + am.copyLength.long;
                  const pct = total > 0 ? Math.round((b.count / total) * 100) : 0;
                  return (
                    <div key={b.label} className="flex-1 text-center">
                      <div className={`${mutedBg} rounded-xl p-3`}>
                        <div className="text-xl font-black" style={{ color: b.color }}>{b.count}</div>
                        <p className="text-xs font-medium mt-0.5">{b.label}</p>
                        <p className={`text-[10px] ${muted}`}>{b.sublabel}</p>
                      </div>
                      <div className={`h-1.5 rounded-full mt-2 ${mutedBg}`}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                      </div>
                      <p className={`text-[10px] mt-0.5 ${muted}`}>{pct}%</p>
                    </div>
                  );
                })}
              </div>
            </V2Card>
          </div>

          {/* Recommendations */}
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#1235e2]" />
            Recommended Creatives
          </h3>
          <p className={`text-sm ${muted} mb-6`}>
            AI-generated recommendations based on Five Pillar gaps and Andromeda best practices.
          </p>

          <div className="space-y-4 mb-8">
            {dr.recommendations.map((rec, i) => {
              const pillarCfg = PILLAR_CONFIG[rec.pillar] || METRIC_CONFIG[rec.pillar];
              return (
                <V2Card key={i} className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: pillarCfg?.color || '#1235e2' }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="font-bold text-sm">{rec.briefTitle}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${rec.priority === 'high' ? 'bg-red-500/10 text-red-400' : rec.priority === 'medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'}`}>{rec.priority}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${pillarCfg?.color || '#1235e2'}15`, color: pillarCfg?.color || '#1235e2' }}>{pillarCfg?.label || rec.pillar}</span>
                      </div>
                      <p className={`text-sm ${muted} mb-1`}>{rec.gap}</p>
                      <p className="text-sm">{rec.suggestion}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => { setSelectedRec(rec); setStep('brief'); }}
                        className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${darkMode ? 'bg-[#1235e2]/10 hover:bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                      >
                        <FileText className="w-3.5 h-3.5" /> Brief
                      </button>
                      <button
                        onClick={() => generateImage(rec)}
                        className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Generate
                      </button>
                    </div>
                  </div>
                </V2Card>
              );
            })}
          </div>

          {/* Benchmark Comparison */}
          {(benchmarkResult || benchmarkLoading) && (
            <BenchmarkComparison
              result={benchmarkResult}
              loading={benchmarkLoading}
              darkMode={darkMode}
              pillarConfig={PILLAR_CONFIG}
            />
          )}
        </div>
      </V2Shell>
    );
  }

  // Fallback
  return (
    <V2Shell title="Creative Lab">
      <div className="text-center mt-24">
        <p className={muted}>Something went wrong.</p>
        <button onClick={resetToStart} className="mt-4 text-[#1235e2] text-sm font-medium">Start over</button>
      </div>
    </V2Shell>
  );
}
