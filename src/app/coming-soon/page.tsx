'use client';

import { useState } from 'react';
import { toast } from 'sonner';

const FEATURES = [
  {
    title: 'Track Your Own Brand',
    description:
      'Set your brand as the baseline. See how your ad strategy stacks up over time with automated snapshots and trend tracking.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    title: 'Competitor Monitoring',
    description:
      'Add up to 10 competitors and get automatic weekly snapshots. Know the moment a competitor changes strategy.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  {
    title: 'Side-by-Side Comparison',
    description:
      'Compare your ads directly against competitors. See differences in audience targeting, creative formats, copy style, and reach.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    title: 'Actionable Tips',
    description:
      'Get personalised recommendations based on what your competitors are doing differently. Know exactly what to test next.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: 'Historical Trend Data',
    description:
      'Track how brands evolve their ad strategy over weeks and months. Spot seasonal patterns and strategic shifts before anyone else.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    title: 'Dashboard & Reports',
    description:
      'A dedicated dashboard with all your tracked brands, snapshots, and insights in one place. Export reports to share with your team.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
];

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }

      setIsSubmitted(true);
      toast.success('You\'re on the list!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <main className="min-h-screen">
        {/* Nav */}
        <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              Ad Analyser
            </a>
            <a
              href="/"
              className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]"
            >
              Back to Analyser
            </a>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-6 py-16">
          {/* Hero */}
          <header className="text-center mb-16 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/30 text-xs text-[var(--accent-green-light)] mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-green)] animate-pulse-subtle" />
              Launching March 2025
            </div>
            <h1 className="font-serif text-4xl md:text-5xl text-[var(--text-primary)] mb-5 tracking-tight">
              Ad Analyser <span className="text-[var(--accent-green-light)] italic">Pro</span>
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
              Everything in the free analyser, plus a personal dashboard to track your brand,
              monitor competitors, and get actionable insights to improve your ads.
            </p>
          </header>

          {/* Sign-up form */}
          <div className="glass rounded-2xl p-8 mb-16 max-w-lg mx-auto glow-gold animate-fade-in-up stagger-1">
            {isSubmitted ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--accent-green)]/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--accent-green-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                  You&apos;re on the list
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  We&apos;ll send you an invite when Pro launches. Keep using the{' '}
                  <a href="/" className="text-[var(--accent-green-light)] hover:underline">free analyser</a>{' '}
                  in the meantime.
                </p>
              </div>
            ) : (
              <>
                <h2 className="font-serif text-xl text-[var(--text-primary)] mb-2 text-center">
                  Get early access
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-6 text-center">
                  Sign up to be the first to know when Pro launches. Invite only.
                </p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name (optional)"
                    className="input-field w-full"
                    disabled={isSubmitting}
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="input-field w-full"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !email.trim()}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Signing up...
                      </>
                    ) : (
                      'Notify me when it launches'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Features grid */}
          <div className="mb-16">
            <h2 className="font-serif text-2xl text-[var(--text-primary)] text-center mb-10">
              What&apos;s coming in <span className="text-[var(--accent-green-light)] italic">Pro</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="glass rounded-xl p-5 hover:border-[var(--border-default)] transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent-green)]/10 flex items-center justify-center text-[var(--accent-green-light)]">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What stays free */}
          <div className="glass rounded-2xl p-8 mb-16 text-center">
            <h2 className="font-serif text-xl text-[var(--text-primary)] mb-3">
              The analyser stays <span className="text-[var(--accent-green-light)] italic">free</span>
            </h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-lg mx-auto leading-relaxed">
              You can keep analysing any brand&apos;s Facebook ads for free, forever.
              Demographics, ad copy analysis, media breakdowns, expert analysis &mdash; all included.
              Pro adds the tracking, monitoring, and comparison layer on top.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-default)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Try the free analyser
            </a>
          </div>

          {/* Footer */}
          <footer className="pt-8 border-t border-[var(--border-subtle)] text-center">
            <p className="text-xs text-[var(--text-muted)]">
              Built for competitive research. Data sourced from Facebook Ad Library API.
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
