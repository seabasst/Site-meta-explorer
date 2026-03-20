// ---------------------------------------------------------------------------
// Shared types for the Ad Library feature
// ---------------------------------------------------------------------------

export interface TopBrand {
  id: string;
  pageId: string;
  pageName: string;
  category: string | null;
  adCount: number;
  activeAdCount: number;
  totalReach: string;
}

export interface Ad {
  id: string;
  adId: string;
  displayFormat: string | null;
  publisherPlatforms: string[];
  body: string | null;
  caption: string | null;
  title: string | null;
  snapshotUrl: string | null;
  bylines: string | null;
  startDate: string | null;
  endDate: string | null;
  adDurationDays: number | null;
  isActive: boolean;
  reachEstimate: number | null;
  impressionsLower: number | null;
  impressionsUpper: number | null;
  spendLower: number | null;
  spendUpper: number | null;
  currency: string | null;
  targetingJson: unknown;
  linkUrl: string | null;
  linkDescription: string | null;
  ctaText: string | null;
  ctaType: string | null;
  brand: {
    pageId: string;
    pageName: string;
    profilePicUrl: string | null;
    category: string | null;
  };
  assets: {
    id: string;
    assetType: string;
    storedUrl: string | null;
    thumbnailUrl: string | null;
    originalUrl: string;
    downloadStatus: string;
    position: number;
  }[];
}

export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface FilterOption {
  value: string;
  count: number;
}

export interface DaysRange {
  label: string;
  min: number;
  max: number | undefined;
}

// ---------------------------------------------------------------------------
// Sort & Display types (consumed by filter bar and grid components)
// ---------------------------------------------------------------------------

export type SortField = 'reachEstimate' | 'spendLower' | 'adDurationDays' | 'startDate' | 'createdAt';

export const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'reachEstimate', label: 'Reach' },
  { value: 'spendLower', label: 'Spend' },
  { value: 'adDurationDays', label: 'Days Active' },
  { value: 'startDate', label: 'Start Date' },
  { value: 'createdAt', label: 'Date Added' },
];

export type GridDensity = 'standard' | 'compact';

// ---------------------------------------------------------------------------
// Filtered stats (returned inline with ads API response)
// ---------------------------------------------------------------------------

export interface FilteredStats {
  totalReach: number;
  activeCount: number;
  formatBreakdown: { format: string; count: number }[];
  topCategories: { category: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatFormatLabel(format: string | null): string {
  if (!format) return 'Unknown';
  return format.charAt(0).toUpperCase() + format.slice(1);
}
