'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { useV2 } from '@/app/dashboard/v2/v2-context';

interface DashboardFiltersProps {
  categories: string[];
  formats: string[];
  loading?: boolean;
}

export function DashboardFilters({
  categories,
  formats,
  loading,
}: DashboardFiltersProps) {
  const { darkMode } = useV2();
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`?${params.toString()}`);
    },
    [searchParams, router]
  );

  const clearAllFilters = useCallback(() => {
    router.replace('?');
  }, [router]);

  const currentFormat = searchParams.get('displayFormat') || '';
  const currentCategory = searchParams.get('category') || '';
  const currentStartDate = searchParams.get('startDate') || '';
  const currentEndDate = searchParams.get('endDate') || '';
  const currentIsActive = searchParams.get('isActive') || '';

  const hasFilters =
    currentFormat ||
    currentCategory ||
    currentStartDate ||
    currentEndDate ||
    currentIsActive;

  const selectBase = `px-3 py-2 rounded-lg text-sm font-medium border transition-colors appearance-none cursor-pointer ${
    darkMode
      ? 'bg-[#1235e2]/5 border-[#1235e2]/20 text-slate-200 focus:border-[#1235e2]/50'
      : 'bg-white border-slate-200 text-slate-700 focus:border-[#1235e2]/50'
  }`;

  const dateBase = `px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
    darkMode
      ? 'bg-[#1235e2]/5 border-[#1235e2]/20 text-slate-200 focus:border-[#1235e2]/50 [color-scheme:dark]'
      : 'bg-white border-slate-200 text-slate-700 focus:border-[#1235e2]/50'
  }`;

  const activeSegmentBase = `px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer`;

  const getSegmentClass = (value: string) => {
    const isSelected = currentIsActive === value;
    if (isSelected) {
      return `${activeSegmentBase} bg-[#1235e2] text-white`;
    }
    return `${activeSegmentBase} ${
      darkMode
        ? 'text-slate-400 hover:text-slate-200'
        : 'text-slate-500 hover:text-slate-700'
    }`;
  };

  if (loading) {
    return (
      <div
        className={`rounded-xl border p-4 mb-8 animate-pulse ${
          darkMode
            ? 'bg-[#1235e2]/5 border-[#1235e2]/10'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-9 w-32 rounded-lg ${
                darkMode ? 'bg-slate-800' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-4 mb-8 ${
        darkMode
          ? 'bg-[#1235e2]/5 border-[#1235e2]/10'
          : 'bg-slate-50 border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* Format filter */}
        <select
          value={currentFormat}
          onChange={(e) =>
            updateFilter('displayFormat', e.target.value || null)
          }
          className={selectBase}
        >
          <option value="">All Formats</option>
          {formats.map((f) => (
            <option key={f} value={f}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={currentCategory}
          onChange={(e) => updateFilter('category', e.target.value || null)}
          className={selectBase}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={currentStartDate}
            onChange={(e) => updateFilter('startDate', e.target.value || null)}
            className={dateBase}
            placeholder="From"
          />
          <span
            className={`text-xs ${
              darkMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            to
          </span>
          <input
            type="date"
            value={currentEndDate}
            onChange={(e) => updateFilter('endDate', e.target.value || null)}
            className={dateBase}
            placeholder="To"
          />
        </div>

        {/* Active status segmented toggle */}
        <div
          className={`flex items-center rounded-lg border p-1 ${
            darkMode
              ? 'bg-[#1235e2]/5 border-[#1235e2]/20'
              : 'bg-white border-slate-200'
          }`}
        >
          <button
            onClick={() => updateFilter('isActive', null)}
            className={getSegmentClass('')}
          >
            All
          </button>
          <button
            onClick={() => updateFilter('isActive', 'true')}
            className={getSegmentClass('true')}
          >
            Active
          </button>
          <button
            onClick={() => updateFilter('isActive', 'false')}
            className={getSegmentClass('false')}
          >
            Inactive
          </button>
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearAllFilters}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              darkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-[#1235e2]/10'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
