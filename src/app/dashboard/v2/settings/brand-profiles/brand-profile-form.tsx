'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Loader2, X, Plus, ChevronDown, ChevronRight, Sparkles, Search } from 'lucide-react';
import type { BrandProfileFull, BrandCompetitorWithBrand } from '@/lib/brand-profile-types';
import { CompetitorSearch } from './competitor-search';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = ['Basics', 'Voice & Positioning', 'Audience', 'Competitors'] as const;
type Tab = (typeof TABS)[number];

const DEMOGRAPHIC_OPTIONS = [
  'Gen Z 18-24',
  'Millennials 25-40',
  'Gen X 41-55',
  'Boomers 56+',
  'High Income',
  'Middle Income',
  'Urban Dwellers',
  'Suburban Families',
  'Students',
  'Professionals',
];

const INTEREST_OPTIONS = [
  'Tech Early Adopters',
  'Sustainable Living',
  'Luxury Travel',
  'Remote Work',
  'Fitness & Wellness',
  'Fashion & Style',
  'Food & Cooking',
  'Gaming',
  'Outdoor Adventure',
  'Home & Interior',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChipInput({
  label,
  values,
  onChange,
  placeholder,
  darkMode,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  darkMode: boolean;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!values.includes(trimmed)) {
        onChange([...values, trimmed]);
      }
      setInputValue('');
    }
    if (e.key === 'Backspace' && !inputValue && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
        {label}
      </label>
      <div className={`flex flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 min-h-[42px] transition-colors focus-within:ring-2 focus-within:ring-[#1235e2]/40 ${
        darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
      }`}>
        {values.map((v) => (
          <span
            key={v}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
              darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-[#1235e2]/10 text-[#1235e2]'
            }`}
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== v))}
              className="hover:text-red-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={values.length === 0 ? placeholder : ''}
          className={`flex-1 min-w-[120px] text-sm bg-transparent focus:outline-none py-0.5 ${
            darkMode
              ? 'text-slate-200 placeholder:text-slate-500'
              : 'text-slate-900 placeholder:text-slate-400'
          }`}
        />
      </div>
      <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
        Press Enter to add
      </p>
    </div>
  );
}

function TogglePillGroup({
  label,
  options,
  selected,
  onChange,
  darkMode,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  darkMode: boolean;
}) {
  const [customInput, setCustomInput] = useState('');

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
      setCustomInput('');
    }
  };

  return (
    <div>
      <label className={`block text-sm font-medium mb-3 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selected.includes(opt)
                ? 'bg-[#1235e2] text-white'
                : darkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {opt}
          </button>
        ))}
        {/* Show custom values not in options */}
        {selected
          .filter((s) => !options.includes(s))
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium bg-[#1235e2] text-white transition-colors"
            >
              {s}
              <X className="w-3 h-3 inline ml-1.5" />
            </button>
          ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Add custom..."
          className={`flex-1 max-w-xs px-3 py-1.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
            darkMode
              ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
              : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
          }`}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className={`p-1.5 rounded-lg transition-colors ${
            customInput.trim()
              ? 'text-[#1235e2] hover:bg-[#1235e2]/10'
              : darkMode ? 'text-slate-600' : 'text-slate-300'
          }`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
  darkMode,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  darkMode: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className={`text-sm font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        {label}
      </label>
      <div className="flex items-center gap-3">
        <label
          className="w-10 h-10 rounded-lg border cursor-pointer overflow-hidden shrink-0"
          style={{ backgroundColor: value || '#000000' }}
        >
          <input
            type="color"
            value={value && value.length === 7 ? value : '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 w-0 h-0"
          />
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v) || v === '#' || v === '') {
              onChange(v);
            }
          }}
          className={`w-24 px-2 py-1.5 rounded-lg border text-sm font-mono ${
            darkMode
              ? 'bg-slate-800 border-slate-700 text-slate-200'
              : 'bg-white border-slate-300 text-slate-900'
          }`}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(date).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Auto-Enrich Section
// ---------------------------------------------------------------------------

interface SourceBrand {
  id: string;
  pageName: string;
  profilePicUrl: string | null;
}

function AutoEnrichSection({
  profile,
  onUpdate,
  darkMode,
}: {
  profile: BrandProfileFull;
  onUpdate: (profile: BrandProfileFull) => void;
  darkMode: boolean;
}) {
  const [enriching, setEnriching] = useState(false);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [sourceBrand, setSourceBrand] = useState<SourceBrand | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SourceBrand[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced brand search
  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/ad-library/brands?search=${encodeURIComponent(q.trim())}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.brands || []);
          setShowDropdown(true);
        }
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
  }, []);

  const selectBrand = (brand: SourceBrand) => {
    setSourceBrand(brand);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleEnrich = async () => {
    if (!sourceBrand) {
      toast.error('Search and select your brand first');
      return;
    }
    setEnriching(true);
    try {
      const res = await fetch(`/api/brand-profiles/${profile.id}/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePageId: sourceBrand.id,
          forceOverwrite,
        }),
      });

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Daily enrichment budget exceeded. Try again tomorrow.');
        return;
      }

      if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Not enough ad data for enrichment');
        return;
      }

      if (!res.ok) {
        toast.error('Enrichment failed');
        return;
      }

      const data = await res.json();

      if (data.skipped) {
        toast.info('No new ad data since last enrichment');
        return;
      }

      if (data.enriched && data.profile) {
        onUpdate(data.profile);
        const fieldLabels: Record<string, string> = {
          brandVoice: 'brand voice',
          positioning: 'positioning',
          missionStatement: 'mission statement',
          demographics: 'demographics',
          interests: 'interests',
          painPoints: 'pain points',
        };
        const updated = (data.fieldsUpdated || [])
          .map((f: string) => fieldLabels[f] || f)
          .join(', ');
        toast.success(updated ? `Updated: ${updated}` : 'Enrichment complete');
      }
    } catch {
      toast.error('Enrichment failed');
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className={`rounded-lg border px-4 py-4 mb-6 ${
      darkMode
        ? 'border-[#1235e2]/20 bg-[#1235e2]/5'
        : 'border-[#1235e2]/15 bg-[#1235e2]/[0.03]'
    }`}>
      <div className="flex-1 min-w-0">
        <h3 className={`text-sm font-semibold mb-2 flex items-center gap-1.5 ${
          darkMode ? 'text-slate-200' : 'text-slate-800'
        }`}>
          <Sparkles className="w-4 h-4 text-[#1235e2]" />
          Auto-Enrich from Ad Data
        </h3>
        <p className={`text-xs mb-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Find your brand in the ad library to auto-populate profile fields from your ad data.
        </p>

        {/* Source brand search + selected display */}
        <div className="flex items-center gap-3 flex-wrap">
          {sourceBrand ? (
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              darkMode
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-white border-slate-300 text-slate-900'
            }`}>
              {sourceBrand.profilePicUrl && (
                <img src={sourceBrand.profilePicUrl} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span>{sourceBrand.pageName}</span>
              <button
                onClick={() => setSourceBrand(null)}
                className={`ml-1 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 min-w-[240px] transition-colors focus-within:ring-2 focus-within:ring-[#1235e2]/40 ${
                darkMode
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-white border-slate-300'
              }`}>
                <Search className={`w-4 h-4 flex-shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="Search your brand..."
                  disabled={enriching}
                  className={`text-sm bg-transparent border-none outline-none flex-1 ${
                    darkMode ? 'text-slate-200 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                  }`}
                />
                {searching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className={`absolute z-50 mt-1 w-full rounded-lg border shadow-lg max-h-[200px] overflow-y-auto ${
                  darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                }`}>
                  {searchResults.map((brand) => (
                    <button
                      key={brand.id}
                      onClick={() => selectBrand(brand)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        darkMode
                          ? 'hover:bg-slate-700 text-slate-200'
                          : 'hover:bg-slate-50 text-slate-900'
                      }`}
                    >
                      {brand.profilePicUrl && (
                        <img src={brand.profilePicUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                      )}
                      <span className="truncate">{brand.pageName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleEnrich}
            disabled={enriching || !sourceBrand}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              enriching || !sourceBrand
                ? 'bg-[#1235e2]/50 cursor-not-allowed'
                : 'bg-[#1235e2] hover:bg-[#0e2bc4]'
            }`}
          >
            {enriching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Auto-Enrich
              </>
            )}
          </button>
        </div>

        {/* Force overwrite toggle */}
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={forceOverwrite}
            onChange={(e) => setForceOverwrite(e.target.checked)}
            disabled={enriching}
            className="w-3.5 h-3.5 rounded border-slate-400 text-[#1235e2] focus:ring-[#1235e2]/40"
          />
          <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Overwrite existing fields
          </span>
          <span className={`text-xs ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            (By default, only empty fields are populated)
          </span>
        </label>
      </div>

      {/* Last enriched timestamp */}
      {profile.enrichedAt && (
        <p className={`text-xs mt-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          Last enriched: {relativeTime(profile.enrichedAt)}
          {profile.enrichmentSource ? ` via ${profile.enrichmentSource}` : ''}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Form Component
// ---------------------------------------------------------------------------

interface BrandProfileFormProps {
  profile: BrandProfileFull;
  onUpdate: (profile: BrandProfileFull) => void;
  darkMode: boolean;
}

export function BrandProfileForm({ profile, onUpdate, darkMode }: BrandProfileFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Basics');
  const [saving, setSaving] = useState(false);
  const [visualExpanded, setVisualExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Local form state
  const [name, setName] = useState(profile.name);
  const [missionStatement, setMissionStatement] = useState(profile.missionStatement || '');
  const [painPoints, setPainPoints] = useState<string[]>(profile.painPoints || []);
  const [brandVoice, setBrandVoice] = useState(profile.brandVoice || '');
  const [positioning, setPositioning] = useState(profile.positioning || '');
  const [demographics, setDemographics] = useState<string[]>(profile.demographics || []);
  const [interests, setInterests] = useState<string[]>(profile.interests || []);
  const [primaryColor, setPrimaryColor] = useState(profile.primaryColor || '');
  const [secondaryColor, setSecondaryColor] = useState(profile.secondaryColor || '');
  const [accentColor, setAccentColor] = useState(profile.accentColor || '');
  const [competitors, setCompetitors] = useState<BrandCompetitorWithBrand[]>(profile.competitors || []);

  // Reset form when profile changes
  useEffect(() => {
    setName(profile.name);
    setMissionStatement(profile.missionStatement || '');
    setPainPoints(profile.painPoints || []);
    setBrandVoice(profile.brandVoice || '');
    setPositioning(profile.positioning || '');
    setDemographics(profile.demographics || []);
    setInterests(profile.interests || []);
    setPrimaryColor(profile.primaryColor || '');
    setSecondaryColor(profile.secondaryColor || '');
    setAccentColor(profile.accentColor || '');
    setCompetitors(profile.competitors || []);
  }, [profile]);

  // Auto-save with debounce
  const saveField = useCallback(
    (updates: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const res = await fetch(`/api/brand-profiles/${profile.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Save failed');
          }
          const data = await res.json();
          onUpdate(data.profile);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to save');
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [profile.id, onUpdate]
  );

  const handleCompetitorLinked = (competitor: BrandCompetitorWithBrand) => {
    setCompetitors((prev) => [...prev, competitor]);
  };

  const handleCompetitorUnlinked = (competitorId: string) => {
    setCompetitors((prev) => prev.filter((c) => c.id !== competitorId));
  };

  return (
    <div>
      {/* Auto-Enrich section */}
      <AutoEnrichSection profile={profile} onUpdate={onUpdate} darkMode={darkMode} />

      {/* Tab bar */}
      <div className={`flex gap-0 border-b mb-6 ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'}`}>
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === tab
                ? 'text-[#1235e2]'
                : darkMode
                  ? 'text-slate-400 hover:text-slate-300'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1235e2] rounded-t" />
            )}
          </button>
        ))}
        {saving && (
          <div className="ml-auto flex items-center gap-1.5 px-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1235e2]" />
            <span className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Saving...</span>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === 'Basics' && (
          <>
            {/* Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Profile Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (name.trim() && name !== profile.name) {
                    saveField({ name: name.trim() });
                  }
                }}
                placeholder="e.g. My DTC Brand"
                className={`w-full max-w-md px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>

            {/* Mission Statement */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Mission Statement
              </label>
              <textarea
                value={missionStatement}
                onChange={(e) => setMissionStatement(e.target.value)}
                onBlur={() => {
                  if (missionStatement !== (profile.missionStatement || '')) {
                    saveField({ missionStatement: missionStatement || null });
                  }
                }}
                rows={3}
                maxLength={1000}
                placeholder="What is your brand's mission or purpose?"
                className={`w-full rounded-lg border px-4 py-3 text-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <p className={`text-xs mt-1 text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {missionStatement.length}/1000
              </p>
            </div>

            {/* Pain Points */}
            <ChipInput
              label="Pain Points"
              values={painPoints}
              onChange={(vals) => {
                setPainPoints(vals);
                saveField({ painPoints: vals });
              }}
              placeholder="Type a pain point and press Enter..."
              darkMode={darkMode}
            />

            {/* Visual Identity (collapsible) */}
            <div>
              <button
                type="button"
                onClick={() => setVisualExpanded(!visualExpanded)}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  darkMode ? 'text-slate-300 hover:text-slate-200' : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {visualExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                Visual Identity
              </button>
              {visualExpanded && (
                <div className="mt-4 space-y-4 pl-6">
                  {profile.logoUrl && (
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Logo
                      </label>
                      <div className={`w-20 h-20 rounded-xl border overflow-hidden ${
                        darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
                      }`}>
                        <img src={profile.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-6">
                    <ColorInput
                      label="Primary"
                      value={primaryColor}
                      onChange={(v) => {
                        setPrimaryColor(v);
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) saveField({ primaryColor: v });
                      }}
                      darkMode={darkMode}
                    />
                    <ColorInput
                      label="Secondary"
                      value={secondaryColor}
                      onChange={(v) => {
                        setSecondaryColor(v);
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) saveField({ secondaryColor: v });
                      }}
                      darkMode={darkMode}
                    />
                    <ColorInput
                      label="Accent"
                      value={accentColor}
                      onChange={(v) => {
                        setAccentColor(v);
                        if (/^#[0-9a-fA-F]{6}$/.test(v)) saveField({ accentColor: v });
                      }}
                      darkMode={darkMode}
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'Voice & Positioning' && (
          <>
            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Brand Voice & Personality
              </label>
              <textarea
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                onBlur={() => {
                  if (brandVoice !== (profile.brandVoice || '')) {
                    saveField({ brandVoice: brandVoice || null });
                  }
                }}
                rows={5}
                maxLength={2000}
                placeholder="Describe your brand's tone of voice, personality traits, and communication style..."
                className={`w-full rounded-lg border px-4 py-3 text-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <p className={`text-xs mt-1 text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {brandVoice.length}/2000
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Positioning
              </label>
              <textarea
                value={positioning}
                onChange={(e) => setPositioning(e.target.value)}
                onBlur={() => {
                  if (positioning !== (profile.positioning || '')) {
                    saveField({ positioning: positioning || null });
                  }
                }}
                rows={4}
                maxLength={2000}
                placeholder="How does your brand position itself in the market? What makes it unique?"
                className={`w-full rounded-lg border px-4 py-3 text-sm resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-[#1235e2]/40 ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <p className={`text-xs mt-1 text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {positioning.length}/2000
              </p>
            </div>
          </>
        )}

        {activeTab === 'Audience' && (
          <>
            <TogglePillGroup
              label="Demographics"
              options={DEMOGRAPHIC_OPTIONS}
              selected={demographics}
              onChange={(vals) => {
                setDemographics(vals);
                saveField({ demographics: vals });
              }}
              darkMode={darkMode}
            />
            <TogglePillGroup
              label="Interests"
              options={INTEREST_OPTIONS}
              selected={interests}
              onChange={(vals) => {
                setInterests(vals);
                saveField({ interests: vals });
              }}
              darkMode={darkMode}
            />
          </>
        )}

        {activeTab === 'Competitors' && (
          <CompetitorSearch
            profileId={profile.id}
            competitors={competitors}
            onCompetitorLinked={handleCompetitorLinked}
            onCompetitorUnlinked={handleCompetitorUnlinked}
            darkMode={darkMode}
          />
        )}
      </div>
    </div>
  );
}
