'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Plus, Globe, Lightbulb, ArrowLeft, Filter } from 'lucide-react';
import Link from 'next/link';
import { RequestCard } from '@/components/roadmap/request-card';
import { SubmitModal } from '@/components/roadmap/submit-modal';

interface RoadmapRequest {
  id: string;
  type: 'brand' | 'feature';
  title: string;
  description: string | null;
  pageUrl: string | null;
  status: string;
  upvoteCount: number;
  userEmail: string;
  createdAt: string;
  hasUpvoted: boolean;
  isOwner: boolean;
}

type TypeFilter = 'all' | 'brand' | 'feature';
type StatusFilter = 'all' | 'pending' | 'planned' | 'in_progress' | 'completed';

// Admin emails - should match the API
const ADMIN_EMAILS = ['demo@example.com', 'sebastian@kirimediagroup.com'];

export default function RoadmapPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<RoadmapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showModal, setShowModal] = useState(false);

  const isAdmin = !!(session?.user?.email && ADMIN_EMAILS.includes(session.user.email));

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/roadmap?${params.toString()}`);
      const data = await res.json();
      setRequests(data.requests || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleUpvote = async (id: string) => {
    if (!session) {
      signIn();
      return;
    }

    try {
      const res = await fetch(`/api/roadmap/${id}/upvote`, {
        method: 'POST',
      });
      const data = await res.json();

      // Update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, hasUpvoted: data.upvoted, upvoteCount: data.upvoteCount }
            : r
        )
      );
    } catch (error) {
      console.error('Error upvoting:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      const res = await fetch(`/api/roadmap/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleSubmit = async (data: {
    type: 'brand' | 'feature';
    title: string;
    description?: string;
    pageUrl?: string;
  }) => {
    const res = await fetch('/api/roadmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to submit request');
    }

    const result = await res.json();
    setRequests((prev) => [result.request, ...prev]);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/roadmap/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
        );
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  // Filter counts
  const brandCount = requests.filter((r) => r.type === 'brand').length;
  const featureCount = requests.filter((r) => r.type === 'feature').length;

  return (
    <>
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <main className="min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
                Roadmap
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Vote on features and request brands to track
              </p>
            </div>
            {session ? (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-green)] text-white font-medium rounded-lg hover:bg-[var(--accent-green-dark)] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Submit Request
              </button>
            ) : (
              <button
                onClick={() => signIn()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-green)] text-white font-medium rounded-lg hover:bg-[var(--accent-green-dark)] transition-colors"
              >
                Sign in to Submit
              </button>
            )}
          </div>

          {/* Type tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === 'all'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-medium)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              All ({requests.length})
            </button>
            <button
              onClick={() => setTypeFilter('brand')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === 'brand'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-medium)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Globe className="w-4 h-4" />
              Brand Requests ({brandCount})
            </button>
            <button
              onClick={() => setTypeFilter('feature')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                typeFilter === 'feature'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-medium)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Feature Requests ({featureCount})
            </button>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 mb-6">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <div className="flex gap-1">
              {[
                { value: 'all', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'planned', label: 'Planned' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value as StatusFilter)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === opt.value
                      ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green-light)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requests list */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass rounded-xl p-4 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-12 h-16 bg-[var(--bg-tertiary)] rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-[var(--bg-tertiary)] rounded w-3/4" />
                      <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/2" />
                      <div className="h-3 bg-[var(--bg-tertiary)] rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                <Lightbulb className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                No requests yet
              </h3>
              <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
                Be the first to submit a feature request or ask us to track a brand
              </p>
              {session ? (
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-green)] text-white font-medium rounded-lg hover:bg-[var(--accent-green-dark)] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Submit First Request
                </button>
              ) : (
                <button
                  onClick={() => signIn()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-green)] text-white font-medium rounded-lg hover:bg-[var(--accent-green-dark)] transition-colors"
                >
                  Sign in to Submit
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <div key={request.id}>
                  <RequestCard
                    request={request}
                    onUpvote={handleUpvote}
                    onDelete={handleDelete}
                    isAdmin={isAdmin}
                  />
                  {/* Admin status controls */}
                  {isAdmin && (
                    <div className="ml-16 mt-2 flex items-center gap-2">
                      <span className="text-xs text-[var(--text-muted)]">Status:</span>
                      <select
                        value={request.status}
                        onChange={(e) => handleStatusChange(request.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      >
                        <option value="pending">Pending</option>
                        <option value="planned">Planned</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Submit Modal */}
      <SubmitModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
