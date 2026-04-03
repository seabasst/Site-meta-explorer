'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { BrandCompetitorWithBrand } from '@/lib/brand-profile-types';

interface CompetitorSearchProps {
  profileId: string;
  competitors: BrandCompetitorWithBrand[];
  onCompetitorLinked: (competitor: BrandCompetitorWithBrand) => void;
  onCompetitorUnlinked: (competitorId: string) => void;
  darkMode: boolean;
}

interface BrandResult {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  category: string | null;
}

const MAX_COMPETITORS = 10;

export function CompetitorSearch({
  profileId,
  competitors,
  onCompetitorLinked,
  onCompetitorUnlinked,
  darkMode,
}: CompetitorSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BrandResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const linkedBrandIds = new Set(competitors.map((c) => c.adLibraryBrandId));
  const atLimit = competitors.length >= MAX_COMPETITORS;

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

  const searchBrands = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/ad-library/brands?search=${encodeURIComponent(searchQuery)}&limit=10`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.brands || []);
      setShowDropdown(true);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchInput = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchBrands(value), 300);
  };

  const handleLink = async (brand: BrandResult) => {
    if (atLimit) {
      toast.error(`Maximum ${MAX_COMPETITORS} competitors allowed`);
      return;
    }
    if (linkedBrandIds.has(brand.id)) {
      toast.error('This brand is already linked');
      return;
    }
    setLinking(brand.id);
    try {
      const res = await fetch(`/api/brand-profiles/${profileId}/competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adLibraryBrandId: brand.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to link competitor');
      }
      const data = await res.json();
      onCompetitorLinked(data.competitor);
      toast.success(`Linked ${brand.pageName}`);
      setQuery('');
      setShowDropdown(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to link competitor');
    } finally {
      setLinking(null);
    }
  };

  const handleUnlink = async (competitor: BrandCompetitorWithBrand) => {
    setUnlinking(competitor.id);
    try {
      const res = await fetch(`/api/brand-profiles/${profileId}/competitors`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitorId: competitor.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to unlink competitor');
      }
      onCompetitorUnlinked(competitor.id);
      toast.success(`Unlinked ${competitor.adLibraryBrand.pageName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to unlink competitor');
    } finally {
      setUnlinking(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div ref={dropdownRef} className="relative">
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-[#1235e2]/40 ${
          darkMode
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-slate-300'
        } ${atLimit ? 'opacity-50 pointer-events-none' : ''}`}>
          {searching ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#1235e2] shrink-0" />
          ) : (
            <Search className={`w-4 h-4 shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder={atLimit ? 'Maximum competitors reached' : 'Search brands to add as competitor...'}
            disabled={atLimit}
            className={`flex-1 text-sm bg-transparent focus:outline-none ${
              darkMode
                ? 'text-slate-200 placeholder:text-slate-500'
                : 'text-slate-900 placeholder:text-slate-400'
            }`}
          />
        </div>

        {/* Dropdown results */}
        {showDropdown && results.length > 0 && (
          <div className={`absolute z-20 top-full mt-1 w-full rounded-lg border shadow-lg max-h-60 overflow-y-auto ${
            darkMode ? 'bg-[#181b2e] border-[#1235e2]/20' : 'bg-white border-slate-200'
          }`}>
            {results.map((brand) => {
              const isLinked = linkedBrandIds.has(brand.id);
              return (
                <button
                  key={brand.id}
                  type="button"
                  disabled={isLinked || linking === brand.id}
                  onClick={() => handleLink(brand)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    isLinked
                      ? 'opacity-40 cursor-not-allowed'
                      : darkMode
                        ? 'hover:bg-[#1235e2]/10'
                        : 'hover:bg-slate-50'
                  }`}
                >
                  {brand.profilePicUrl ? (
                    <img src={brand.profilePicUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {brand.pageName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                      {brand.pageName}
                    </p>
                    <p className={`text-xs truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {brand.pageId}{brand.category ? ` - ${brand.category}` : ''}
                    </p>
                  </div>
                  {linking === brand.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#1235e2] shrink-0" />
                  ) : isLinked ? (
                    <span className={`text-xs ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>Linked</span>
                  ) : (
                    <Plus className="w-4 h-4 text-[#1235e2] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {showDropdown && query.length >= 2 && results.length === 0 && !searching && (
          <div className={`absolute z-20 top-full mt-1 w-full rounded-lg border shadow-lg px-4 py-3 ${
            darkMode ? 'bg-[#181b2e] border-[#1235e2]/20' : 'bg-white border-slate-200'
          }`}>
            <p className={`text-sm ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              No brands found for "{query}"
            </p>
          </div>
        )}
      </div>

      {/* Linked competitors */}
      {competitors.length > 0 ? (
        <div className="space-y-2">
          <p className={`text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {competitors.length}/{MAX_COMPETITORS} competitors linked
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {competitors.map((comp) => (
              <div
                key={comp.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                  darkMode ? 'border-[#1235e2]/10 bg-[#1235e2]/5' : 'border-slate-200 bg-slate-50'
                }`}
              >
                {comp.adLibraryBrand.profilePicUrl ? (
                  <img src={comp.adLibraryBrand.profilePicUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    darkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {comp.adLibraryBrand.pageName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${darkMode ? 'text-slate-200' : 'text-slate-900'}`}>
                    {comp.adLibraryBrand.pageName}
                  </p>
                  <p className={`text-xs truncate ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {comp.adLibraryBrand.pageId}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnlink(comp)}
                  disabled={unlinking === comp.id}
                  className={`p-1 rounded-md transition-colors ${
                    unlinking === comp.id
                      ? 'opacity-50'
                      : darkMode
                        ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'
                        : 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                >
                  {unlinking === comp.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={`flex items-center gap-2 py-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          <AlertCircle className="w-4 h-4" />
          <p className="text-sm">No competitors linked yet. Search above to add some.</p>
        </div>
      )}
    </div>
  );
}
