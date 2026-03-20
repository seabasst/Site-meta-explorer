'use client';

import Link from 'next/link';
import {
  Play,
  Image as ImageIcon,
  Layers,
  ExternalLink,
  Users,
  Heart,
} from 'lucide-react';
import { formatNumber } from '../../v2-shell';
import { Ad, formatFormatLabel } from '../types';

export function AdCard({ ad, darkMode, isSaved, onToggleSave, compact, onSelect }: { ad: Ad; darkMode: boolean; isSaved?: boolean; onToggleSave?: (adId: string) => void; compact?: boolean; onSelect?: () => void }) {
  // Find the best available asset (prefer completed R2 downloads)
  const primaryAsset = ad.assets?.find(a => a.downloadStatus === 'completed' && a.storedUrl);

  const formatIcon = () => {
    switch (ad.displayFormat) {
      case 'video': return <Play className="w-3 h-3" />;
      case 'carousel': return <Layers className="w-3 h-3" />;
      default: return <ImageIcon className="w-3 h-3" />;
    }
  };

  const renderPreview = () => {
    // 1. R2-stored asset (best quality)
    if (primaryAsset?.storedUrl) {
      if (primaryAsset.assetType === 'video') {
        return (
          <video
            src={primaryAsset.storedUrl}
            poster={primaryAsset.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            controls
            muted
            loop
            playsInline
            preload="metadata"
          />
        );
      }
      return (
        <img
          src={primaryAsset.storedUrl}
          alt={ad.title || 'Ad creative'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      );
    }

    // 2. Fallback: show body text
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <ImageIcon className={`w-8 h-8 mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
        <p className={`text-xs text-center line-clamp-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {ad.body || ad.title || 'No preview available'}
        </p>
      </div>
    );
  };

  return (
    <div
      onClick={onSelect}
      className={`group rounded-xl overflow-hidden border transition-all hover:shadow-lg ${
        onSelect ? 'cursor-pointer' : ''
      } ${
        darkMode
          ? 'bg-[#1235e2]/5 border-[#1235e2]/10 hover:border-[#1235e2]/40'
          : 'bg-white border-slate-200 hover:border-[#1235e2]/40'
      }`}>
      {/* Preview */}
      <div
        className={`relative ${compact ? 'aspect-square' : 'aspect-[4/5]'} overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
        onClick={e => { if ((e.target as HTMLElement).closest('video')) e.stopPropagation(); }}
      >
        {renderPreview()}

        {/* Format badge - top right */}
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold uppercase tracking-wide flex items-center gap-1 z-10">
          {formatIcon()}
          {formatFormatLabel(ad.displayFormat)}
        </div>

        {/* Status badge - top left */}
        <div className={`absolute top-2 left-2 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase z-10 ${
          ad.isActive ? 'bg-green-500/80' : 'bg-slate-500/80'
        }`}>
          {ad.isActive ? 'Active' : 'Ended'}
        </div>

        {/* Partnership badge */}
        {ad.bylines && (
          <div className="absolute top-9 left-2 bg-purple-500/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase z-10 flex items-center gap-1">
            <Users className="w-2.5 h-2.5" />
            Partnership
          </div>
        )}

      </div>

      {/* Card Info */}
      <div className="p-4">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-3 min-w-0">
          {ad.brand.profilePicUrl ? (
            <img src={ad.brand.profilePicUrl} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
          ) : (
            <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0 ${
              darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
            }`}>
              {ad.brand.pageName?.[0] || '?'}
            </div>
          )}
          <Link
            href={`/dashboard/v2/ad-library/${ad.brand.pageId}`}
            className="text-sm font-bold truncate hover:text-[#1235e2] transition-colors"
            onClick={e => e.stopPropagation()}
          >
            {ad.brand.pageName}
          </Link>
        </div>

        {/* Body preview */}
        {ad.body && (
          <p className={`text-xs mb-3 line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {ad.body}
          </p>
        )}

        {/* Stats */}
        <div className={`grid grid-cols-2 gap-2 pt-3 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Reach</p>
            <p className="text-sm font-bold">{ad.reachEstimate ? formatNumber(ad.reachEstimate) : 'N/A'}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Platform</p>
            <p className="text-sm font-bold capitalize">
              {ad.publisherPlatforms?.[0]?.replace('_', ' ') || 'Unknown'}
            </p>
          </div>
        </div>
        {onToggleSave && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSave(ad.id); }}
            className={`flex items-center justify-center gap-1.5 w-full mt-3 pt-3 border-t text-xs font-semibold transition-colors ${
              isSaved
                ? darkMode ? 'border-[#1235e2]/10 text-red-400 hover:text-red-300' : 'border-slate-100 text-red-500 hover:text-red-400'
                : darkMode ? 'border-[#1235e2]/10 text-slate-400 hover:text-[#1235e2]' : 'border-slate-100 text-slate-500 hover:text-[#1235e2]'
            }`}
          >
            <Heart className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
            {isSaved ? 'Saved' : 'Save Ad'}
          </button>
        )}
        {ad.snapshotUrl && (
          <a href={ad.snapshotUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className={`flex items-center justify-center gap-1.5 mt-2 pt-2 border-t text-xs font-semibold transition-colors ${
              darkMode ? 'border-[#1235e2]/10 text-slate-400 hover:text-[#1235e2]' : 'border-slate-100 text-slate-500 hover:text-[#1235e2]'
            }`}>
            <ExternalLink className="w-3 h-3" /> View on Meta
          </a>
        )}
      </div>
    </div>
  );
}
