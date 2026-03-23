'use client';

import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import type { GenerationConfig, GenerationSuggestion } from '@/lib/creative-lab-types';
import { SuggestionCard } from './suggestion-card';

// ---------------------------------------------------------------------------
// ConfigScreen
// ---------------------------------------------------------------------------

interface ConfigScreenProps {
  config: GenerationConfig;
  suggestions: GenerationSuggestion[];
  onSuggestionsChange: (suggestions: GenerationSuggestion[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  darkMode: boolean;
}

export function ConfigScreen({
  config,
  suggestions,
  onSuggestionsChange,
  onGenerate,
  isGenerating,
  darkMode,
}: ConfigScreenProps) {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [promptPrefix, setPromptPrefix] = useState('');

  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';
  const mutedBg = darkMode ? 'bg-slate-800/50' : 'bg-slate-50';
  const selectedCount = suggestions.filter((s) => s.selected).length;
  const allSelected = suggestions.length > 0 && selectedCount === suggestions.length;

  // -- Handlers ---------------------------------------------------------------

  function handleToggle(id: string) {
    onSuggestionsChange(
      suggestions.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    );
  }

  function handleEditPrompt(id: string, newPrompt: string) {
    onSuggestionsChange(
      suggestions.map((s) => (s.id === id ? { ...s, imagePrompt: newPrompt } : s))
    );
  }

  function handleToggleAll() {
    const newSelected = !allSelected;
    onSuggestionsChange(suggestions.map((s) => ({ ...s, selected: newSelected })));
  }

  function handleGenerate() {
    // If there is a custom prefix, prepend it to all selected suggestions
    if (promptPrefix.trim()) {
      onSuggestionsChange(
        suggestions.map((s) =>
          s.selected
            ? { ...s, imagePrompt: `${promptPrefix.trim()}, ${s.imagePrompt}` }
            : s
        )
      );
    }
    onGenerate();
  }

  // -- Render -----------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Gap summary banner */}
      <div
        className={`rounded-xl border p-4 flex items-start gap-3 ${
          darkMode ? 'border-[#1235e2]/20 bg-[#1235e2]/5' : 'border-blue-100 bg-blue-50'
        }`}
      >
        <Info className="w-5 h-5 text-[#1235e2] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold mb-1">Gap Analysis Summary</p>
          <p className={`text-sm ${muted} leading-relaxed`}>{config.gapSummary}</p>
        </div>
      </div>

      {/* Brand context bar */}
      {(config.brandContext.colors.length > 0 ||
        config.brandContext.voice ||
        config.brandContext.audience.length > 0) && (
        <div className={`rounded-xl ${mutedBg} p-4`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1235e2] mb-2">
            Brand Context
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {config.brandContext.colors.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${muted}`}>Colors:</span>
                {config.brandContext.colors.map((color) => (
                  <div
                    key={color}
                    className="w-5 h-5 rounded-full border border-slate-300"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
            {config.brandContext.voice && (
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${muted}`}>Voice:</span>
                <span className="text-xs font-medium">
                  {config.brandContext.voice.slice(0, 80)}
                  {config.brandContext.voice.length > 80 ? '...' : ''}
                </span>
              </div>
            )}
            {config.brandContext.audience.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className={`text-xs ${muted}`}>Audience:</span>
                <span className="text-xs font-medium">
                  {config.brandContext.audience.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Select all / Deselect all */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#1235e2]" />
          AI Suggestions ({suggestions.length})
        </h3>
        <button
          onClick={handleToggleAll}
          className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
            darkMode
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Suggestion cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {suggestions.map((suggestion) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            darkMode={darkMode}
            onToggle={handleToggle}
            onEditPrompt={handleEditPrompt}
          />
        ))}
      </div>

      {/* Customize section (collapsed by default) */}
      <div
        className={`rounded-xl border ${
          darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'
        }`}
      >
        <button
          onClick={() => setCustomizeOpen(!customizeOpen)}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
            darkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'
          }`}
        >
          <span>Customize Prompt Prefix</span>
          {customizeOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
        {customizeOpen && (
          <div className="px-4 pb-4">
            <p className={`text-xs ${muted} mb-2`}>
              This text will be prepended to all selected image prompts.
            </p>
            <textarea
              value={promptPrefix}
              onChange={(e) => setPromptPrefix(e.target.value)}
              placeholder="e.g., minimalist flat design, vibrant colors..."
              rows={2}
              className={`w-full text-sm rounded-lg border p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#1235e2]/50 ${
                darkMode
                  ? 'bg-[#101322] border-[#1235e2]/20 text-slate-200 placeholder:text-slate-600'
                  : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400'
              }`}
            />
          </div>
        )}
      </div>

      {/* Generate button */}
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          disabled={selectedCount === 0 || isGenerating}
          className={`px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
            selectedCount === 0 || isGenerating
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-[#1235e2] text-white hover:bg-[#0f2dc4] shadow-lg shadow-[#1235e2]/25'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate {selectedCount} Image{selectedCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
