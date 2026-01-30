'use client';

import { useState, useEffect, useCallback } from 'react';

export interface TrackedBrandSnapshot {
  id: string;
  snapshotDate: string;
  totalAdsFound: number;
  activeAdsCount: number;
  totalReach: number;
  avgReachPerAd: number;
  estimatedSpendUsd: number;
  videoCount: number;
  imageCount: number;
  videoPercentage: number;
  imagePercentage: number;
  avgAdAgeDays: number;
  dominantGender: string | null;
  dominantGenderPct: number | null;
  dominantAgeRange: string | null;
  dominantAgePct: number | null;
  topCountry1Code: string | null;
  topCountry1Pct: number | null;
  topCountry2Code: string | null;
  topCountry2Pct: number | null;
  topCountry3Code: string | null;
  topCountry3Pct: number | null;
  demographicsJson: unknown;
  spendByCountryJson: unknown;
}

export interface TrackedBrand {
  id: string;
  facebookPageId: string;
  pageName: string;
  adLibraryUrl: string;
  createdAt: string;
  snapshots: TrackedBrandSnapshot[];
}

export interface TrendSnapshot {
  id: string;
  snapshotDate: string;
  trackedBrandId: string;
  totalAdsFound: number;
  activeAdsCount: number;
  totalReach: number;
  estimatedSpendUsd: number;
}

export interface DashboardData {
  ownBrand: TrackedBrand | null;
  competitors: TrackedBrand[];
  trendSnapshots: TrendSnapshot[];
}

export function useTrackedBrands() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/dashboard/overview');
      if (!res.ok) {
        if (res.status === 401) {
          setData(null);
          return;
        }
        throw new Error('Failed to fetch dashboard data');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
