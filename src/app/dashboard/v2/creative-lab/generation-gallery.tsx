'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertTriangle,
  Package,
  Sparkles,
  Target,
  Layers,
  MessageSquare,
  Palette,
} from 'lucide-react';
import JSZip from 'jszip';
import type { GenerationResult } from '@/lib/creative-lab-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PILLAR_ICONS: Record<string, typeof Sparkles> = {
  format: Layers,
  tone: MessageSquare,
  journeyphase: Target,
  visualstyle: Palette,
  messenger: Sparkles,
};

function getPillarIcon(pillar: string) {
  const key = pillar.toLowerCase().replace(/\s+/g, '');
  for (const [k, Icon] of Object.entries(PILLAR_ICONS)) {
    if (key.includes(k)) return Icon;
  }
  return Sparkles;
}

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

// ---------------------------------------------------------------------------
// GenerationGallery
// ---------------------------------------------------------------------------

interface GenerationGalleryProps {
  results: GenerationResult[];
  darkMode: boolean;
  onBack: () => void;
}

export function GenerationGallery({ results, darkMode, onBack }: GenerationGalleryProps) {
  const [zipping, setZipping] = useState(false);

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-100';

  const successCount = results.filter((r) => r.status === 'success').length;
  const loadingCount = results.filter((r) => r.status === 'loading').length;
  const totalCount = results.length;

  // -- Zip download -----------------------------------------------------------

  async function handleDownloadAll() {
    const successful = results.filter((r) => r.status === 'success' && r.imageUrl);
    if (successful.length === 0) return;

    setZipping(true);
    try {
      const zip = new JSZip();

      await Promise.all(
        successful.map(async (r, idx) => {
          const res = await fetch(r.imageUrl!);
          const blob = await res.blob();
          const ext = r.imageUrl!.includes('.png') ? 'png' : 'webp';
          const name = `ad-creative-${r.suggestion.format.toLowerCase().replace(/\s+/g, '-')}-${idx + 1}.${ext}`;
          zip.file(name, blob);
        })
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const objectUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = 'ad-creatives.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('Zip download failed:', err);
    } finally {
      setZipping(false);
    }
  }

  // -- Render -----------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className={`flex items-center gap-1 text-sm mb-2 ${muted} hover:text-[#1235e2] transition-colors`}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Config
          </button>
          <h2 className="text-xl font-black">Generated Creatives</h2>
          <p className={`text-sm ${muted} mt-0.5`}>
            {loadingCount > 0
              ? `${successCount} of ${totalCount} generated...`
              : `${successCount} of ${totalCount} generated`}
          </p>
        </div>

        {successCount >= 1 && (
          <button
            onClick={handleDownloadAll}
            disabled={zipping}
            className="px-4 py-2 rounded-xl bg-[#1235e2] text-white text-sm font-semibold hover:bg-[#0f2dc4] transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {zipping ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating Zip...
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                Download All ({successCount})
              </>
            )}
          </button>
        )}
      </div>

      {/* Gallery grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {results.map((result, idx) => {
          const PillarIcon = getPillarIcon(result.suggestion.pillar);

          return (
            <div
              key={result.suggestion.id || idx}
              className={`rounded-xl border overflow-hidden ${
                darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200'
              }`}
            >
              {/* Image area */}
              <div className="relative group">
                {result.status === 'loading' && (
                  <div
                    className={`w-full flex flex-col items-center justify-center ${mutedBg} animate-pulse`}
                    style={{
                      aspectRatio: result.suggestion.aspectRatio.replace(':', ' / '),
                      maxHeight: '400px',
                    }}
                  >
                    <Loader2 className="w-8 h-8 text-[#1235e2] animate-spin mb-2" />
                    <p className={`text-sm font-medium ${muted}`}>Generating...</p>
                  </div>
                )}

                {result.status === 'idle' && (
                  <div
                    className={`w-full flex flex-col items-center justify-center ${mutedBg}`}
                    style={{
                      aspectRatio: result.suggestion.aspectRatio.replace(':', ' / '),
                      maxHeight: '400px',
                    }}
                  >
                    <p className={`text-sm ${muted}`}>Queued</p>
                  </div>
                )}

                {result.status === 'success' && result.imageUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.imageUrl}
                      alt={`Generated ${result.suggestion.format} creative`}
                      className="w-full"
                      style={{ maxHeight: '400px', objectFit: 'cover' }}
                    />
                    {/* Hover overlay with download */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() =>
                          downloadImage(
                            result.imageUrl!,
                            `ad-creative-${result.suggestion.format.toLowerCase().replace(/\s+/g, '-')}-${idx + 1}.webp`
                          )
                        }
                        className="px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-semibold flex items-center gap-2 shadow-lg hover:bg-slate-100 transition-colors"
                      >
                        <Download className="w-4 h-4" /> Download
                      </button>
                    </div>
                  </>
                )}

                {result.status === 'error' && (
                  <div
                    className={`w-full flex flex-col items-center justify-center ${mutedBg}`}
                    style={{
                      aspectRatio: result.suggestion.aspectRatio.replace(':', ' / '),
                      maxHeight: '400px',
                    }}
                  >
                    <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
                    <p className="text-sm font-medium text-red-400">Generation failed</p>
                    <p className={`text-xs ${muted} mt-0.5 px-4 text-center`}>
                      {result.error || 'Unknown error'}
                    </p>
                  </div>
                )}

                {/* Format badge */}
                {result.status === 'success' && (
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-medium">
                    {result.suggestion.format} &middot; {result.suggestion.aspectRatio}
                  </div>
                )}
              </div>

              {/* Info below image */}
              <div className="p-3">
                <div className="flex items-start gap-2">
                  <PillarIcon className="w-4 h-4 text-[#1235e2] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold capitalize">{result.suggestion.pillar}</p>
                    <p className={`text-xs ${muted} mt-0.5 leading-relaxed line-clamp-2`}>
                      {result.suggestion.reasoning}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
