'use client';

import { useState, useEffect } from 'react';

interface AdMediaResult {
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  isLoading: boolean;
  error: boolean;
}

// Module-level cache — persists across re-renders and tab switches
const resolvedCache = new Map<
  string,
  { mediaUrl: string; mediaType: 'image' | 'video' } | null
>();

export function useAdMedia(
  adId: string | undefined,
  snapshotUrl: string | null | undefined,
): AdMediaResult {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!adId || !snapshotUrl) return;

    // Check module-level cache
    if (resolvedCache.has(adId)) {
      const cached = resolvedCache.get(adId);
      if (cached) {
        setMediaUrl(cached.mediaUrl);
        setMediaType(cached.mediaType);
      }
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const res = await fetch('/api/media/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adId, snapshotUrl }),
        });

        const data = await res.json();

        if (cancelled) return;

        if (data.success && data.mediaUrl) {
          resolvedCache.set(adId, {
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType,
          });
          setMediaUrl(data.mediaUrl);
          setMediaType(data.mediaType);
        } else {
          resolvedCache.set(adId, null);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adId, snapshotUrl]);

  return { mediaUrl, mediaType, isLoading, error };
}
