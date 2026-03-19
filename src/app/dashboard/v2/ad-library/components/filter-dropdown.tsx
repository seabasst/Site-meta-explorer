'use client';

import { ChevronDown } from 'lucide-react';

export function FilterDropdown({
  label,
  icon,
  isOpen,
  onToggle,
  onClose: _onClose,
  hasValue,
  darkMode,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose?: () => void;
  hasValue?: boolean;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          isOpen
            ? 'bg-[#1235e2] text-white'
            : hasValue
              ? 'bg-[#1235e2]/20 text-[#1235e2]'
              : darkMode
                ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        {icon}
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div
          className={`absolute top-full left-0 mt-2 min-w-[220px] max-h-64 overflow-y-auto rounded-xl border shadow-xl z-50 p-2 ${
            darkMode
              ? 'bg-[#181b2e] border-[#1235e2]/20'
              : 'bg-white border-slate-200'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
