'use client';

import { useState } from 'react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { V2Card } from '../v2-shell';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

export interface AdFormat {
  id: string;
  label: string;
  size: string;
  aspectRatio: string;
  description: string;
}

export const AD_FORMATS: AdFormat[] = [
  { id: 'square', label: 'Square', size: '1080x1080', aspectRatio: '1:1', description: 'Feed post, Instagram' },
  { id: 'story', label: 'Story / Reel', size: '1080x1920', aspectRatio: '9:16', description: 'Stories, Reels, TikTok' },
  { id: 'landscape', label: 'Landscape', size: '1200x628', aspectRatio: '16:9', description: 'Facebook feed link ad' },
  { id: 'portrait', label: 'Portrait', size: '1080x1350', aspectRatio: '4:5', description: 'Instagram feed, Facebook' },
  { id: 'wide-banner', label: 'Wide Banner', size: '1920x800', aspectRatio: '21:9', description: 'Display banner' },
  { id: 'pinterest', label: 'Pinterest Pin', size: '1000x1500', aspectRatio: '2:3', description: 'Pinterest' },
];

interface Recommendation {
  pillar: string;
  gap: string;
  suggestion: string;
  briefTitle: string;
  briefDescription: string;
  imagePrompt: string;
  priority: 'high' | 'medium' | 'low';
}

interface FormatSelectorProps {
  recommendation: Recommendation;
  darkMode: boolean;
  onGenerate: (formats: AdFormat[], prompt: string) => void;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FormatSelector({ recommendation, darkMode, onGenerate, onBack }: FormatSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['square']));
  const [prompt, setPrompt] = useState(recommendation.imagePrompt);

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  const toggleFormat = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === AD_FORMATS.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(AD_FORMATS.map((f) => f.id)));
    }
  };

  const selectedFormats = AD_FORMATS.filter((f) => selectedIds.has(f.id));

  return (
    <div>
      {/* Back button */}
      <button
        onClick={onBack}
        className={`flex items-center gap-1 text-sm mb-6 ${muted} hover:text-[#1235e2] transition-colors`}
      >
        <ArrowLeft className="w-4 h-4" /> Back to results
      </button>

      {/* Recommendation summary */}
      <V2Card className="p-5 mb-6">
        <h3 className="font-bold text-sm mb-1">{recommendation.briefTitle}</h3>
        <p className={`text-sm ${muted}`}>{recommendation.suggestion}</p>
      </V2Card>

      {/* Editable prompt */}
      <div className="mb-6">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#1235e2] mb-2 block">
          Image Prompt (editable)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className={`w-full px-4 py-3 rounded-xl border text-sm leading-relaxed resize-none ${
            darkMode
              ? 'bg-slate-800/50 border-[#1235e2]/20 text-white placeholder:text-slate-500'
              : 'bg-slate-50 border-slate-200 placeholder:text-slate-400'
          }`}
        />
      </div>

      {/* Format grid header */}
      <div className="flex items-center justify-between mb-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-[#1235e2]">
          Select Ad Formats
        </label>
        <button
          onClick={toggleAll}
          className={`text-xs font-medium ${muted} hover:text-[#1235e2] transition-colors`}
        >
          {selectedIds.size === AD_FORMATS.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Format grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {AD_FORMATS.map((format) => {
          const isSelected = selectedIds.has(format.id);
          return (
            <button
              key={format.id}
              onClick={() => toggleFormat(format.id)}
              className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-[#1235e2] bg-[#1235e2]/5'
                  : darkMode
                    ? 'border-slate-700 hover:border-slate-600 bg-slate-800/30'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              {/* Checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#1235e2] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}

              <p className="font-semibold text-sm">{format.label}</p>
              <p className={`text-xs ${muted} mt-0.5`}>
                {format.size} &middot; {format.aspectRatio}
              </p>
              <p className={`text-xs ${muted} mt-0.5`}>{format.description}</p>
            </button>
          );
        })}
      </div>

      {/* Generate button */}
      <button
        onClick={() => onGenerate(selectedFormats, prompt)}
        disabled={selectedFormats.length === 0 || !prompt.trim()}
        className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors ${
          selectedFormats.length > 0 && prompt.trim()
            ? 'bg-[#1235e2] text-white hover:bg-[#0f2dc4]'
            : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        Generate {selectedFormats.length} Image{selectedFormats.length !== 1 ? 's' : ''}
      </button>
    </div>
  );
}
