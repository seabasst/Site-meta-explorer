'use client';

import { useMemo } from 'react';
import type { FacebookAdResult } from '@/lib/facebook-api';

interface AdLongevityProps {
  ads: FacebookAdResult[];
}

interface AdWithAge extends FacebookAdResult {
  daysRunning: number;
  isEvergreen: boolean;
}

function formatDaysRunning(days: number): string {
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w ${days % 7}d`;
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (months < 12) return `${months}mo ${remainingDays}d`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  return `${years}y ${remainingMonths}mo`;
}

function getDaysRunning(startDate: string | null): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - start.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function AdLongevity({ ads }: AdLongevityProps) {
  const analysis = useMemo(() => {
    // Calculate days running for each ad
    const adsWithAge: AdWithAge[] = ads
      .filter(ad => ad.startedRunning)
      .map(ad => ({
        ...ad,
        daysRunning: getDaysRunning(ad.startedRunning),
        isEvergreen: getDaysRunning(ad.startedRunning) >= 30,
      }))
      .sort((a, b) => b.daysRunning - a.daysRunning);

    // Evergreen ads (30+ days)
    const evergreenAds = adsWithAge.filter(ad => ad.isEvergreen);

    // Age distribution buckets
    const distribution = {
      '0-7 days': adsWithAge.filter(ad => ad.daysRunning <= 7).length,
      '1-4 weeks': adsWithAge.filter(ad => ad.daysRunning > 7 && ad.daysRunning <= 28).length,
      '1-3 months': adsWithAge.filter(ad => ad.daysRunning > 28 && ad.daysRunning <= 90).length,
      '3-6 months': adsWithAge.filter(ad => ad.daysRunning > 90 && ad.daysRunning <= 180).length,
      '6+ months': adsWithAge.filter(ad => ad.daysRunning > 180).length,
    };

    // Average age
    const totalDays = adsWithAge.reduce((sum, ad) => sum + ad.daysRunning, 0);
    const avgDays = adsWithAge.length > 0 ? Math.round(totalDays / adsWithAge.length) : 0;

    // Oldest ad
    const oldestAd = adsWithAge[0] || null;

    return {
      adsWithAge,
      evergreenAds,
      distribution,
      avgDays,
      oldestAd,
      totalWithDate: adsWithAge.length,
    };
  }, [ads]);

  if (analysis.totalWithDate === 0) {
    return (
      <div className="text-center py-6 text-[var(--text-muted)]">
        No ads with start date information available.
      </div>
    );
  }

  const maxDistribution = Math.max(...Object.values(analysis.distribution));

  return (
    <div className="space-y-6">
      {/* Key Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-2xl font-bold text-[var(--accent-yellow)]">
            {analysis.evergreenAds.length}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Evergreen Ads</div>
          <div className="text-xs text-[var(--text-secondary)]">(30+ days)</div>
        </div>
        <div className="text-center p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {formatDaysRunning(analysis.avgDays)}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Average Age</div>
        </div>
        <div className="text-center p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
          <div className="text-2xl font-bold text-emerald-400">
            {analysis.oldestAd ? formatDaysRunning(analysis.oldestAd.daysRunning) : '-'}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">Oldest Ad</div>
        </div>
      </div>

      {/* Age Distribution */}
      <div>
        <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Age Distribution</h4>
        <div className="space-y-2">
          {Object.entries(analysis.distribution).map(([label, count]) => {
            const percentage = maxDistribution > 0 ? (count / maxDistribution) * 100 : 0;
            const isHighlight = label === '3-6 months' || label === '6+ months';
            return (
              <div key={label} className="flex items-center gap-3">
                <div className="w-24 text-xs text-[var(--text-muted)] text-right">{label}</div>
                <div className="flex-1 h-6 bg-[var(--bg-tertiary)] rounded-md overflow-hidden">
                  <div
                    className={`h-full rounded-md transition-all duration-500 ${
                      isHighlight ? 'bg-emerald-500/80' : 'bg-[var(--accent-green)]/60'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-12 text-xs text-[var(--text-secondary)] tabular-nums">{count} ads</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Evergreen Performers */}
      {analysis.evergreenAds.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-yellow)]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Top Evergreen Performers
          </h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {analysis.evergreenAds.slice(0, 10).map((ad, index) => (
              <a
                key={ad.adId}
                href={`https://www.facebook.com/ads/library/?id=${ad.adArchiveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--accent-green)] transition-colors group"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--bg-elevated)] flex items-center justify-center text-xs font-bold text-[var(--text-muted)]">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent-green-light)]">
                    {ad.linkTitle || ad.creativeBody?.slice(0, 50) || `Ad ${ad.adId}`}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    Started: {ad.startedRunning ? new Date(ad.startedRunning).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-sm font-bold text-emerald-400">
                    {formatDaysRunning(ad.daysRunning)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {ad.euTotalReach.toLocaleString()} reach
                  </div>
                </div>
              </a>
            ))}
          </div>
          {analysis.evergreenAds.length > 10 && (
            <div className="text-center text-xs text-[var(--text-muted)] mt-2">
              +{analysis.evergreenAds.length - 10} more evergreen ads
            </div>
          )}
        </div>
      )}
    </div>
  );
}
