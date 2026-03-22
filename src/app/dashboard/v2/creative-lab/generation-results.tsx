'use client';

import { ArrowLeft, Download, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { V2Card } from '../v2-shell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdFormat {
  id: string;
  label: string;
  size: string;
  aspectRatio: string;
  description: string;
}

export interface GenerationResult {
  format: AdFormat;
  imageUrl: string | null;
  status: 'loading' | 'success' | 'error';
  error?: string;
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

interface GenerationResultsProps {
  results: GenerationResult[];
  prompt: string;
  recommendation: Recommendation;
  darkMode: boolean;
  onBack: () => void;
  onRegenerate: (format: AdFormat) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadImage(url: string, filename: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

async function downloadAll(results: GenerationResult[]) {
  const successful = results.filter((r) => r.status === 'success' && r.imageUrl);
  for (let i = 0; i < successful.length; i++) {
    const r = successful[i];
    await downloadImage(r.imageUrl!, `ad-creative-${r.format.id}.jpg`);
    if (i < successful.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GenerationResults({
  results,
  prompt,
  recommendation,
  darkMode,
  onBack,
  onRegenerate,
}: GenerationResultsProps) {
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-100';

  const successCount = results.filter((r) => r.status === 'success').length;
  const loadingCount = results.filter((r) => r.status === 'loading').length;

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className={`flex items-center gap-1 text-sm mb-6 ${muted} hover:text-[#1235e2] transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" /> Back to results
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-black mb-1">{recommendation.briefTitle}</h2>
          <p className={`text-sm ${muted}`}>
            {loadingCount > 0
              ? `Generating ${loadingCount} of ${results.length} variant${results.length !== 1 ? 's' : ''}...`
              : `${successCount} of ${results.length} variant${results.length !== 1 ? 's' : ''} generated`}
          </p>
        </div>
        {successCount >= 2 && (
          <button
            onClick={() => downloadAll(results)}
            className="px-4 py-2 rounded-xl bg-[#1235e2] text-white text-sm font-semibold hover:bg-[#0f2dc4] transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Download All
          </button>
        )}
      </div>

      {/* Prompt used */}
      <div className={`${mutedBg} rounded-xl p-4 mb-6`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#1235e2] mb-1">Prompt Used</p>
        <p className={`text-sm ${muted} leading-relaxed`}>{prompt}</p>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {results.map((result) => (
          <V2Card key={result.format.id} className="overflow-hidden">
            {/* Image area */}
            <div className="relative">
              {result.status === 'loading' && (
                <div
                  className={`w-full flex flex-col items-center justify-center ${mutedBg} animate-pulse`}
                  style={{ aspectRatio: result.format.aspectRatio.replace(':', ' / '), maxHeight: '400px' }}
                >
                  <Loader2 className="w-8 h-8 text-[#1235e2] animate-spin mb-2" />
                  <p className={`text-sm font-medium ${muted}`}>Generating {result.format.label}...</p>
                  <p className={`text-xs ${muted} mt-0.5`}>{result.format.size}</p>
                </div>
              )}

              {result.status === 'success' && result.imageUrl && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.imageUrl}
                    alt={`Generated ${result.format.label} creative`}
                    className="w-full"
                    style={{ maxHeight: '400px', objectFit: 'cover' }}
                  />
                  {/* Format badge */}
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                    {result.format.label} &middot; {result.format.size}
                  </div>
                </div>
              )}

              {result.status === 'error' && (
                <div
                  className={`w-full flex flex-col items-center justify-center ${mutedBg}`}
                  style={{ aspectRatio: result.format.aspectRatio.replace(':', ' / '), maxHeight: '400px' }}
                >
                  <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                  <p className="text-sm font-medium text-red-400">Generation failed</p>
                  <p className={`text-xs ${muted} mt-0.5`}>{result.error || 'Unknown error'}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{result.format.label}</p>
                <p className={`text-xs ${muted}`}>
                  {result.format.size} &middot; {result.format.aspectRatio}
                </p>
              </div>
              <div className="flex gap-2">
                {result.status === 'success' && result.imageUrl && (
                  <button
                    onClick={() => downloadImage(result.imageUrl!, `ad-creative-${result.format.id}.jpg`)}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-[#1235e2] text-white hover:bg-[#0f2dc4] transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                )}
                {(result.status === 'error' || result.status === 'success') && (
                  <button
                    onClick={() => onRegenerate(result.format)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
                      darkMode
                        ? 'bg-[#1235e2]/10 hover:bg-[#1235e2]/20 text-[#1235e2]'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                  </button>
                )}
              </div>
            </div>
          </V2Card>
        ))}
      </div>
    </div>
  );
}
