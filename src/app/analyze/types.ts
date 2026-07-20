export interface AssetView {
  id: string;
  assetType: string;
  storedUrl: string | null;
  thumbnailUrl: string | null;
  position: number;
  downloadStatus: string;
}

export interface RankedAdView {
  id: string;
  adId: string;
  displayFormat: string | null;
  body: string | null;
  title: string | null;
  ctaText: string | null;
  snapshotUrl: string | null;
  isActive: boolean;
  reachEstimate: number | null;
  longevityDays: number;
  score: number;
  assets: AssetView[];
  brand: { pageId: string; pageName: string; profilePicUrl: string | null };
}

export interface BestCopyEntry {
  adId: string;
  displayFormat: string | null;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  snapshotUrl: string | null;
  reachEstimate: number | null;
  longevityDays: number;
  brand: { pageId: string; pageName: string };
}

export interface CreatorPartnershipView {
  id: string;
  adCount: number;
  totalReach: number;
  thumbnailUrl: string | null;
  brandName?: string;
  creator: { pageId: string; pageName: string; tier: string; creatorType: string };
}

export interface CategoryBenchmarkView {
  andromedaScore: number;
  overallScore: number;
  totalAdsAnalyzed: number;
  analyzedAt: string;
  categoryPeerAverage: number | null;
}

export interface BrandReport {
  brand: {
    id: string;
    pageId: string;
    pageName: string;
    profilePicUrl: string | null;
    country: string | null;
    category: string | null;
    website: string | null;
    activeAdCount: number;
  };
  stats: {
    totalAds: number;
    activeAds: number;
    estimatedTotalReach: number;
    formatBreakdown: { format: string | null; count: number }[];
  };
  topAds: RankedAdView[];
  bestCopy: BestCopyEntry[];
  creatorPartnerships: CreatorPartnershipView[];
  categoryBenchmark: CategoryBenchmarkView | null;
}

export interface CategoryBrandRow {
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  country: string | null;
  activeAdCount: number;
  estimatedReach: number;
}

export interface CategoryReport {
  category: { slug: string; label: string; variants: string[] };
  stats: {
    totalBrands: number;
    totalActiveAds: number;
    estimatedTotalReach: number;
    avgAndromedaScore: number | null;
    brandsAnalyzed: number;
  };
  brands: CategoryBrandRow[];
  topAds: RankedAdView[];
  bestCopy: BestCopyEntry[];
  creatorPartnerships: CreatorPartnershipView[];
}

export interface SearchBrandSuggestion {
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  category: string | null;
  country: string | null;
  activeAdCount: number;
}

export interface SearchCategorySuggestion {
  slug: string;
  label: string;
  brandCount: number;
  totalActiveAds: number;
}

export interface SearchResponse {
  brands: SearchBrandSuggestion[];
  categories: SearchCategorySuggestion[];
}
