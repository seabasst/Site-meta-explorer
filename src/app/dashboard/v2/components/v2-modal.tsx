'use client';

import { useEffect, useRef, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible modal primitive for the v2 dashboard.
 *
 * Replaces three hand-rolled copies (AdDetailLightbox, inline login modal in
 * ads/page.tsx, CreatorLightbox) that each implemented some subset of modal
 * behavior and skipped key a11y features. Scope 2 P0.
 *
 * Features:
 *  - role="dialog" + aria-modal="true"
 *  - aria-labelledby tied to the optional `title` (generated id when present)
 *  - Focus trap: Tab / Shift+Tab cycle within the dialog
 *  - Initial focus moves into the dialog on open
 *  - Focus returns to the previously-focused element on close
 *  - Escape key closes (when `onClose` provided)
 *  - Backdrop click closes (can be disabled via `dismissOnBackdrop={false}`)
 *  - Body scroll lock while open
 *  - `prefers-reduced-motion` respected (no transition for motion-sensitive users)
 */
export function V2Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
  dismissOnBackdrop = true,
  darkMode = false,
  labelledBy,
  initialFocusRef,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  /** Visual title. If provided, it's rendered AND used as aria-labelledby. */
  title?: ReactNode;
  /** Additional description text under the title (aria-describedby). */
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  dismissOnBackdrop?: boolean;
  darkMode?: boolean;
  /** Override aria-labelledby when no title is rendered but an external label exists. */
  labelledBy?: string;
  /** Optional ref to focus on open (defaults to first focusable element). */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  /** Optional footer area pinned to the bottom. */
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  // Focus management + keyboard handlers + body scroll lock.
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog.
    const el = dialogRef.current;
    if (el) {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else {
        const first = el.querySelector<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (first) first.focus();
        else el.focus();
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);

    // Scroll lock.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Return focus.
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
    full: 'max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)]',
  }[size];

  const labelId = title ? titleId : labelledBy;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm motion-reduce:backdrop-blur-none"
      onClick={() => dismissOnBackdrop && onClose()}
      aria-hidden={false}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${sizeClass} overflow-hidden rounded-2xl shadow-2xl outline-none ${
          darkMode
            ? 'bg-[#101322] text-slate-100 border border-[#1235e2]/20'
            : 'bg-white text-slate-900 border border-slate-200'
        }`}
      >
        {/* Header is always rendered so the close button is reachable even
            when no title is provided. Title + description block collapses
            gracefully when absent. */}
        <div
          className={`flex items-start justify-between gap-4 px-6 py-4 border-b ${
            darkMode ? 'border-[#1235e2]/15' : 'border-slate-100'
          }`}
        >
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold leading-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="mt-1 text-sm text-current/60">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="shrink-0 p-1.5 rounded-lg hover:bg-current/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1235e2]"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>

        <div className="overflow-auto max-h-[calc(100vh-10rem)]">
          {children}
        </div>

        {footer && (
          <div
            className={`px-6 py-3 border-t ${
              darkMode ? 'border-[#1235e2]/15' : 'border-slate-100'
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
