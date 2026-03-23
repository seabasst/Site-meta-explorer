'use client';

import { useState, useEffect } from 'react';

interface UseLoadImageResult {
  image: HTMLImageElement | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
}

/**
 * Loads an image as an HTMLImageElement for use with Konva.
 * Sets crossOrigin = 'anonymous' so the canvas stays export-safe.
 */
export function useLoadImage(src: string | null): UseLoadImageResult {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState<UseLoadImageResult['status']>('idle');

  useEffect(() => {
    if (!src) {
      setImage(null);
      setStatus('idle');
      return;
    }

    setStatus('loading');

    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setImage(img);
      setStatus('loaded');
    };

    img.onerror = () => {
      setImage(null);
      setStatus('error');
    };

    img.src = src;

    return () => {
      // Clean up: abort pending load when src changes
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { image, status };
}
