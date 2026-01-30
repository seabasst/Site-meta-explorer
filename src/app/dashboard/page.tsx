'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { useTrackedBrands } from '@/hooks/use-tracked-brands';
import { OwnBrandCard } from '@/components/dashboard/own-brand-card';
import { CompetitorCard } from '@/components/dashboard/competitor-card';
import { BrandSetupModal } from '@/components/dashboard/brand-setup-modal';
import { ComparisonTable } from '@/components/dashboard/comparison-table';
import { TrendChart } from '@/components/dashboard/trend-chart';
import { DemographicsComparison } from '@/components/dashboard/demographics-comparison';
import { SignInButton } from '@/components/auth/sign-in-button';
import { UserMenu } from '@/components/auth/user-menu';
import { SubscriptionStatus } from '@/components/subscription/subscription-status';
import { Menu } from 'lucide-react';

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const { data, loading, refresh } = useTrackedBrands();
  const [modalMode, setModalMode] = useState<'own' | 'competitor' | null>(null);
  const [snapshotLoadingId, setSnapshotLoadingId] = useState<string | null>(null);

  const handleSetOwnBrand = useCallback(async (brandData: { facebookPageId: string; pageName: string; adLibraryUrl: string }) => {
    const res = await fetch('/api/dashboard/own-brand', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brandData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to set brand');
    }
    toast.success('Brand set successfully');
    await refresh();
  }, [refresh]);

  const handleAddCompetitor = useCallback(async (brandData: { facebookPageId: string; pageName: string; adLibraryUrl: string }) => {
    const res = await fetch('/api/dashboard/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brandData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add competitor');
    }
    toast.success('Competitor added');
    await refresh();
  }, [refresh]);

  const handleRemoveCompetitor = useCallback(async (id: string) => {
    await fetch(`/api/dashboard/competitors?id=${id}`, { method: 'DELETE' });
    toast.success('Competitor removed');
    await refresh();
  }, [refresh]);

  const handleSnapshot = useCallback(async (brandId: string) => {
    setSnapshotLoadingId(brandId);
    try {
      const res = await fetch('/api/dashboard/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedBrandId: brandId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create snapshot');
      }
      toast.success('Snapshot created');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Snapshot failed');
    } finally {
      setSnapshotLoadingId(null);
    }
  }, [refresh]);

  // Not authenticated
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--border-medium)] border-t-[var(--accent-green-light)] animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen">
        <DashboardNav session={null} authStatus="unauthenticated" />
        <div className="max-w-7xl mx-auto px-6 py-24 text-center">
          <h1 className="font-serif text-4xl text-[var(--text-primary)] mb-4">Competitive Intelligence Dashboard</h1>
          <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
            Sign in to track your brand, monitor competitors, and access historical trend data.
          </p>
          <SignInButton provider="email" />
        </div>
      </div>
    );
  }

  const ownBrand = data?.ownBrand ?? null;
  const competitors = data?.competitors ?? [];
  const trendSnapshots = data?.trendSnapshots ?? [];
  const ownSnapshot = ownBrand?.snapshots[0] ?? null;

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <div className="min-h-screen">
        <DashboardNav session={session} authStatus={authStatus} />

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl text-[var(--text-primary)] mb-1">Dashboard</h1>
            <p className="text-sm text-[var(--text-muted)]">Track your brand and compare against competitors</p>
          </div>

          {loading ? (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass rounded-2xl p-6 animate-pulse">
                  <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded mb-4" />
                  <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(j => (
                      <div key={j} className="h-16 bg-[var(--bg-tertiary)] rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* 1. Own Brand */}
              <OwnBrandCard
                brand={ownBrand}
                onSetBrand={() => setModalMode('own')}
                onSnapshot={handleSnapshot}
                snapshotLoading={snapshotLoadingId === ownBrand?.id}
              />

              {/* 2. Competitors Grid */}
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Competitors
                    <span className="text-sm font-normal text-[var(--text-muted)] ml-2">
                      ({competitors.length})
                    </span>
                  </h3>
                  <button
                    onClick={() => setModalMode('competitor')}
                    className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Competitor
                  </button>
                </div>

                {competitors.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                    No competitors tracked yet. Add one to start comparing.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {competitors.map(c => (
                      <CompetitorCard
                        key={c.id}
                        competitor={c}
                        ownSnapshot={ownSnapshot}
                        onRemove={() => handleRemoveCompetitor(c.id)}
                        onSnapshot={handleSnapshot}
                        snapshotLoading={snapshotLoadingId === c.id}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Comparison Table */}
              <ComparisonTable ownBrand={ownBrand} competitors={competitors} />

              {/* 4. Trend Charts */}
              <TrendChart
                ownBrand={ownBrand}
                competitors={competitors}
                trendSnapshots={trendSnapshots}
              />

              {/* 5. Demographics Comparison */}
              <DemographicsComparison
                ownBrand={ownBrand}
                competitors={competitors}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <BrandSetupModal
        mode={modalMode === 'own' ? 'own' : 'competitor'}
        open={modalMode !== null}
        onClose={() => setModalMode(null)}
        onSubmit={modalMode === 'own' ? handleSetOwnBrand : handleAddCompetitor}
      />
    </>
  );
}

// Dashboard navigation (matching the main page nav)
function DashboardNav({ session, authStatus }: { session: unknown; authStatus: string }) {
  return (
    <nav className="border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <a href="/" className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
          Ad Analyser
        </a>

        <div className="hidden md:flex items-center gap-1">
          <a href="/" className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]">
            Analyse
          </a>
          <a href="/dashboard" className="px-3 py-2 text-sm text-[var(--accent-green-light)] font-medium transition-colors rounded-lg bg-[var(--bg-tertiary)]">
            Dashboard
          </a>
          <a href="/about" className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]">
            About us
          </a>
          <a href="/contact" className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]">
            Contact us
          </a>
          <a href="/feedback" className="px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors rounded-lg hover:bg-[var(--bg-tertiary)]">
            Feedback
          </a>
        </div>

        <div className="flex items-center gap-3">
          {authStatus === 'loading' ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] animate-pulse" />
              <div className="w-20 h-4 rounded bg-[var(--bg-tertiary)] animate-pulse" />
            </div>
          ) : session ? (
            <div className="flex items-center gap-4">
              <SubscriptionStatus />
              <UserMenu />
            </div>
          ) : (
            <SignInButton provider="email" />
          )}

          <button
            type="button"
            className="md:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => {
              const menu = document.getElementById('dash-mobile-nav');
              menu?.classList.toggle('hidden');
            }}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div id="dash-mobile-nav" className="hidden md:hidden border-t border-[var(--border-subtle)] px-6 py-3 space-y-1">
        <a href="/" className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]">
          Analyse
        </a>
        <a href="/dashboard" className="block px-3 py-2 text-sm text-[var(--accent-green-light)] font-medium rounded-lg bg-[var(--bg-tertiary)]">
          Dashboard
        </a>
        <a href="/about" className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]">
          About us
        </a>
        <a href="/contact" className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]">
          Contact us
        </a>
        <a href="/feedback" className="block px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]">
          Feedback
        </a>
      </div>
    </nav>
  );
}
