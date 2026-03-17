'use client';

import { useState, useEffect, useCallback } from 'react';

export interface DashboardConfig {
  id: string;
  name: string;
  filters: {
    displayFormat?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    isActive?: string;
  };
  createdAt: string;
}

const STORAGE_KEY = 'dashboard-v2-configs';
const MAX_CONFIGS = 10;

export function useDashboardConfig() {
  const [configs, setConfigs] = useState<DashboardConfig[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);

  // Load configs from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConfigs(Array.isArray(parsed) ? parsed : []);
      }
    } catch (e) {
      console.error('Failed to load dashboard configs:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever configs change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
      } catch (e) {
        console.error('Failed to save dashboard configs:', e);
      }
    }
  }, [configs, isLoaded]);

  const saveConfig = useCallback(
    (name: string, filters: Record<string, string>): boolean => {
      if (configs.length >= MAX_CONFIGS) {
        return false;
      }

      const trimmedName = name.trim();
      if (!trimmedName) return false;

      const newConfig: DashboardConfig = {
        id: crypto.randomUUID(),
        name: trimmedName,
        filters: {
          displayFormat: filters.displayFormat || undefined,
          category: filters.category || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          isActive: filters.isActive || undefined,
        },
        createdAt: new Date().toISOString(),
      };

      setConfigs((prev) => [...prev, newConfig]);
      setActiveConfigId(newConfig.id);
      return true;
    },
    [configs.length]
  );

  const loadConfig = useCallback(
    (id: string): DashboardConfig | undefined => {
      return configs.find((c) => c.id === id);
    },
    [configs]
  );

  const deleteConfig = useCallback(
    (id: string): void => {
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      if (activeConfigId === id) {
        setActiveConfigId(null);
      }
    },
    [activeConfigId]
  );

  return {
    configs,
    isLoaded,
    saveConfig,
    loadConfig,
    deleteConfig,
    activeConfigId,
    setActiveConfigId,
  };
}
