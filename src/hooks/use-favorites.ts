'use client';

import { useState, useEffect, useCallback } from 'react';

export interface FavoriteBrand {
  pageId: string;
  pageName: string;
  adLibraryUrl: string;
  addedAt: string;
  lastAnalyzed?: string;
  totalAds?: number;
  totalReach?: number;
}

const STORAGE_KEY = 'fb-ad-analyzer-favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteBrand[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setFavorites(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error('Failed to load favorites:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever favorites change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
      } catch (e) {
        console.error('Failed to save favorites:', e);
      }
    }
  }, [favorites, isLoaded]);

  const addFavorite = useCallback((brand: Omit<FavoriteBrand, 'addedAt'>) => {
    setFavorites(prev => {
      // Don't add duplicates
      if (prev.some(f => f.pageId === brand.pageId)) {
        return prev;
      }
      return [...prev, { ...brand, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeFavorite = useCallback((pageId: string) => {
    setFavorites(prev => prev.filter(f => f.pageId !== pageId));
  }, []);

  const updateFavorite = useCallback((pageId: string, updates: Partial<FavoriteBrand>) => {
    setFavorites(prev => prev.map(f =>
      f.pageId === pageId ? { ...f, ...updates } : f
    ));
  }, []);

  const isFavorite = useCallback((pageId: string) => {
    return favorites.some(f => f.pageId === pageId);
  }, [favorites]);

  const toggleFavorite = useCallback((brand: Omit<FavoriteBrand, 'addedAt'>) => {
    if (isFavorite(brand.pageId)) {
      removeFavorite(brand.pageId);
    } else {
      addFavorite(brand);
    }
  }, [isFavorite, removeFavorite, addFavorite]);

  return {
    favorites,
    isLoaded,
    addFavorite,
    removeFavorite,
    updateFavorite,
    isFavorite,
    toggleFavorite,
  };
}
