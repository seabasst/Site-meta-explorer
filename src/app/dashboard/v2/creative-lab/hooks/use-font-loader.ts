'use client';

import { useState, useCallback, useRef } from 'react';

interface UseFontLoaderResult {
  loadFont: (fontFamily: string) => Promise<void>;
  loadedFonts: Set<string>;
  isLoading: boolean;
}

/**
 * Dynamically loads Google Fonts via CSS Font Loading API.
 * Injects a <link> stylesheet for the font, then awaits document.fonts.load()
 * so Konva text layers render with the correct typeface.
 */
export function useFontLoader(): UseFontLoaderResult {
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

  // Track injected link elements to avoid duplicates
  const injectedRef = useRef<Set<string>>(new Set());

  const loadFont = useCallback(async (fontFamily: string) => {
    // Already loaded — skip
    if (loadedFonts.has(fontFamily)) return;

    // Already injecting — skip
    if (injectedRef.current.has(fontFamily)) return;
    injectedRef.current.add(fontFamily);

    setIsLoading(true);

    try {
      // Inject Google Fonts stylesheet
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;700&display=swap`;
      document.head.appendChild(link);

      // Wait for the font to be available in the browser
      await document.fonts.load(`16px "${fontFamily}"`);

      setLoadedFonts((prev) => new Set(prev).add(fontFamily));
    } catch {
      // Font failed to load — remove from injected tracking so it can retry
      injectedRef.current.delete(fontFamily);
    } finally {
      setIsLoading(false);
    }
  }, [loadedFonts]);

  return { loadFont, loadedFonts, isLoading };
}
