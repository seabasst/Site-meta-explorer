'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Page number generator
// ---------------------------------------------------------------------------

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | '...')[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push('...');

  pages.push(total);
  return pages;
}

// ---------------------------------------------------------------------------
// Pagination Component
// ---------------------------------------------------------------------------

export function AdPagination({
  page,
  totalPages,
  onPageChange,
  darkMode,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  darkMode: boolean;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
          darkMode
            ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {generatePageNumbers(page, totalPages).map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className={`px-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p as number)}
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
              page === p
                ? 'bg-[#1235e2] text-white shadow-sm'
                : darkMode
                  ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
          darkMode
            ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
