'use client';

import { useState } from 'react';
import { extractPageIdFromUrl } from '@/lib/facebook-api';
import { X } from 'lucide-react';

interface BrandSetupModalProps {
  mode: 'own' | 'competitor';
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { facebookPageId: string; pageName: string; adLibraryUrl: string }) => Promise<void>;
}

export function BrandSetupModal({ mode, open, onClose, onSubmit }: BrandSetupModalProps) {
  const [url, setUrl] = useState('');
  const [pageName, setPageName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const pageId = extractPageIdFromUrl(url);
    if (!pageId) {
      setError('Could not extract page ID from URL. Please paste a valid Facebook Ad Library URL.');
      return;
    }

    if (!pageName.trim()) {
      setError('Please enter a brand name.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        facebookPageId: pageId,
        pageName: pageName.trim(),
        adLibraryUrl: url.trim(),
      });
      setUrl('');
      setPageName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 glass rounded-2xl p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {mode === 'own' ? 'Set Your Brand' : 'Add Competitor'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Brand Name</label>
            <input
              type="text"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder="e.g. Nike"
              className="input-field w-full text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Facebook Ad Library URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.facebook.com/ads/library/?view_all_page_id=..."
              className="input-field w-full text-sm"
              required
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Go to facebook.com/ads/library, search for the brand, and copy the URL.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
              {submitting ? 'Saving...' : mode === 'own' ? 'Set Brand' : 'Add Competitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
