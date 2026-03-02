'use client';

import { useState } from 'react';
import { ChevronUp, Globe, Lightbulb, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface RequestCardProps {
  request: {
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
  };
  onUpvote: (id: string) => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Pending' },
  planned: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Planned' },
  in_progress: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'In Progress' },
  completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Completed' },
  rejected: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Rejected' },
};

export function RequestCard({ request, onUpvote, onDelete, isAdmin }: RequestCardProps) {
  const { data: session } = useSession();
  const [isUpvoting, setIsUpvoting] = useState(false);
  const [localUpvoted, setLocalUpvoted] = useState(request.hasUpvoted);
  const [localCount, setLocalCount] = useState(request.upvoteCount);

  const statusStyle = STATUS_STYLES[request.status] || STATUS_STYLES.pending;

  const handleUpvote = async () => {
    if (!session) return;
    if (isUpvoting) return;

    setIsUpvoting(true);
    // Optimistic update
    setLocalUpvoted(!localUpvoted);
    setLocalCount(localUpvoted ? localCount - 1 : localCount + 1);

    try {
      onUpvote(request.id);
    } catch {
      // Revert on error
      setLocalUpvoted(localUpvoted);
      setLocalCount(request.upvoteCount);
    } finally {
      setIsUpvoting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const canDelete = isAdmin || request.isOwner;

  return (
    <div
      className={`glass rounded-xl p-4 transition-colors ${
        request.isOwner ? 'border-[var(--accent-green)]/30' : ''
      }`}
    >
      <div className="flex gap-4">
        {/* Upvote button */}
        <button
          onClick={handleUpvote}
          disabled={!session || isUpvoting}
          className={`flex flex-col items-center justify-center w-12 shrink-0 rounded-lg py-2 transition-colors ${
            localUpvoted
              ? 'bg-[var(--accent-green)]/20 text-[var(--accent-green-light)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          } ${!session ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={session ? 'Click to upvote' : 'Sign in to upvote'}
        >
          <ChevronUp className={`w-5 h-5 ${localUpvoted ? 'text-[var(--accent-green-light)]' : ''}`} />
          <span className="text-sm font-medium">{localCount}</span>
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {/* Type icon */}
              {request.type === 'brand' ? (
                <Globe className="w-4 h-4 text-blue-400 shrink-0" />
              ) : (
                <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0" />
              )}
              <h3 className="font-medium text-[var(--text-primary)] truncate">
                {request.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Status badge */}
              <span
                className={`text-xs px-2 py-0.5 rounded ${statusStyle.bg} ${statusStyle.text}`}
              >
                {statusStyle.label}
              </span>

              {/* Delete button */}
              {canDelete && onDelete && (
                <button
                  onClick={() => onDelete(request.id)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  title="Delete request"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          {request.description && (
            <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-2">
              {request.description}
            </p>
          )}

          {/* Page URL for brand requests */}
          {request.type === 'brand' && request.pageUrl && (
            <a
              href={request.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-xs text-[var(--accent-green-light)] hover:underline truncate block"
            >
              {request.pageUrl}
            </a>
          )}

          {/* Meta info */}
          <div className="mt-2 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span>{request.userEmail.split('@')[0]}</span>
            <span>·</span>
            <span>{formatDate(request.createdAt)}</span>
            {request.isOwner && (
              <>
                <span>·</span>
                <span className="text-[var(--accent-green-light)]">Your request</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
