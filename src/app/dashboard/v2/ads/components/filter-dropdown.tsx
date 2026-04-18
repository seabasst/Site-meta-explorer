'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function FilterDropdown({
  label,
  icon,
  isOpen,
  onToggle,
  onClose,
  hasValue,
  darkMode,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  /** Called when the user clicks outside the dropdown or presses Escape. */
  onClose?: () => void;
  hasValue?: boolean;
  darkMode: boolean;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + Escape to close. The onClose prop was previously accepted
  // but never wired, so dropdowns stayed open until another filter button was
  // clicked. (See scope 2 P1.)
  useEffect(() => {
    if (!isOpen || !onClose) return;
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
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
          role="listbox"
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
