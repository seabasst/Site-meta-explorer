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
import { DeleteBrandDialog } from '@/components/dashboard/delete-brand-dialog';
import { Menu, Search, Scale } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const { data, loading, refresh } = useTrackedBrands();
  const [modalMode, setModalMode] = useState<'own' | 'competitor' | null>(null);
  const [snapshotLoadingId, setSnapshotLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleDeleteOwnBrand = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/own-brand', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete brand');
      toast.success('Brand deleted');
      await refresh();
    } catch {
      toast.error('Failed to delete brand');
    }
  }, [refresh]);

  const handleBulkDelete = useCallback(async () => {
    setDeleteLoading(true);
    try {
      const ids = Array.from(selectedIds).join(',');
      const res = await fetch(`/api/dashboard/competitors?ids=${ids}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete brands');
      toast.success(`Deleted ${selectedIds.size} brand(s)`);
      setSelectedIds(new Set());
      setSelectMode(false);
      await refresh();
    } catch {
      toast.error('Failed to delete brands');
    } finally {
      setDeleteLoading(false);
      setBulkDeleteOpen(false);
    }
  }, [selectedIds, refresh]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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

  const filteredCompetitors = competitors
    .filter(c => c.pageName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.pageName.localeCompare(b.pageName);
      const dateA = a.snapshots[0]?.snapshotDate || a.createdAt;
      const dateB = b.snapshots[0]?.snapshotDate || b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

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
                onDelete={handleDeleteOwnBrand}
              />

              {/* 2. Competitors Grid */}
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                    Competitors
                    <span className="text-sm font-normal text-[var(--text-muted)] ml-2">
                      ({filteredCompetitors.length}{searchQuery ? ` of ${competitors.length}` : ''})
                    </span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {selectMode && selectedIds.size > 0 && (
                      <button
                        onClick={() => setBulkDeleteOpen(true)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        Delete Selected ({selectedIds.size})
                      </button>
                    )}
                    {competitors.length > 0 && (
                      <button
                        onClick={() => {
                          if (selectMode) {
                            setSelectMode(false);
                            setSelectedIds(new Set());
                          } else {
                            setSelectMode(true);
                          }
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        {selectMode ? 'Cancel' : 'Select'}
                      </button>
                    )}
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
                </div>

                {selectMode && competitors.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => {
                        if (selectedIds.size === filteredCompetitors.length) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(filteredCompetitors.map(c => c.id)));
                        }
                      }}
                      className="text-xs text-[var(--accent-green-light)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {selectedIds.size === filteredCompetitors.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                )}

                {competitors.length > 0 && (
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        placeholder="Search brands..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] rounded-lg pl-9 pr-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)] w-full"
                      />
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setSortBy('date')}
                        className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                          sortBy === 'date'
                            ? 'bg-[var(--accent-green)] text-white'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        Date
                      </button>
                      <button
                        onClick={() => setSortBy('name')}
                        className={`px-3 py-2 text-xs rounded-lg transition-colors ${
                          sortBy === 'name'
                            ? 'bg-[var(--accent-green)] text-white'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        Name
                      </button>
                    </div>
                  </div>
                )}

                {competitors.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                    No competitors tracked yet. Add one to start comparing.
                  </div>
                ) : filteredCompetitors.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                    No brands match your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCompetitors.map(c => (
                      <CompetitorCard
                        key={c.id}
                        competitor={c}
                        ownSnapshot={ownSnapshot}
                        onRemove={() => handleRemoveCompetitor(c.id)}
                        onSnapshot={handleSnapshot}
                        snapshotLoading={snapshotLoadingId === c.id}
                        selectable={selectMode}
                        selected={selectedIds.has(c.id)}
                        onSelect={() => toggleSelect(c.id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Comparison Table */}
              <ComparisonTable ownBrand={ownBrand} competitors={competitors} />

              {/* Compare Brands link - show when 2+ brands have snapshots */}
              {(() => {
                const eligibleCount = [
                  ...(ownBrand ? [ownBrand] : []),
                  ...competitors,
                ].filter((b) => b.snapshots.length > 0).length;
                return eligibleCount >= 2 ? (
                  <div className="flex justify-center">
                    <Link
                      href="/dashboard/compare"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-green)] transition-colors"
                    >
                      <Scale className="w-4 h-4" />
                      Compare Brands
                    </Link>
                  </div>
                ) : null;
              })()}

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

      {/* Bulk delete confirmation */}
      <DeleteBrandDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        brandName=""
        onConfirm={handleBulkDelete}
        loading={deleteLoading}
        count={selectedIds.size}
      />

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
