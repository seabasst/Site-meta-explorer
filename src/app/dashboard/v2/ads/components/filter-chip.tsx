'use client';

import { X } from 'lucide-react';

export function FilterChip({
  label,
  onRemove,
  darkMode,
}: {
  label: string;
  onRemove: () => void;
  darkMode: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-l-2 border-l-[#1235e2] ${
        darkMode
          ? 'bg-[#1235e2]/20 text-[#1235e2]'
          : 'bg-[#1235e2]/10 text-[#1235e2]'
      }`}
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-red-500/20 rounded-full p-0.5 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
