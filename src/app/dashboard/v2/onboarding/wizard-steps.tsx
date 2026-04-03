'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2, Plus, Globe } from 'lucide-react';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface WizardData {
  name: string;
  websiteUrl: string;
  brandVoice: string;
  positioning: string;
  demographics: string;
  interests: string;
  painPoints: string;
  competitors: CompetitorEntry[];
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
}

export interface CompetitorEntry {
  adLibraryBrandId: string;
  pageName: string;
  profilePicUrl?: string | null;
}

interface StepProps {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
  darkMode: boolean;
}

// ---------------------------------------------------------------------------
// Shared styling helpers
// ---------------------------------------------------------------------------

function inputClass(darkMode: boolean) {
  return `w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
    darkMode
      ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
  }`;
}

function labelClass(darkMode: boolean) {
  return `block text-sm font-medium mb-1.5 ${
    darkMode ? 'text-slate-300' : 'text-slate-700'
  }`;
}

function helperClass(darkMode: boolean) {
  return `text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`;
}

// ---------------------------------------------------------------------------
// Step 1: Brand Basics
// ---------------------------------------------------------------------------

export function StepBasics({ data, onChange, darkMode }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass(darkMode)}>
          Brand name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={data.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Acme Co"
          className={inputClass(darkMode)}
          autoFocus
        />
      </div>
      <div>
        <label className={labelClass(darkMode)}>Website URL</label>
        <input
          type="url"
          value={data.websiteUrl}
          onChange={(e) => onChange({ websiteUrl: e.target.value })}
          placeholder="https://example.com"
          className={inputClass(darkMode)}
        />
        <p className={helperClass(darkMode)}>Optional. Helps AI understand your brand context.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Voice & Tone
// ---------------------------------------------------------------------------

export function StepVoice({ data, onChange, darkMode }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass(darkMode)}>Brand voice</label>
        <textarea
          value={data.brandVoice}
          onChange={(e) => onChange({ brandVoice: e.target.value })}
          placeholder="Describe your brand's tone -- e.g., professional yet approachable, bold and playful"
          rows={4}
          className={inputClass(darkMode) + ' resize-none'}
        />
        <p className={helperClass(darkMode)}>
          How should your brand sound in ads and communications?
        </p>
      </div>
      <div>
        <label className={labelClass(darkMode)}>Positioning</label>
        <textarea
          value={data.positioning}
          onChange={(e) => onChange({ positioning: e.target.value })}
          placeholder="e.g. The most affordable premium skincare for young professionals"
          rows={3}
          className={inputClass(darkMode) + ' resize-none'}
        />
        <p className={helperClass(darkMode)}>
          What makes your brand unique in the market?
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Target Audience
// ---------------------------------------------------------------------------

export function StepAudience({ data, onChange, darkMode }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass(darkMode)}>Demographics</label>
        <input
          type="text"
          value={data.demographics}
          onChange={(e) => onChange({ demographics: e.target.value })}
          placeholder="e.g. Women 25-45, urban professionals, household income $80K+"
          className={inputClass(darkMode)}
        />
        <p className={helperClass(darkMode)}>
          Comma-separated. Who is your primary audience?
        </p>
      </div>
      <div>
        <label className={labelClass(darkMode)}>Interests</label>
        <input
          type="text"
          value={data.interests}
          onChange={(e) => onChange({ interests: e.target.value })}
          placeholder="e.g. Fitness, sustainable living, travel, self-care"
          className={inputClass(darkMode)}
        />
        <p className={helperClass(darkMode)}>
          Comma-separated. What are your audience's key interests?
        </p>
      </div>
      <div>
        <label className={labelClass(darkMode)}>Pain points</label>
        <input
          type="text"
          value={data.painPoints}
          onChange={(e) => onChange({ painPoints: e.target.value })}
          placeholder="e.g. Too little time, overwhelmed by choices, skeptical of claims"
          className={inputClass(darkMode)}
        />
        <p className={helperClass(darkMode)}>
          Comma-separated. What problems does your audience face?
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Competitors
// ---------------------------------------------------------------------------

interface BrandResult {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  category: string | null;
}

export function StepCompetitors({ data, onChange, darkMode }: StepProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BrandResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const linkedIds = new Set(data.competitors.map((c) => c.adLibraryBrandId));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchBrands = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/ad-library/brands?search=${encodeURIComponent(q)}&limit=10`
      );
      if (res.ok) {
        const d = await res.json();
        setResults(d.brands || []);
        setShowDropdown(true);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleSearchInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchBrands(value), 300);
  }

  function handleAdd(brand: BrandResult) {
    if (linkedIds.has(brand.id)) return;
    onChange({
      competitors: [
        ...data.competitors,
        {
          adLibraryBrandId: brand.id,
          pageName: brand.pageName,
          profilePicUrl: brand.profilePicUrl,
        },
      ],
    });
    setQuery('');
    setShowDropdown(false);
  }

  function handleRemove(brandId: string) {
    onChange({
      competitors: data.competitors.filter((c) => c.adLibraryBrandId !== brandId),
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass(darkMode)}>Search competitors</label>
        <div ref={dropdownRef} className="relative">
          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-[#1235e2]/40 ${
              darkMode
                ? 'bg-slate-800 border-slate-700'
                : 'bg-white border-slate-300'
            }`}
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#1235e2] shrink-0" />
            ) : (
              <Search
                className={`w-4 h-4 shrink-0 ${
                  darkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search brands to add as competitor..."
              className={`flex-1 text-sm bg-transparent focus:outline-none ${
                darkMode
                  ? 'text-slate-200 placeholder:text-slate-500'
                  : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>

          {showDropdown && results.length > 0 && (
            <div
              className={`absolute z-20 top-full mt-1 w-full rounded-lg border shadow-lg max-h-60 overflow-y-auto ${
                darkMode
                  ? 'bg-[#181b2e] border-[#1235e2]/20'
                  : 'bg-white border-slate-200'
              }`}
            >
              {results.map((brand) => {
                const isLinked = linkedIds.has(brand.id);
                return (
                  <button
                    key={brand.id}
                    type="button"
                    disabled={isLinked}
                    onClick={() => handleAdd(brand)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isLinked
                        ? 'opacity-40 cursor-not-allowed'
                        : darkMode
                          ? 'hover:bg-[#1235e2]/10'
                          : 'hover:bg-slate-50'
                    }`}
                  >
                    {brand.profilePicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.profilePicUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          darkMode ? 'bg-slate-700' : 'bg-slate-100'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-[#1235e2]" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          darkMode ? 'text-slate-200' : 'text-slate-900'
                        }`}
                      >
                        {brand.pageName}
                      </p>
                      {brand.category && (
                        <p
                          className={`text-xs truncate ${
                            darkMode ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          {brand.category}
                        </p>
                      )}
                    </div>
                    {isLinked ? (
                      <span
                        className={`text-xs ${
                          darkMode ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        Added
                      </span>
                    ) : (
                      <Plus className="w-4 h-4 text-[#1235e2] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {showDropdown && query.length >= 2 && results.length === 0 && !searching && (
            <div
              className={`absolute z-20 top-full mt-1 w-full rounded-lg border shadow-lg px-4 py-3 ${
                darkMode
                  ? 'bg-[#181b2e] border-[#1235e2]/20'
                  : 'bg-white border-slate-200'
              }`}
            >
              <p
                className={`text-sm ${
                  darkMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                No brands found for &ldquo;{query}&rdquo;
              </p>
            </div>
          )}
        </div>
        <p className={helperClass(darkMode)}>
          Add brands you compete with. This helps the AI compare and benchmark.
        </p>
      </div>

      {/* Selected competitors */}
      {data.competitors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.competitors.map((comp) => (
            <div
              key={comp.adLibraryBrandId}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                darkMode
                  ? 'border-[#1235e2]/15 bg-[#1235e2]/5 text-slate-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              {comp.profilePicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comp.profilePicUrl}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
              ) : (
                <Globe className="w-4 h-4 text-[#1235e2]" />
              )}
              <span className="truncate max-w-[150px]">{comp.pageName}</span>
              <button
                type="button"
                onClick={() => handleRemove(comp.adLibraryBrandId)}
                className={`p-0.5 rounded transition-colors ${
                  darkMode
                    ? 'text-slate-500 hover:text-red-400'
                    : 'text-slate-400 hover:text-red-500'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Visual Identity
// ---------------------------------------------------------------------------

function ColorInput({
  label,
  value,
  onChange,
  darkMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  darkMode: boolean;
}) {
  return (
    <div>
      <label className={labelClass(darkMode)}>{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className={inputClass(darkMode) + ' flex-1 font-mono'}
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function StepVisual({ data, onChange, darkMode }: StepProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ColorInput
          label="Primary color"
          value={data.primaryColor}
          onChange={(v) => onChange({ primaryColor: v })}
          darkMode={darkMode}
        />
        <ColorInput
          label="Secondary color"
          value={data.secondaryColor}
          onChange={(v) => onChange({ secondaryColor: v })}
          darkMode={darkMode}
        />
        <ColorInput
          label="Accent color"
          value={data.accentColor}
          onChange={(v) => onChange({ accentColor: v })}
          darkMode={darkMode}
        />
      </div>
      <div>
        <label className={labelClass(darkMode)}>Logo URL</label>
        <input
          type="url"
          value={data.logoUrl}
          onChange={(e) => onChange({ logoUrl: e.target.value })}
          placeholder="https://example.com/logo.png"
          className={inputClass(darkMode)}
        />
        <p className={helperClass(darkMode)}>
          Direct link to your logo image. Used for visual reference in AI generation.
        </p>
      </div>
    </div>
  );
}
