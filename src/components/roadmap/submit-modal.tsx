'use client';

import { useState } from 'react';
import { X, Globe, Lightbulb } from 'lucide-react';

interface SubmitModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: 'brand' | 'feature';
    title: string;
    description?: string;
    pageUrl?: string;
  }) => Promise<void>;
  initialType?: 'brand' | 'feature';
  initialQuery?: string; // Pre-fill title from search
}

export function SubmitModal({
  open,
  onClose,
  onSubmit,
  initialType = 'feature',
  initialQuery = '',
}: SubmitModalProps) {
  const [type, setType] = useState<'brand' | 'feature'>(initialType);
  const [title, setTitle] = useState(initialQuery);
  const [description, setDescription] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (type === 'brand' && !pageUrl.trim()) {
      setError('Facebook page URL is required for brand requests');
      return;
    }

    // Validate URL format for brand requests
    if (type === 'brand' && pageUrl) {
      if (!pageUrl.includes('facebook.com')) {
        setError('Please enter a valid Facebook URL');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        pageUrl: type === 'brand' ? pageUrl.trim() : undefined,
      });
      // Reset form
      setTitle('');
      setDescription('');
      setPageUrl('');
      setType('feature');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTypeChange = (newType: 'brand' | 'feature') => {
    setType(newType);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 glass rounded-2xl p-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            Submit Request
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type tabs */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => handleTypeChange('brand')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              type === 'brand'
                ? 'bg-[var(--accent-green)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="font-medium">Brand Request</span>
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('feature')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              type === 'feature'
                ? 'bg-[var(--accent-green)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span className="font-medium">Feature Request</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              {type === 'brand' ? 'Brand Name' : 'Feature Title'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === 'brand'
                  ? 'e.g. Nike, Adidas, Apple'
                  : 'e.g. Add export to CSV'
              }
              className="input-field w-full text-sm"
              maxLength={200}
              required
            />
          </div>

          {/* Page URL (for brand requests) */}
          {type === 'brand' && (
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                Facebook Ad Library URL
              </label>
              <input
                type="url"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="https://www.facebook.com/ads/library/?view_all_page_id=..."
                className="input-field w-full text-sm"
                required
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Go to facebook.com/ads/library, search for the brand, and copy the URL.
              </p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              {type === 'brand' ? 'Why track this brand? (optional)' : 'Description (optional)'}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === 'brand'
                  ? 'Tell us why you want to track this brand...'
                  : 'Describe the feature you would like to see...'
              }
              className="input-field w-full text-sm min-h-[100px] resize-none"
              maxLength={1000}
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
