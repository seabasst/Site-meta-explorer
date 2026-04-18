'use client';

import {
  Search,
  Layers,
  Users,
  Calendar,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Grid3x3,
  LayoutGrid,
} from 'lucide-react';
import { useState } from 'react';
import { V2Card } from '../../v2-shell';
import { formatNumber } from '../../v2-shell';
import { SortField, SORT_OPTIONS, GridDensity, FilterOption, DaysRange, TopBrand } from '../types';
import { FilterDropdown } from './filter-dropdown';
import { FilterChip } from './filter-chip';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FilterBarProps {
  darkMode: boolean;
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Status
  statusFilter: 'active' | 'all';
  onStatusChange: (status: 'active' | 'all') => void;
  // Sort
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  onSortByChange: (field: SortField) => void;
  onSortOrderToggle: () => void;
  // Filters
  categoryFilter: string;
  onCategoryChange: (cat: string) => void;
  categories: FilterOption[];
  selectedFormats: Set<string>;
  onToggleFormat: (fmt: string) => void;
  formatOptions: FilterOption[];
  daysActiveFilter: DaysRange | null;
  onDaysActiveChange: (range: DaysRange | null) => void;
  daysRanges: DaysRange[];
  brandFilter: string;
  onBrandChange: (brand: string) => void;
  topBrands: TopBrand[];
  hideCarousel: boolean;
  onHideCarouselToggle: () => void;
  // Partnership
  partnershipFilter: 'all' | 'partnership' | 'non-partnership';
  onPartnershipChange: (filter: 'all' | 'partnership' | 'non-partnership') => void;
  // Grid density
  gridDensity: GridDensity;
  onGridDensityChange: (density: GridDensity) => void;
  // Result count
  resultCount: number | null;
  // Clear
  activeFilterCount: number;
  onClearAll: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterBar(props: FilterBarProps) {
  const {
    darkMode,
    searchQuery, onSearchChange,
    statusFilter, onStatusChange,
    sortBy, sortOrder, onSortByChange, onSortOrderToggle,
    categoryFilter, onCategoryChange, categories,
    selectedFormats, onToggleFormat, formatOptions,
    daysActiveFilter, onDaysActiveChange, daysRanges,
    brandFilter, onBrandChange, topBrands,
    hideCarousel, onHideCarouselToggle,
    partnershipFilter, onPartnershipChange,
    gridDensity, onGridDensityChange,
    resultCount,
    activeFilterCount, onClearAll,
  } = props;

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Reach';

  return (
    <V2Card className="p-4 mb-8 sticky top-0 z-30 shadow-md">
      {/* Row 1: Search + Status + Sort + Density + Result count */}
      <div className="flex flex-wrap gap-3 items-center mb-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full border-none rounded-lg pl-10 pr-4 h-10 text-sm focus:outline-none focus:ring-1 focus:ring-[#1235e2] ${
              darkMode ? 'bg-[#101322] text-white placeholder:text-slate-500' : 'bg-slate-50 text-slate-900 placeholder:text-slate-400'
            }`}
            placeholder="Search ads by brand, text, or keyword..."
          />
        </div>

        {/* Active / All toggle */}
        <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
          {(['active', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(s)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                statusFilter === s
                  ? darkMode ? 'bg-[#1235e2] text-white shadow-sm font-semibold' : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                  : darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {s === 'active' ? 'Active' : 'All'}
            </button>
          ))}
        </div>

        {/* Sort dropdown + order toggle */}
        <div className="flex items-center gap-1">
          <FilterDropdown
            label={currentSortLabel}
            icon={<ArrowUpDown className="w-3.5 h-3.5" />}
            isOpen={openDropdown === 'sort'}
            onToggle={() => setOpenDropdown(openDropdown === 'sort' ? null : 'sort')}
            onClose={() => setOpenDropdown(null)}
            hasValue={sortBy !== 'reachEstimate'}
            darkMode={darkMode}
          >
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onSortByChange(opt.value); setOpenDropdown(null); }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  sortBy === opt.value ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </FilterDropdown>
          <button
            onClick={onSortOrderToggle}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              darkMode ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
          >
            {sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Grid density toggle */}
        <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
          <button
            onClick={() => onGridDensityChange('standard')}
            className={`p-1.5 rounded-md transition-colors ${
              gridDensity === 'standard'
                ? darkMode ? 'bg-[#1235e2] text-white shadow-sm' : 'bg-white text-[#1235e2] shadow-sm'
                : darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
            title="Standard grid"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onGridDensityChange('compact')}
            className={`p-1.5 rounded-md transition-colors ${
              gridDensity === 'compact'
                ? darkMode ? 'bg-[#1235e2] text-white shadow-sm' : 'bg-white text-[#1235e2] shadow-sm'
                : darkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
            title="Compact grid"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Result count */}
        <div className={`text-sm font-medium ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
          {resultCount !== null ? formatNumber(resultCount) : '...'} results
        </div>
      </div>

      {/* Row 2: Filter dropdowns + Partnership + Hide Carousel */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Industry/Category Filter */}
        <FilterDropdown
          label="Industry"
          icon={<Tag className="w-3.5 h-3.5" />}
          isOpen={openDropdown === 'category'}
          onToggle={() => setOpenDropdown(openDropdown === 'category' ? null : 'category')}
          onClose={() => setOpenDropdown(null)}
          hasValue={!!categoryFilter}
          darkMode={darkMode}
        >
          <button
            onClick={() => { onCategoryChange(''); setOpenDropdown(null); }}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              !categoryFilter ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Industries
          </button>
          {categories.map(c => (
            <button
              key={c.value}
              onClick={() => { onCategoryChange(c.value); setOpenDropdown(null); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex justify-between ${
                categoryFilter === c.value ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="capitalize">{c.value}</span>
              <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>{c.count}</span>
            </button>
          ))}
        </FilterDropdown>

        {/* Format Filter (multi-select) */}
        <FilterDropdown
          label="Format"
          icon={<Layers className="w-3.5 h-3.5" />}
          isOpen={openDropdown === 'format'}
          onToggle={() => setOpenDropdown(openDropdown === 'format' ? null : 'format')}
          onClose={() => setOpenDropdown(null)}
          hasValue={selectedFormats.size > 0}
          darkMode={darkMode}
        >
          {formatOptions.map(f => (
            <button
              key={f.value}
              onClick={() => onToggleFormat(f.value)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                selectedFormats.has(f.value)
                  ? 'bg-[#1235e2] border-[#1235e2] text-white'
                  : darkMode ? 'border-slate-600' : 'border-slate-300'
              }`}>
                {selectedFormats.has(f.value) && '\u2713'}
              </div>
              <span className="capitalize flex-1">{f.value}</span>
              <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>{formatNumber(f.count)}</span>
            </button>
          ))}
        </FilterDropdown>

        {/* Days Active Filter */}
        <FilterDropdown
          label="Days Active"
          icon={<Calendar className="w-3.5 h-3.5" />}
          isOpen={openDropdown === 'days'}
          onToggle={() => setOpenDropdown(openDropdown === 'days' ? null : 'days')}
          onClose={() => setOpenDropdown(null)}
          hasValue={!!daysActiveFilter}
          darkMode={darkMode}
        >
          <button
            onClick={() => { onDaysActiveChange(null); setOpenDropdown(null); }}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              !daysActiveFilter ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Any Duration
          </button>
          {daysRanges.map(r => (
            <button
              key={r.label}
              onClick={() => { onDaysActiveChange(r); setOpenDropdown(null); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                daysActiveFilter?.label === r.label ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </FilterDropdown>

        {/* Brand Filter */}
        <FilterDropdown
          label={brandFilter ? topBrands.find(b => b.pageId === brandFilter)?.pageName || 'Brand' : 'Brand'}
          icon={<Users className="w-3.5 h-3.5" />}
          isOpen={openDropdown === 'brand'}
          onToggle={() => setOpenDropdown(openDropdown === 'brand' ? null : 'brand')}
          onClose={() => setOpenDropdown(null)}
          hasValue={!!brandFilter}
          darkMode={darkMode}
        >
          <button
            onClick={() => { onBrandChange(''); setOpenDropdown(null); }}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              !brandFilter ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            All Brands
          </button>
          {topBrands.map((brand, i) => (
            <button
              key={brand.id || brand.pageId}
              onClick={() => { onBrandChange(brand.pageId); setOpenDropdown(null); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                brandFilter === brand.pageId ? 'text-[#1235e2] font-medium' : darkMode ? 'text-slate-300 hover:bg-[#1235e2]/10' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-[#1235e2]/10 text-[#1235e2]'
              }`}>
                {i + 1}
              </span>
              <span className="flex-1 truncate">{brand.pageName}</span>
              <span className={`text-[11px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {formatNumber(brand.activeAdCount)}
              </span>
            </button>
          ))}
        </FilterDropdown>

        {/* Partnership filter (3-state segmented control) */}
        <div className={`p-1 rounded-lg flex ${darkMode ? 'bg-[#1235e2]/10' : 'bg-slate-100'}`}>
          {([
            { value: 'all' as const, label: 'All' },
            { value: 'partnership' as const, label: 'Partnership' },
            { value: 'non-partnership' as const, label: 'Non-partner' },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onPartnershipChange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                partnershipFilter === opt.value
                  ? darkMode ? 'bg-[#1235e2] text-white shadow-sm font-semibold' : 'bg-white text-[#1235e2] shadow-sm font-semibold'
                  : darkMode ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {opt.value === 'partnership' && <Users className="w-3 h-3" />}
              {opt.label}
            </button>
          ))}
        </div>

        {/* Hide Carousel toggle */}
        <button
          onClick={onHideCarouselToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            hideCarousel
              ? 'bg-[#1235e2]/20 text-[#1235e2]'
              : darkMode
                ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          {hideCarousel ? 'Carousel hidden' : 'Show all formats'}
        </button>
      </div>

      {/* Row 3: Active filter chips (conditional) */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 items-center mt-3 pt-3 border-t border-current/10">
          {brandFilter && (
            <FilterChip label={`Brand: ${topBrands.find(b => b.pageId === brandFilter)?.pageName || brandFilter}`} onRemove={() => onBrandChange('')} darkMode={darkMode} />
          )}
          {categoryFilter && (
            <FilterChip label={`Industry: ${categoryFilter}`} onRemove={() => onCategoryChange('')} darkMode={darkMode} />
          )}
          {selectedFormats.size > 0 && (
            <FilterChip label={`Format: ${Array.from(selectedFormats).join(', ')}`} onRemove={() => onToggleFormat('')} darkMode={darkMode} />
          )}
          {daysActiveFilter && (
            <FilterChip label={daysActiveFilter.label} onRemove={() => onDaysActiveChange(null)} darkMode={darkMode} />
          )}
          {partnershipFilter !== 'all' && (
            <FilterChip
              label={partnershipFilter === 'partnership' ? 'Partnership ads' : 'Non-partnership ads'}
              onRemove={() => onPartnershipChange('all')}
              darkMode={darkMode}
            />
          )}
          {sortBy !== 'reachEstimate' && (
            <FilterChip
              label={`Sort: ${SORT_OPTIONS.find(o => o.value === sortBy)?.label}`}
              onRemove={() => onSortByChange('reachEstimate')}
              darkMode={darkMode}
            />
          )}
          <button
            onClick={onClearAll}
            className="text-xs text-[#1235e2] hover:underline font-medium"
          >
            Clear all
          </button>
        </div>
      )}
    </V2Card>
  );
}
