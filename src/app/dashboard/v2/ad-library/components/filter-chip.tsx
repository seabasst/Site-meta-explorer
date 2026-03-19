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
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
        darkMode
          ? 'bg-[#1235e2]/20 text-[#1235e2]'
          : 'bg-[#1235e2]/10 text-[#1235e2]'
      }`}
    >
      {label}
      <button onClick={onRemove} className="hover:text-red-400 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
