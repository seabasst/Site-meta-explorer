'use client';

import type { FacebookApiResult } from '@/lib/facebook-api';
import { Globe, Users, Target, Play, Image as ImageIcon, TrendingUp } from 'lucide-react';

// Country code to name mapping
const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
  CZ: 'Czechia', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
  DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
  LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
  PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
  ES: 'Spain', SE: 'Sweden', GB: 'United Kingdom', US: 'United States',
  CA: 'Canada', AU: 'Australia', NZ: 'New Zealand', NO: 'Norway', CH: 'Switzerland',
};

interface AccountSummaryProps {
  result: FacebookApiResult;
}

export function AccountSummary({ result }: AccountSummaryProps) {
  const totalReach = result.ads.reduce((sum, ad) => sum + ad.euTotalReach, 0);
  const demographics = result.aggregatedDemographics;
  const mediaBreakdown = result.mediaTypeBreakdown;

  // Get dominant gender
  const dominantGender = demographics?.genderBreakdown?.[0];
  const genderDisplay = dominantGender?.gender === 'female' ? 'Women' :
                        dominantGender?.gender === 'male' ? 'Men' : 'Mixed';

  // Get dominant age ranges (top 2)
  const topAges = demographics?.ageBreakdown?.slice(0, 2) || [];
  const ageDisplay = topAges.length > 0
    ? topAges.map(a => a.age).join(', ')
    : 'All ages';

  // Get top 3 countries
  const topCountries = demographics?.regionBreakdown?.slice(0, 3) || [];

  // Calculate video vs image percentage
  const videoPercentage = mediaBreakdown?.videoPercentage || 0;
  const imagePercentage = mediaBreakdown?.imagePercentage || 0;

  // Get average ad age (days running)
  const adsWithDates = result.ads.filter(ad => ad.startedRunning);
  const avgDaysRunning = adsWithDates.length > 0
    ? Math.round(
        adsWithDates.reduce((sum, ad) => {
          const start = new Date(ad.startedRunning!);
          const now = new Date();
          return sum + Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / adsWithDates.length
      )
    : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Active Ads */}
      <div className="glass rounded-xl p-4 border-l-4 border-l-[var(--accent-green)]">
        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Active Ads</span>
        </div>
        <div className="text-3xl font-bold text-[var(--text-primary)]">
          {result.totalAdsFound}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          Avg. {avgDaysRunning} days running
        </div>
      </div>

      {/* Total Reach */}
      <div className="glass rounded-xl p-4 border-l-4 border-l-[var(--accent-yellow)]">
        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
          <Users className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">EU Reach</span>
        </div>
        <div className="text-3xl font-bold text-[var(--accent-yellow)]">
          {totalReach >= 1000000
            ? `${(totalReach / 1000000).toFixed(1)}M`
            : totalReach >= 1000
              ? `${(totalReach / 1000).toFixed(0)}K`
              : totalReach.toLocaleString()}
        </div>
        <div className="text-xs text-[var(--text-muted)] mt-1">
          Across {demographics?.adsWithDemographics || 0} ads with data
        </div>
      </div>

      {/* Top Markets */}
      <div className="glass rounded-xl p-4 border-l-4 border-l-[var(--cat-landing)]">
        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
          <Globe className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Top Markets</span>
        </div>
        {topCountries.length > 0 ? (
          <div className="space-y-1.5">
            {topCountries.map((country, idx) => (
              <div key={country.region} className="flex items-center gap-2">
                <div
                  className="h-2 rounded-full bg-[var(--cat-landing)]"
                  style={{
                    width: `${Math.max(20, country.percentage)}%`,
                    opacity: 1 - (idx * 0.25)
                  }}
                />
                <span className="text-xs text-[var(--text-secondary)] whitespace-nowrap">
                  {COUNTRY_NAMES[country.region] || country.region} ({country.percentage.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[var(--text-muted)]">No data</div>
        )}
      </div>

      {/* Audience Profile */}
      <div className="glass rounded-xl p-4 border-l-4 border-l-purple-500">
        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-2">
          <Target className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Audience</span>
        </div>
        <div className="space-y-2">
          <div>
            <span className="text-lg font-bold text-[var(--text-primary)]">{genderDisplay}</span>
            {dominantGender && (
              <span className="text-xs text-[var(--text-muted)] ml-2">
                ({dominantGender.percentage.toFixed(0)}%)
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Ages: <span className="text-[var(--accent-green-light)]">{ageDisplay}</span>
          </div>
          {mediaBreakdown && (
            <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] pt-1 border-t border-[var(--border-subtle)]">
              <span className="flex items-center gap-1">
                <Play className="w-3 h-3 text-purple-500" />
                {videoPercentage.toFixed(0)}%
              </span>
              <span className="flex items-center gap-1">
                <ImageIcon className="w-3 h-3 text-blue-500" />
                {imagePercentage.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
