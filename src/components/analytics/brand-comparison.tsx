'use client';

import type { FacebookApiResult } from '@/lib/facebook-api';

interface BrandComparisonProps {
  brands: FacebookApiResult[];
  onRemoveBrand: (index: number) => void;
}

// Country code to name mapping
const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden',
};

// Color palette for brands
const BRAND_COLORS = [
  { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', bar: 'bg-blue-500' },
  { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', bar: 'bg-amber-500' },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function BrandComparison({ brands, onRemoveBrand }: BrandComparisonProps) {
  if (brands.length < 2) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        Add at least 2 brands to compare
      </div>
    );
  }

  // Calculate stats for comparison
  const brandStats = brands.map((brand, index) => {
    const totalReach = brand.ads.reduce((sum, ad) => sum + ad.euTotalReach, 0);
    const activeAds = brand.ads.filter(ad => ad.isActive).length;
    const avgReach = brand.ads.length > 0 ? Math.round(totalReach / brand.ads.length) : 0;

    // Get top countries
    const topCountries = brand.aggregatedDemographics?.regionBreakdown.slice(0, 3) || [];

    // Get dominant gender
    const dominantGender = brand.aggregatedDemographics?.genderBreakdown[0];

    // Get dominant age
    const dominantAge = brand.aggregatedDemographics?.ageBreakdown[0];

    // Media type
    const videoPercent = brand.mediaTypeBreakdown?.videoPercentage || 0;

    // Ad longevity (average days running)
    const adsWithDates = brand.ads.filter(ad => ad.startedRunning);
    const avgDays = adsWithDates.length > 0
      ? Math.round(
          adsWithDates.reduce((sum, ad) => {
            const start = new Date(ad.startedRunning!);
            const now = new Date();
            return sum + Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / adsWithDates.length
        )
      : 0;

    return {
      name: brand.pageName || `Brand ${index + 1}`,
      totalAds: brand.totalAdsFound,
      activeAds,
      totalReach,
      avgReach,
      topCountries,
      dominantGender,
      dominantAge,
      videoPercent,
      avgDays,
      colors: BRAND_COLORS[index % BRAND_COLORS.length],
    };
  });

  // Find max values for bar scaling (use 1 as minimum to avoid division by zero)
  const maxReach = Math.max(...brandStats.map(b => b.totalReach), 1);
  const maxAds = Math.max(...brandStats.map(b => b.totalAds), 1);
  const maxAvgReach = Math.max(...brandStats.map(b => b.avgReach), 1);

  return (
    <div className="space-y-6">
      {/* Brand Headers */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${brands.length}, 1fr)` }}>
        {brandStats.map((brand, index) => (
          <div
            key={index}
            className={`relative p-4 rounded-xl ${brand.colors.bg} border ${brand.colors.border}`}
          >
            <button
              onClick={() => onRemoveBrand(index)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className={`font-bold text-lg ${brand.colors.text} truncate pr-8`}>
              {brand.name}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {brand.totalAds} ads • {formatNumber(brand.totalReach)} reach
            </p>
          </div>
        ))}
      </div>

      {/* Comparison Metrics */}
      <div className="space-y-4">
        {/* Total Reach */}
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3">Total EU Reach</h4>
          <div className="space-y-2">
            {brandStats.map((brand, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-24 text-sm text-[var(--text-secondary)] truncate">{brand.name}</div>
                <div className="flex-1 h-6 bg-[var(--bg-elevated)] rounded overflow-hidden">
                  <div
                    className={`h-full ${brand.colors.bar} transition-all duration-500`}
                    style={{ width: `${(brand.totalReach / maxReach) * 100}%` }}
                  />
                </div>
                <div className={`w-16 text-right text-sm font-bold ${brand.colors.text}`}>
                  {formatNumber(brand.totalReach)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total Ads */}
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3">Total Ads</h4>
          <div className="space-y-2">
            {brandStats.map((brand, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-24 text-sm text-[var(--text-secondary)] truncate">{brand.name}</div>
                <div className="flex-1 h-6 bg-[var(--bg-elevated)] rounded overflow-hidden">
                  <div
                    className={`h-full ${brand.colors.bar} transition-all duration-500`}
                    style={{ width: `${(brand.totalAds / maxAds) * 100}%` }}
                  />
                </div>
                <div className={`w-16 text-right text-sm font-bold ${brand.colors.text}`}>
                  {brand.totalAds}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Avg Reach per Ad */}
        <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <h4 className="text-sm font-medium text-[var(--text-muted)] mb-3">Avg Reach per Ad</h4>
          <div className="space-y-2">
            {brandStats.map((brand, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-24 text-sm text-[var(--text-secondary)] truncate">{brand.name}</div>
                <div className="flex-1 h-6 bg-[var(--bg-elevated)] rounded overflow-hidden">
                  <div
                    className={`h-full ${brand.colors.bar} transition-all duration-500`}
                    style={{ width: `${(brand.avgReach / maxAvgReach) * 100}%` }}
                  />
                </div>
                <div className={`w-16 text-right text-sm font-bold ${brand.colors.text}`}>
                  {formatNumber(brand.avgReach)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demographics Comparison */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${brands.length}, 1fr)` }}>
          {brandStats.map((brand, index) => (
            <div key={index} className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
              <h4 className={`text-sm font-medium ${brand.colors.text} mb-3`}>{brand.name}</h4>

              <div className="space-y-3 text-sm">
                {/* Top Countries */}
                <div>
                  <div className="text-xs text-[var(--text-muted)] mb-1">Top Markets</div>
                  {brand.topCountries.length > 0 ? (
                    <div className="space-y-1">
                      {brand.topCountries.map((country, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">
                            {COUNTRY_NAMES[country.region] || country.region}
                          </span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {country.percentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[var(--text-muted)]">N/A</span>
                  )}
                </div>

                {/* Dominant Demographics */}
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Primary Gender</span>
                  <span className="font-medium text-[var(--text-primary)] capitalize">
                    {brand.dominantGender
                      ? `${brand.dominantGender.gender} (${brand.dominantGender.percentage.toFixed(0)}%)`
                      : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Top Age Group</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {brand.dominantAge
                      ? `${brand.dominantAge.age} (${brand.dominantAge.percentage.toFixed(0)}%)`
                      : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Video Ads</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {brand.videoPercent.toFixed(0)}%
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Avg Ad Age</span>
                  <span className="font-medium text-[var(--text-primary)]">
                    {brand.avgDays} days
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
