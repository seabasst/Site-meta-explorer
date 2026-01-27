'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function KiriMediaPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed this session
    const dismissed = sessionStorage.getItem('kiri-popup-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Show popup after 60 seconds
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 60000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem('kiri-popup-dismissed', 'true');
  };

  if (isDismissed || !isVisible) return null;

  return (
    <div className="fixed left-4 bottom-4 z-50 animate-slide-in-left">
      <div className="relative w-80 overflow-hidden rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] shadow-2xl">
        {/* Accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--accent-green)] to-[var(--accent-green-light)]" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative p-5 pt-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/20 text-xs text-[var(--accent-green)] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-green)] animate-pulse" />
            Free until March 1st
          </div>

          <h3 className="font-serif text-xl text-[var(--text-primary)] mb-2">
            Need help growing your <span className="italic text-[var(--accent-green)]">brand</span>?
          </h3>

          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Get expert analysis and tailored strategies from Kiri Media. We help brands scale their Facebook advertising.
          </p>

          <div className="flex flex-col gap-2">
            <a
              href="mailto:sebastian@kirimedia.co"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green-light)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Us
            </a>
            <a
              href="https://kirimedi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] hover:border-[var(--accent-green)] transition-colors"
            >
              Learn More
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
