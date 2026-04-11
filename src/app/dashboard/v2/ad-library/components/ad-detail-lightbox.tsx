'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Heart,
  ExternalLink,
  Calendar,
  Users,
  Globe,
  Clock,
  DollarSign,
  Eye,
  Link2,
  Image as ImageIcon,
  Tag,
} from 'lucide-react';
import { formatNumber } from '../../v2-shell';
import { Ad } from '../types';
import { TAXONOMY, CATEGORY_KEYS, type CategoryKey } from '@/lib/classification/taxonomy';

const CATEGORY_SHORT_LABELS: Record<CategoryKey, string> = {
  assetType: 'Asset',
  visualFormat: 'Format',
  hookTactic: 'Hook',
  messagingAngle: 'Messaging',
  awarenessStage: 'Stage',
  creativeMechanic: 'Mechanic',
  offerType: 'Offer',
  intendedAudience: 'Audience',
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  assetType: '#3b82f6',
  visualFormat: '#8b5cf6',
  hookTactic: '#f59e0b',
  messagingAngle: '#10b981',
  awarenessStage: '#ec4899',
  creativeMechanic: '#06b6d4',
  offerType: '#f97316',
  intendedAudience: '#a855f7',
};

interface AdDetailLightboxProps {
  ad: Ad;
  darkMode: boolean;
  isSaved: boolean;
  onToggleSave: (adId: string) => void;
  onClose: () => void;
}

export function AdDetailLightbox({ ad, darkMode, isSaved, onToggleSave, onClose }: AdDetailLightboxProps) {
  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const primaryAsset = ad.assets?.find(a => a.downloadStatus === 'completed' && a.storedUrl);
  const assetCount = ad.assets?.length ?? 0;

  const renderMedia = () => {
    if (primaryAsset?.storedUrl) {
      if (primaryAsset.assetType === 'video') {
        return (
          <video
            src={primaryAsset.storedUrl}
            poster={primaryAsset.thumbnailUrl || undefined}
            className="max-h-[70vh] w-full object-contain rounded-lg"
            controls
            muted
            playsInline
            preload="metadata"
          />
        );
      }
      return (
        <img
          src={primaryAsset.storedUrl}
          alt={ad.title || 'Ad creative'}
          className="max-h-[70vh] w-full object-contain rounded-lg"
          loading="lazy"
        />
      );
    }

    // Text fallback
    return (
      <div className={`flex flex-col items-center justify-center p-8 rounded-lg min-h-[200px] ${
        darkMode ? 'bg-slate-800' : 'bg-slate-100'
      }`}>
        <ImageIcon className={`w-12 h-12 mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
        <p className={`text-sm text-center ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {ad.body || ad.title || 'No preview available'}
        </p>
      </div>
    );
  };

  const formatSpend = () => {
    if (ad.spendLower == null && ad.spendUpper == null) return 'N/A';
    const currency = ad.currency || 'USD';
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
    if (ad.spendLower != null && ad.spendUpper != null) {
      return `${fmt(ad.spendLower)} - ${fmt(ad.spendUpper)}`;
    }
    if (ad.spendLower != null) return fmt(ad.spendLower);
    return fmt(ad.spendUpper!);
  };

  const formatImpressions = () => {
    if (ad.impressionsLower == null && ad.impressionsUpper == null) return 'N/A';
    if (ad.impressionsLower != null && ad.impressionsUpper != null) {
      return `${formatNumber(ad.impressionsLower)} - ${formatNumber(ad.impressionsUpper)}`;
    }
    if (ad.impressionsLower != null) return formatNumber(ad.impressionsLower);
    return formatNumber(ad.impressionsUpper!);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Parse targeting data
  const targeting = (() => {
    if (!ad.targetingJson || typeof ad.targetingJson !== 'object') return null;
    const t = ad.targetingJson as Record<string, unknown>;
    return {
      gender: t.targetGender as string | null,
      ages: t.targetAges as string[] | null,
      locations: t.targetLocations as { name: string; type: string }[] | null,
      deliveryByRegion: t.deliveryByRegion as { region: string; percentage: string }[] | null,
    };
  })();

  const renderGeoSection = () => {
    if (!targeting) return null;
    const regions = targeting.deliveryByRegion?.filter(r => parseFloat(r.percentage) > 0.005) || [];
    const locations = targeting.locations || [];
    if (regions.length === 0 && locations.length === 0) return null;

    return (
      <div className={`pt-4 border-t ${sectionBorder}`}>
        <div className="flex items-center gap-1.5 mb-3">
          <Globe className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={labelClass}>Geographic Reach</span>
        </div>
        {regions.length > 0 ? (
          <div className="space-y-1.5">
            {regions
              .sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage))
              .slice(0, 8)
              .map(r => {
                const pct = parseFloat(r.percentage) * 100;
                return (
                  <div key={r.region} className="flex items-center gap-2">
                    <span className={`text-xs w-24 truncate shrink-0 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      {r.region}
                    </span>
                    <div className={`flex-1 h-2 rounded-full overflow-hidden ${darkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
                      <div
                        className="h-full rounded-full bg-[#1235e2]"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className={`text-xs w-10 text-right font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {locations.map((loc, i) => (
              <span
                key={i}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {loc.name}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDemographicsSection = () => {
    if (!targeting) return null;
    const gender = targeting.gender;
    const ages = targeting.ages;
    if (!gender && !ages) return null;

    return (
      <div className={`pt-4 border-t ${sectionBorder}`}>
        <div className="flex items-center gap-1.5 mb-3">
          <Users className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
          <span className={labelClass}>Audience Demographics</span>
        </div>
        <div className="flex gap-6">
          {/* Gender */}
          {gender && (
            <div>
              <span className={`text-[10px] uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Gender
              </span>
              <div className="flex items-center gap-2 mt-1">
                {gender === 'All' ? (
                  <>
                    <div className="flex gap-0.5">
                      <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <span className="text-[10px] text-blue-400">M</span>
                      </div>
                      <div className="w-5 h-5 rounded-full bg-pink-500/20 flex items-center justify-center">
                        <span className="text-[10px] text-pink-400">F</span>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>All</span>
                  </>
                ) : gender === 'Men' ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <span className="text-[10px] text-blue-400">M</span>
                    </div>
                    <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Men only</span>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full bg-pink-500/20 flex items-center justify-center">
                      <span className="text-[10px] text-pink-400">F</span>
                    </div>
                    <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>Women only</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Age range */}
          {ages && ages.length >= 2 && (
            <div>
              <span className={`text-[10px] uppercase tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Age Range
              </span>
              <div className="mt-1">
                <span className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {ages[0]}{ages[1] === '65' ? '+' : ` - ${ages[1]}`}
                </span>
                {/* Visual age bar */}
                <div className={`mt-1.5 h-1.5 w-32 rounded-full ${darkMode ? 'bg-slate-700' : 'bg-slate-100'} relative`}>
                  <div
                    className="absolute h-full rounded-full bg-[#1235e2]"
                    style={{
                      left: `${((parseInt(ages[0]) - 13) / 52) * 100}%`,
                      right: `${((65 - parseInt(ages[1])) / 52) * 100}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between mt-0.5 w-32">
                  <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-300'}`}>13</span>
                  <span className={`text-[9px] ${darkMode ? 'text-slate-600' : 'text-slate-300'}`}>65+</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const labelClass = `text-[11px] uppercase font-bold tracking-wide ${darkMode ? 'text-slate-500' : 'text-slate-400'}`;
  const valueClass = `text-sm font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`;
  const sectionBorder = darkMode ? 'border-[#1235e2]/10' : 'border-slate-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-4xl max-h-[90vh] mx-4 overflow-y-auto rounded-2xl ${
          darkMode
            ? 'bg-[#161b2e] border border-[#1235e2]/20 text-white'
            : 'bg-white border border-slate-200 text-slate-900'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-2 rounded-xl transition-colors ${
            darkMode
              ? 'text-slate-400 hover:text-white hover:bg-white/10'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Two-column layout */}
        <div className="flex flex-col md:flex-row">
          {/* LEFT: Media */}
          <div className={`md:w-1/2 p-6 flex items-center justify-center ${
            darkMode ? 'bg-slate-900/50' : 'bg-slate-50'
          } rounded-tl-2xl md:rounded-bl-2xl rounded-tr-2xl md:rounded-tr-none`}>
            <div className="relative w-full">
              {renderMedia()}
              {assetCount > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-white font-bold">
                  {assetCount} assets
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Details */}
          <div className="md:w-1/2 p-6 space-y-5 overflow-y-auto">
            {/* Brand header */}
            <div className="flex items-center gap-3 pr-8">
              {ad.brand.profilePicUrl ? (
                <img src={ad.brand.profilePicUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
              ) : (
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                  darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
                }`}>
                  {ad.brand.pageName?.[0] || '?'}
                </div>
              )}
              <div className="min-w-0">
                <Link
                  href={`/dashboard/v2/ad-library/${ad.brand.pageId}`}
                  className="text-base font-bold truncate block hover:text-[#1235e2] transition-colors"
                >
                  {ad.brand.pageName}
                </Link>
                {ad.brand.category && (
                  <span className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {ad.brand.category}
                  </span>
                )}
              </div>
            </div>

            {/* Ad copy */}
            <div className={`space-y-2 pt-4 border-t ${sectionBorder}`}>
              {ad.body && (
                <p className={`text-sm leading-relaxed ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  {ad.body}
                </p>
              )}
              {ad.title && ad.title !== ad.body && (
                <p className={`text-sm font-semibold ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                  {ad.title}
                </p>
              )}
              {ad.caption && (
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {ad.caption}
                </p>
              )}
              {ad.linkDescription && (
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {ad.linkDescription}
                </p>
              )}
            </div>

            {/* Stats grid */}
            <div className={`grid grid-cols-2 gap-4 pt-4 border-t ${sectionBorder}`}>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Users className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={labelClass}>Reach</span>
                </div>
                <p className={valueClass}>{ad.reachEstimate ? formatNumber(ad.reachEstimate) : 'N/A'}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={labelClass}>Spend</span>
                </div>
                <p className={valueClass}>{formatSpend()}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Eye className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={labelClass}>Impressions</span>
                </div>
                <p className={valueClass}>{formatImpressions()}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={labelClass}>Duration</span>
                </div>
                <p className={valueClass}>{ad.adDurationDays != null ? `${ad.adDurationDays} days` : 'N/A'}</p>
              </div>
            </div>

            {/* Dates */}
            <div className={`flex items-center gap-4 pt-4 border-t ${sectionBorder}`}>
              <Calendar className={`w-4 h-4 shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <div className="flex gap-4 text-sm">
                <div>
                  <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>Start: </span>
                  <span className={`font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {formatDate(ad.startDate) || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>End: </span>
                  <span className={`font-medium ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                    {ad.endDate ? formatDate(ad.endDate) : (ad.isActive ? 'Ongoing' : 'N/A')}
                  </span>
                </div>
              </div>
            </div>

            {/* Platforms */}
            {ad.publisherPlatforms && ad.publisherPlatforms.length > 0 && (
              <div className={`pt-4 border-t ${sectionBorder}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Globe className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={labelClass}>Platforms</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ad.publisherPlatforms.map(p => (
                    <span
                      key={p}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${
                        darkMode ? 'bg-[#1235e2]/10 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Classification */}
            {ad.classification && (
              <div className={`pt-4 border-t ${sectionBorder}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={labelClass}>AI Classification</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_KEYS.map((key) => {
                    const value = ad.classification![key as keyof typeof ad.classification];
                    if (!value) return null;
                    const color = CATEGORY_COLORS[key];
                    const labels = TAXONOMY[key].labels as Record<string, string>;
                    const humanLabel = labels[value] || value;
                    return (
                      <span
                        key={key}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        <span className="opacity-60">{CATEGORY_SHORT_LABELS[key]}:</span>
                        {humanLabel}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CTA & Link */}
            {(ad.ctaText || ad.linkUrl) && (
              <div className={`pt-4 border-t ${sectionBorder}`}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Link2 className={`w-3.5 h-3.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  <span className={labelClass}>Call to Action</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {ad.ctaText && (
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-[#1235e2]/10 text-[#1235e2]'
                    }`}>
                      {ad.ctaText}
                    </span>
                  )}
                  {ad.linkUrl && (
                    <a
                      href={ad.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#1235e2] hover:underline truncate max-w-[200px]"
                    >
                      {ad.linkUrl}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Partnership */}
            {ad.bylines && (
              <div className={`pt-4 border-t ${sectionBorder}`}>
                <div className="flex items-center gap-2">
                  <Users className={`w-4 h-4 text-purple-400`} />
                  <span className={`text-sm font-medium ${darkMode ? 'text-purple-300' : 'text-purple-600'}`}>
                    Partnership: {ad.bylines}
                  </span>
                </div>
              </div>
            )}

            {/* Demographics (Gender + Age) */}
            {renderDemographicsSection()}

            {/* Geographic Reach */}
            {renderGeoSection()}

            {/* Action buttons */}
            <div className={`flex gap-3 pt-4 border-t ${sectionBorder}`}>
              <button
                onClick={() => onToggleSave(ad.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  isSaved
                    ? darkMode
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-red-50 text-red-500 hover:bg-red-100'
                    : darkMode
                      ? 'bg-[#1235e2]/10 text-[#1235e2] hover:bg-[#1235e2]/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                {isSaved ? 'Saved' : 'Save Ad'}
              </button>
              {ad.snapshotUrl && (
                <a
                  href={ad.snapshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    darkMode
                      ? 'bg-[#1235e2]/10 text-[#1235e2] hover:bg-[#1235e2]/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  View on Meta
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
