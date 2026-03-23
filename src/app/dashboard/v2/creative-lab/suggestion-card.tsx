'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  Layers,
  MessageSquare,
  Palette,
} from 'lucide-react';
import type { GenerationSuggestion } from '@/lib/creative-lab-types';

// ---------------------------------------------------------------------------
// Pillar icon mapping
// ---------------------------------------------------------------------------

const PILLAR_ICONS: Record<string, typeof Sparkles> = {
  format: Layers,
  tone: MessageSquare,
  journeyPhase: Target,
  visualStyle: Palette,
  messenger: Sparkles,
};

function getPillarIcon(pillar: string) {
  const key = pillar.toLowerCase().replace(/\s+/g, '');
  for (const [k, Icon] of Object.entries(PILLAR_ICONS)) {
    if (key.includes(k.toLowerCase())) return Icon;
  }
  return Sparkles;
}

// ---------------------------------------------------------------------------
// Priority badge colors
// ---------------------------------------------------------------------------

function priorityClasses(priority: 'high' | 'medium' | 'low', darkMode: boolean) {
  switch (priority) {
    case 'high':
      return 'bg-[#1235e2]/15 text-[#1235e2]';
    case 'medium':
      return darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600';
    case 'low':
      return darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500';
  }
}

// ---------------------------------------------------------------------------
// SuggestionCard
// ---------------------------------------------------------------------------

interface SuggestionCardProps {
  suggestion: GenerationSuggestion;
  darkMode: boolean;
  onToggle: (id: string) => void;
  onEditPrompt: (id: string, newPrompt: string) => void;
}

export function SuggestionCard({ suggestion, darkMode, onToggle, onEditPrompt }: SuggestionCardProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const cardBg = darkMode ? 'bg-[#1235e2]/5 border-[#1235e2]/10' : 'bg-white border-slate-200';
  const PillarIcon = getPillarIcon(suggestion.pillar);

  return (
    <div
      className={`rounded-xl border p-4 transition-all ${cardBg} ${
        !suggestion.selected ? 'opacity-50' : ''
      }`}
    >
      {/* Top row: priority + format + toggle */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${priorityClasses(
              suggestion.priority,
              darkMode
            )}`}
          >
            {suggestion.priority}
          </span>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              darkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {suggestion.format} {suggestion.aspectRatio}
          </span>
        </div>

        {/* Toggle checkbox */}
        <button
          onClick={() => onToggle(suggestion.id)}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
            suggestion.selected
              ? 'bg-[#1235e2] border-[#1235e2] text-white'
              : darkMode
                ? 'border-slate-600 text-transparent'
                : 'border-slate-300 text-transparent'
          }`}
          aria-label={suggestion.selected ? 'Deselect suggestion' : 'Select suggestion'}
        >
          {suggestion.selected && (
            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      {/* Pillar + reasoning */}
      <div className="flex items-start gap-2 mb-3">
        <PillarIcon className="w-4 h-4 text-[#1235e2] mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold capitalize">{suggestion.pillar}</p>
          <p className={`text-xs ${muted} mt-0.5 leading-relaxed`}>{suggestion.reasoning}</p>
        </div>
      </div>

      {/* Expandable prompt editor */}
      <div>
        <button
          onClick={() => setPromptExpanded(!promptExpanded)}
          className={`flex items-center gap-1 text-xs font-medium ${muted} hover:text-[#1235e2] transition-colors w-full text-left`}
        >
          {promptExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">
            {promptExpanded ? 'Collapse prompt' : suggestion.imagePrompt.split('\n')[0].slice(0, 60) + '...'}
          </span>
        </button>

        {promptExpanded && (
          <textarea
            value={suggestion.imagePrompt}
            onChange={(e) => onEditPrompt(suggestion.id, e.target.value)}
            rows={4}
            className={`mt-2 w-full text-xs rounded-lg border p-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#1235e2]/50 ${
              darkMode
                ? 'bg-[#101322] border-[#1235e2]/20 text-slate-200'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          />
        )}
      </div>
    </div>
  );
}
