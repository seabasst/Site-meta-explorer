'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Sparkles } from 'lucide-react';

const DISMISS_KEY = 'onboarding-prompt-dismissed';

export function OnboardingPrompt({ darkMode }: { darkMode: boolean }) {
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Already dismissed via localStorage
    if (localStorage.getItem(DISMISS_KEY)) {
      setChecked(true);
      return;
    }

    // Check if user has any brand profiles
    fetch('/api/brand-profiles')
      .then((r) => r.json())
      .then((data) => {
        if (!data.profiles || data.profiles.length === 0) {
          setVisible(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked || !visible) return null;

  return (
    <div
      className={`rounded-xl border p-4 mb-6 flex items-center gap-3 ${
        darkMode
          ? 'bg-[#1235e2]/5 border-[#1235e2]/20'
          : 'bg-blue-50/80 border-blue-100'
      }`}
    >
      <Sparkles className="w-5 h-5 text-[#1235e2] shrink-0" />
      <div className="flex-1 text-sm">
        Set up your brand profile to get personalized AI insights.{' '}
        <Link
          href="/dashboard/v2/onboarding"
          className="text-[#1235e2] font-medium hover:underline"
        >
          Get started
        </Link>
      </div>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setVisible(false);
        }}
        className={`p-1.5 rounded-lg transition-colors ${
          darkMode
            ? 'hover:bg-slate-800 text-slate-400'
            : 'hover:bg-slate-200 text-slate-400'
        }`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
