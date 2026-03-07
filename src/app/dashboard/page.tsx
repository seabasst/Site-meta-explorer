'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRight, BarChart3, Database, TrendingUp, Users, Zap } from 'lucide-react';
import { SignInButton } from '@/components/auth/sign-in-button';
import { UserMenu } from '@/components/auth/user-menu';

export default function DashboardPage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--border-medium)] border-t-[var(--accent-green-light)] animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />
      <div className="min-h-screen">
        {/* Navigation */}
        <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <a href="/" className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              Ad Analyser
            </a>
            <div className="hidden md:flex items-center gap-1">
              <a href="/" className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors">
                Analyse
              </a>
              <a href="/dashboard" className="px-3 py-2 text-sm text-[var(--accent-green-light)] font-medium rounded-lg bg-[var(--bg-tertiary)]">
                Dashboard
              </a>
            </div>
            <div className="flex items-center gap-3">
              {session ? <UserMenu /> : <SignInButton provider="email" />}
            </div>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto px-6 py-24 text-center">
          {/* Hero */}
          <div className="inline-flex items-center gap-2 bg-[#1235e2]/10 text-[#1235e2] px-4 py-1.5 rounded-full text-sm font-medium mb-8">
            <Zap className="w-4 h-4" />
            Pro Dashboard — Early Access
          </div>

          <h1 className="font-serif text-4xl md:text-5xl text-[var(--text-primary)] mb-4 leading-tight">
            Try our Pro Dashboard now!
          </h1>
          <p className="text-lg text-[var(--text-muted)] mb-4 max-w-xl mx-auto">
            Full ad database, historical trends, competitor tracking, benchmarking reports, and media downloads — all in one place.
          </p>
          <p className="text-sm text-[var(--text-secondary)] mb-10">
            Free during early access.{' '}
            <span className="text-[#1235e2] font-semibold">Soon $59/month.</span>
          </p>

          <Link
            href="/dashboard/v2"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#1235e2] text-white rounded-xl text-base font-semibold hover:bg-[#0f2dc5] transition-colors shadow-lg shadow-[#1235e2]/25"
          >
            Open Pro Dashboard <ArrowRight className="w-5 h-5" />
          </Link>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
            {[
              { icon: Database, label: 'Full Ad Database' },
              { icon: TrendingUp, label: 'Historical Trends' },
              { icon: Users, label: 'Competitor Tracking' },
              { icon: BarChart3, label: 'Benchmarking' },
            ].map(f => (
              <div key={f.label} className="glass rounded-xl p-5 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#1235e2]/10 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-[#1235e2]" />
                </div>
                <span className="text-sm text-[var(--text-secondary)] font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
