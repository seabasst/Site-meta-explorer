'use client';

// ---------------------------------------------------------------------------
// Load More Button with progress counter
// ---------------------------------------------------------------------------

interface LoadMoreButtonProps {
  onClick: () => void;
  loading: boolean;
  loadedCount: number;
  totalCount: number;
  darkMode: boolean;
}

export function LoadMoreButton({
  onClick,
  loading,
  loadedCount,
  totalCount,
  darkMode,
}: LoadMoreButtonProps) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        Showing {loadedCount} of {totalCount.toLocaleString()}
      </p>
      <button
        onClick={onClick}
        disabled={loading}
        className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
          darkMode
            ? 'bg-[#1235e2]/15 text-[#1235e2] hover:bg-[#1235e2]/25 border border-[#1235e2]/20'
            : 'bg-[#1235e2]/10 text-[#1235e2] hover:bg-[#1235e2]/15 border border-[#1235e2]/20'
        }`}
      >
        {loading ? 'Loading...' : 'Load more'}
      </button>
    </div>
  );
}
