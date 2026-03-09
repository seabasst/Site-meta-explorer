'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wand2,
  Sparkles,
  Loader2,
  Copy,
  Check,
  ChevronRight,
  Palette,
  Type,
  Image as ImageIcon,
  Target,
  Zap,
  ArrowLeft,
  Send,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

// Types
interface Category {
  slug: string;
  label: string;
  brandCount: number;
  totalActiveAds: number;
  ingestionPct: number;
}

interface AdAnalysisItem {
  adId: string;
  brand: string;
  headline: string;
  messagingAngle: string;
  visualStyle: string;
  colorPalette: string[];
  emotionalTone: string;
  creativityScore: number;
  clarityScore: number;
  persuasionScore: number;
  keyElements: string[];
  whyItWorks: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  messagingAngle: string;
  visualStyle: string;
  headlineFormula: string;
  bodyFormula: string;
  ctaText: string;
  colorSuggestions: string[];
  imageryNotes: string;
  layoutNotes: string;
  formatRecommendation: string | null;
  platformNotes: string | null;
}

interface GeneratedVariation {
  headline: string;
  primaryText: string;
  description: string;
  ctaButton: string;
  toneNote: string;
}

interface GenerateResult {
  template: {
    id: string;
    name: string;
    messagingAngle: string;
    colorSuggestions: string[];
    imageryNotes: string;
    layoutNotes: string;
    formatRecommendation: string | null;
  };
  variations: GeneratedVariation[];
  imageryDirection: string;
  targetingTip: string;
}

type Step = 'select-category' | 'analyzing' | 'templates' | 'fill-template' | 'generating' | 'results';

export default function CreativeLabPage() {
  const { darkMode } = useV2();
  const [step, setStep] = useState<Step>('select-category');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Analysis state
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [analyses, setAnalyses] = useState<AdAnalysisItem[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [analyzeError, setAnalyzeError] = useState<string>('');

  // Template fill state
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({
    brand: '',
    product: '',
    price: '',
    benefit: '',
    destination: '',
    cta_url: '',
  });

  // Generated results
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) setCategories(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Check for existing templates/analyses
  const checkExisting = useCallback(async (category: string) => {
    try {
      const res = await fetch(`/api/analyze?category=${category}`);
      if (res.ok) {
        const data = await res.json();
        if (data.templates?.length > 0) {
          setTemplates(data.templates);
          setAnalyses(
            data.analyses?.map((a: Record<string, unknown>) => ({
              ...(a as { fullAnalysis: AdAnalysisItem }).fullAnalysis,
              adId: (a as { ad: { adId: string } }).ad?.adId,
              brand: (a as { ad: { brand: { pageName: string } } }).ad?.brand?.pageName,
            })) || []
          );
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  }, []);

  const startAnalysis = async (category: string) => {
    setSelectedCategory(category);
    setAnalyzeError('');

    // Check for cached results first
    const hasExisting = await checkExisting(category);
    if (hasExisting) {
      setStep('templates');
      return;
    }

    setStep('analyzing');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, limit: 20 }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(err.error);
      }

      const data = await res.json();
      setAnalyses(data.analyses || []);
      setTemplates(data.templates || []);
      setStep('templates');
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Analysis failed');
      setStep('select-category');
    }
  };

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    // Extract placeholders from formulas
    const placeholders = new Set<string>();
    const regex = /\{(\w+)\}/g;
    let match;
    while ((match = regex.exec(template.headlineFormula)) !== null) placeholders.add(match[1]);
    while ((match = regex.exec(template.bodyFormula)) !== null) placeholders.add(match[1]);

    const newVars: Record<string, string> = {};
    for (const p of placeholders) newVars[p] = variables[p] || '';
    // Always include brand
    if (!newVars.brand) newVars.brand = '';
    setVariables(newVars);
    setStep('fill-template');
  };

  const generateAd = async () => {
    if (!selectedTemplate) return;
    setStep('generating');

    try {
      const res = await fetch('/api/analyze/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplate.id, variables }),
      });

      if (!res.ok) throw new Error('Generation failed');

      const data = await res.json();
      setGenerateResult(data);
      setStep('results');
    } catch {
      setStep('fill-template');
    }
  };

  const resetToStart = () => {
    setStep('select-category');
    setSelectedCategory('');
    setAnalyses([]);
    setTemplates([]);
    setSelectedTemplate(null);
    setGenerateResult(null);
    setAnalyzeError('');
  };

  return (
    <V2Shell title="Creative Lab">
      {/* Step indicator */}
      {step !== 'select-category' && (
        <div className="mb-8">
          <button
            onClick={step === 'templates' ? resetToStart : () => setStep('templates')}
            className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
              darkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 'templates' || step === 'analyzing' ? 'All Categories' : 'Back to Templates'}
          </button>
        </div>
      )}

      {/* Step 1: Select Category */}
      {step === 'select-category' && (
        <>
          <div className="text-center mb-10">
            <div className="w-14 h-14 rounded-2xl bg-[#1235e2]/10 flex items-center justify-center mx-auto mb-4">
              <Wand2 className="w-7 h-7 text-[#1235e2]" />
            </div>
            <h2 className="text-2xl font-black mb-2">Creative Lab</h2>
            <p className={`max-w-lg mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              AI analyzes top-performing ads in any category, extracts winning patterns,
              and generates ready-to-use ad templates for your brand.
            </p>
          </div>

          {analyzeError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {analyzeError}
            </div>
          )}

          {loading ? (
            <V2Skeleton rows={2} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <button
                  key={cat.slug}
                  onClick={() => startAnalysis(cat.slug)}
                  className="text-left"
                >
                  <V2Card className="p-5 hover:shadow-lg transition-all group cursor-pointer h-full">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-bold mb-1">{cat.label}</h3>
                        <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {cat.brandCount} brands &middot; {formatNumber(cat.totalActiveAds)} active ads
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${
                          darkMode ? 'text-slate-600' : 'text-slate-300'
                        }`}
                      />
                    </div>
                  </V2Card>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Step 2: Analyzing */}
      {step === 'analyzing' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#1235e2]/10 flex items-center justify-center mb-6">
            <Loader2 className="w-8 h-8 text-[#1235e2] animate-spin" />
          </div>
          <h3 className="text-xl font-bold mb-2">Analyzing Top Ads</h3>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            AI is reviewing top {selectedCategory} ads with vision analysis...
          </p>
          <p className={`text-xs mt-2 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            This may take 30-60 seconds
          </p>
        </div>
      )}

      {/* Step 3: Templates */}
      {step === 'templates' && (
        <>
          {/* Analysis insights summary */}
          {analyses.length > 0 && (
            <section className="mb-10">
              <V2SectionTitle icon={<Sparkles className="w-5 h-5 text-[#1235e2]" />}>
                Creative Insights ({analyses.length} ads analyzed)
              </V2SectionTitle>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Top messaging angles */}
                <V2Card className="p-5">
                  <h4 className={`text-xs uppercase font-bold tracking-wider mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Top Messaging Angles
                  </h4>
                  <div className="space-y-2">
                    {getTopValues(analyses, 'messagingAngle').map(([angle, count]) => (
                      <div key={angle} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{angle}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-[#1235e2]/5 text-[#1235e2]'}`}>
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </V2Card>

                {/* Top visual styles */}
                <V2Card className="p-5">
                  <h4 className={`text-xs uppercase font-bold tracking-wider mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Visual Styles
                  </h4>
                  <div className="space-y-2">
                    {getTopValues(analyses, 'visualStyle').map(([style, count]) => (
                      <div key={style} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{style}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-[#1235e2]/5 text-[#1235e2]'}`}>
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </V2Card>

                {/* Avg scores */}
                <V2Card className="p-5">
                  <h4 className={`text-xs uppercase font-bold tracking-wider mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Average Scores
                  </h4>
                  <div className="space-y-3">
                    {[
                      { label: 'Creativity', key: 'creativityScore' as keyof AdAnalysisItem },
                      { label: 'Clarity', key: 'clarityScore' as keyof AdAnalysisItem },
                      { label: 'Persuasion', key: 'persuasionScore' as keyof AdAnalysisItem },
                    ].map(({ label, key }) => {
                      const avg = analyses.reduce((s, a) => s + (Number(a[key]) || 0), 0) / analyses.length;
                      return (
                        <div key={label}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{label}</span>
                            <span className="font-bold">{avg.toFixed(1)}/10</span>
                          </div>
                          <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <div
                              className="h-full bg-[#1235e2] rounded-full transition-all"
                              style={{ width: `${avg * 10}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </V2Card>
              </div>
            </section>
          )}

          {/* Templates */}
          <V2SectionTitle icon={<Wand2 className="w-5 h-5 text-[#1235e2]" />}>
            Ad Templates
          </V2SectionTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {templates.map((t) => (
              <V2Card key={t.id} className="p-6 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold">{t.name}</h3>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${
                    darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-[#1235e2]/5 text-[#1235e2]'
                  }`}>
                    {t.messagingAngle}
                  </span>
                </div>

                <p className={`text-sm mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t.description}
                </p>

                {/* Preview */}
                <div className={`rounded-lg p-4 mb-4 text-sm ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <p className="font-bold mb-1">{t.headlineFormula}</p>
                  <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t.bodyFormula}
                  </p>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Tag icon={<ImageIcon className="w-3 h-3" />} text={t.visualStyle} darkMode={darkMode} />
                  <Tag icon={<Target className="w-3 h-3" />} text={t.formatRecommendation || 'image'} darkMode={darkMode} />
                  {t.colorSuggestions?.length > 0 && (
                    <div className="flex items-center gap-1">
                      {t.colorSuggestions.slice(0, 3).map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => selectTemplate(t)}
                  className="w-full py-2.5 rounded-lg bg-[#1235e2] text-white text-sm font-medium hover:bg-[#0f2bc4] transition-colors flex items-center justify-center gap-2"
                >
                  <Wand2 className="w-4 h-4" />
                  Use This Template
                </button>
              </V2Card>
            ))}
          </div>

          {templates.length === 0 && (
            <V2Card className="p-12 text-center">
              <p className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
                No templates generated yet. Select a category to analyze.
              </p>
            </V2Card>
          )}
        </>
      )}

      {/* Step 4: Fill Template */}
      {step === 'fill-template' && selectedTemplate && (
        <>
          <V2SectionTitle icon={<Type className="w-5 h-5 text-[#1235e2]" />}>
            Customize: {selectedTemplate.name}
          </V2SectionTitle>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Input form */}
            <div>
              <V2Card className="p-6">
                <h4 className="font-bold mb-4">Fill in your details</h4>
                <div className="space-y-4">
                  {Object.keys(variables).map((key) => (
                    <div key={key}>
                      <label className={`text-xs uppercase font-bold tracking-wider mb-1.5 block ${
                        darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {key.replace(/_/g, ' ')}
                      </label>
                      <input
                        type="text"
                        value={variables[key]}
                        onChange={(e) => setVariables({ ...variables, [key]: e.target.value })}
                        placeholder={getPlaceholder(key)}
                        className={`w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
                          darkMode
                            ? 'bg-slate-800/50 border-[#1235e2]/20 text-white placeholder:text-slate-600'
                            : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={generateAd}
                  disabled={!variables.brand}
                  className={`w-full mt-6 py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    variables.brand
                      ? 'bg-[#1235e2] text-white hover:bg-[#0f2bc4]'
                      : darkMode
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Ad Copy
                </button>
              </V2Card>
            </div>

            {/* Template preview */}
            <div>
              <V2Card className="p-6">
                <h4 className="font-bold mb-4">Template Preview</h4>

                <div className={`rounded-lg p-4 mb-4 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                  <p className="font-bold text-lg mb-2">{fillPlaceholders(selectedTemplate.headlineFormula, variables)}</p>
                  <p className={`text-sm mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {fillPlaceholders(selectedTemplate.bodyFormula, variables)}
                  </p>
                  <span className="inline-block px-4 py-1.5 bg-[#1235e2] text-white text-xs rounded-lg font-medium">
                    {selectedTemplate.ctaText}
                  </span>
                </div>

                <div className="space-y-3">
                  <DetailRow icon={<Palette className="w-4 h-4" />} label="Colors" darkMode={darkMode}>
                    <div className="flex gap-1.5">
                      {selectedTemplate.colorSuggestions?.map((c, i) => (
                        <div key={i} className="w-6 h-6 rounded-md border border-white/20" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </DetailRow>
                  <DetailRow icon={<ImageIcon className="w-4 h-4" />} label="Imagery" darkMode={darkMode}>
                    <p className="text-sm">{selectedTemplate.imageryNotes}</p>
                  </DetailRow>
                  <DetailRow icon={<Target className="w-4 h-4" />} label="Layout" darkMode={darkMode}>
                    <p className="text-sm">{selectedTemplate.layoutNotes}</p>
                  </DetailRow>
                  {selectedTemplate.platformNotes && (
                    <DetailRow icon={<Zap className="w-4 h-4" />} label="Platform Tips" darkMode={darkMode}>
                      <p className="text-sm">{selectedTemplate.platformNotes}</p>
                    </DetailRow>
                  )}
                </div>
              </V2Card>
            </div>
          </div>
        </>
      )}

      {/* Step 5: Generating */}
      {step === 'generating' && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-[#1235e2]/10 flex items-center justify-center mb-6">
            <Loader2 className="w-8 h-8 text-[#1235e2] animate-spin" />
          </div>
          <h3 className="text-xl font-bold mb-2">Generating Ad Copy</h3>
          <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Creating 3 variations based on your template...
          </p>
        </div>
      )}

      {/* Step 6: Results */}
      {step === 'results' && generateResult && (
        <>
          <V2SectionTitle icon={<Sparkles className="w-5 h-5 text-[#1235e2]" />}>
            Generated Ad Copy
          </V2SectionTitle>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {generateResult.variations.map((v, i) => (
              <AdVariationCard key={i} variation={v} index={i} darkMode={darkMode} />
            ))}
          </div>

          {/* Creative direction */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <V2Card className="p-6">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#1235e2]" />
                Visual Direction
              </h4>
              <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {generateResult.imageryDirection}
              </p>
              {generateResult.template.colorSuggestions?.length > 0 && (
                <div className="flex gap-2 mt-4">
                  {generateResult.template.colorSuggestions.map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md border border-white/20" style={{ backgroundColor: c }} />
                      <span className={`text-xs font-mono ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{c}</span>
                    </div>
                  ))}
                </div>
              )}
            </V2Card>
            <V2Card className="p-6">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-[#1235e2]" />
                Targeting Suggestion
              </h4>
              <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                {generateResult.targetingTip}
              </p>
              {generateResult.template.layoutNotes && (
                <div className={`mt-4 pt-4 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Layout
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {generateResult.template.layoutNotes}
                  </p>
                </div>
              )}
            </V2Card>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('fill-template')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Regenerate
            </button>
            <button
              onClick={() => setStep('templates')}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Try Another Template
            </button>
            <button
              onClick={resetToStart}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              New Category
            </button>
          </div>
        </>
      )}
    </V2Shell>
  );
}

// Helpers
function getTopValues(analyses: AdAnalysisItem[], key: keyof AdAnalysisItem): [string, number][] {
  const counts = new Map<string, number>();
  for (const a of analyses) {
    const val = String(a[key] || 'unknown');
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
}

function fillPlaceholders(formula: string, vars: Record<string, string>): string {
  return formula.replace(/\{(\w+)\}/g, (match, key) => vars[key] || match);
}

function getPlaceholder(key: string): string {
  const placeholders: Record<string, string> = {
    brand: 'Your brand name',
    product: 'Product or service',
    price: 'e.g. $299, from $49',
    benefit: 'Key benefit or value prop',
    destination: 'e.g. Paris, Bali',
    cta_url: 'Landing page URL',
    offer: 'Special offer details',
    audience: 'Target audience',
  };
  return placeholders[key] || `Enter ${key}`;
}

// Sub-components
function Tag({ icon, text, darkMode }: { icon: React.ReactNode; text: string; darkMode: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full capitalize ${
      darkMode ? 'bg-[#1235e2]/10 text-slate-400' : 'bg-slate-100 text-slate-500'
    }`}>
      {icon}
      {text}
    </span>
  );
}

function DetailRow({
  icon,
  label,
  children,
  darkMode,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  darkMode: boolean;
}) {
  return (
    <div className={`flex gap-3 py-2 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
      <div className={`mt-0.5 ${darkMode ? 'text-[#1235e2]' : 'text-[#1235e2]'}`}>{icon}</div>
      <div className="flex-1">
        <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

function AdVariationCard({
  variation,
  index,
  darkMode,
}: {
  variation: GeneratedVariation;
  index: number;
  darkMode: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <V2Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Variation {index + 1}
        </span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-[#1235e2]/5 text-[#1235e2]'}`}>
          {variation.toneNote}
        </span>
      </div>

      {/* Ad preview mockup */}
      <div className={`rounded-xl overflow-hidden border mb-4 ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'}`}>
        {/* Simulated ad header */}
        <div className={`px-4 py-2 flex items-center gap-2 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
          <div className="w-8 h-8 rounded-full bg-[#1235e2]/20" />
          <div>
            <div className={`text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>Your Brand</div>
            <div className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Sponsored</div>
          </div>
        </div>

        {/* Primary text */}
        <div className="px-4 py-3">
          <CopyableText text={variation.primaryText} field="primary" copied={copied} onCopy={copyText} darkMode={darkMode} />
        </div>

        {/* Image placeholder */}
        <div className={`h-40 flex items-center justify-center ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
          <ImageIcon className={`w-8 h-8 ${darkMode ? 'text-slate-700' : 'text-slate-300'}`} />
        </div>

        {/* Headline + description + CTA */}
        <div className={`px-4 py-3 ${darkMode ? 'bg-slate-800/30' : 'bg-slate-50'}`}>
          <CopyableText text={variation.headline} field="headline" copied={copied} onCopy={copyText} darkMode={darkMode} className="font-bold mb-1" />
          <CopyableText text={variation.description} field="desc" copied={copied} onCopy={copyText} darkMode={darkMode} className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} />
          <div className="mt-2">
            <span className="inline-block px-3 py-1 bg-[#1235e2] text-white text-xs rounded font-medium">
              {variation.ctaButton}
            </span>
          </div>
        </div>
      </div>
    </V2Card>
  );
}

function CopyableText({
  text,
  field,
  copied,
  onCopy,
  darkMode,
  className = '',
}: {
  text: string;
  field: string;
  copied: string | null;
  onCopy: (text: string, field: string) => void;
  darkMode: boolean;
  className?: string;
}) {
  return (
    <div className={`group relative ${className}`}>
      <p className="text-sm pr-6">{text}</p>
      <button
        onClick={() => onCopy(text, field)}
        className={`absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded ${
          darkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200'
        }`}
        title="Copy"
      >
        {copied === field ? (
          <Check className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <Copy className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        )}
      </button>
    </div>
  );
}
