'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Heart,
  Play,
  Image as ImageIcon,
  Layers,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

interface Ad {
  id: string;
  adId: string;
  displayFormat: string | null;
  publisherPlatforms: string[];
  body: string | null;
  caption: string | null;
  title: string | null;
  snapshotUrl: string | null;
  startDate: string | null;
  isActive: boolean;
  reachEstimate: number | null;
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
  savedAt?: string;
}

export default function SavedAdsPage() {
  const { darkMode } = useV2();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchSaved = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ad-library/saved?page=${page}&limit=24`);
      if (res.ok) {
        const data = await res.json();
        setAds(data.ads || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch saved ads:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const unsaveAd = async (adId: string) => {
    setAds((prev) => prev.filter((a) => a.id !== adId));
    setTotal((prev) => prev - 1);
    try {
      await fetch('/api/ad-library/saved', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId }),
      });
    } catch {
      fetchSaved(); // Revert on error
    }
  };

  if (loading) {
    return (
      <V2Shell title="Saved Ads">
        <V2Skeleton rows={4} />
      </V2Shell>
    );
  }

  return (
    <V2Shell title="Saved Ads">
      <V2SectionTitle
        icon={<Heart className="w-5 h-5 text-red-500" />}
        action={
          <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {total} saved ad{total !== 1 ? 's' : ''}
          </span>
        }
      >
        Your Collection
      </V2SectionTitle>

      {ads.length === 0 ? (
        <V2Card className="p-12 text-center">
          <Heart className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
            No saved ads yet
          </p>
          <p className={`mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Browse the ad library and click the heart icon to save ads you like.
          </p>
          <Link
            href="/dashboard/v2/ad-library"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2bc4] transition-colors"
          >
            Browse Ad Library
          </Link>
        </V2Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ads.map((ad) => (
              <SavedAdCard key={ad.id} ad={ad} darkMode={darkMode} onUnsave={unsaveAd} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
                  darkMode
                    ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
                  darkMode
                    ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}
    </V2Shell>
  );
}

function SavedAdCard({ ad, darkMode, onUnsave }: { ad: Ad; darkMode: boolean; onUnsave: (adId: string) => void }) {
  const primaryAsset = ad.assets?.find((a) => a.downloadStatus === 'completed' && a.storedUrl);
  const isFacebookRender = ad.snapshotUrl?.includes('render_ad');

  const renderPreview = () => {
    if (primaryAsset?.storedUrl) {
      if (primaryAsset.assetType === 'video') {
        return (
          <video
            src={primaryAsset.storedUrl}
            poster={primaryAsset.thumbnailUrl || undefined}
            className="w-full h-full object-cover"
            controls muted loop playsInline preload="metadata"
          />
        );
      }
      return (
        <img src={primaryAsset.storedUrl} alt={ad.title || 'Ad creative'} className="w-full h-full object-cover" loading="lazy" />
      );
    }
    if (ad.snapshotUrl && isFacebookRender) {
      return (
        <iframe src={ad.snapshotUrl} sandbox="allow-scripts allow-same-origin" className="w-full h-full border-0 pointer-events-none" loading="lazy" title={ad.title || 'Ad preview'} />
      );
    }
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4">
        <ImageIcon className={`w-8 h-8 mb-3 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
        <p className={`text-xs text-center line-clamp-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {ad.body || ad.title || 'No preview available'}
        </p>
      </div>
    );
  };

  const formatIcon = () => {
    switch (ad.displayFormat) {
      case 'video': return <Play className="w-3 h-3" />;
      case 'carousel': return <Layers className="w-3 h-3" />;
      default: return <ImageIcon className="w-3 h-3" />;
    }
  };

  return (
    <div className={`group rounded-xl overflow-hidden border transition-all hover:shadow-lg ${
      darkMode
        ? 'bg-[#1235e2]/5 border-[#1235e2]/10 hover:border-[#1235e2]/40'
        : 'bg-white border-slate-200 hover:border-[#1235e2]/40'
    }`}>
      <div className={`relative aspect-[4/5] overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {renderPreview()}

        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white font-bold uppercase tracking-wide flex items-center gap-1 z-10">
          {formatIcon()}
          {ad.displayFormat || 'Unknown'}
        </div>

        <div className={`absolute top-2 left-2 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-white font-bold uppercase z-10 ${
          ad.isActive ? 'bg-green-500/80' : 'bg-slate-500/80'
        }`}>
          {ad.isActive ? 'Active' : 'Ended'}
        </div>

        <button
          onClick={() => onUnsave(ad.id)}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center z-10 bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
        >
          <Heart className="w-4 h-4 fill-current" />
        </button>
      </div>

      <div className="p-4">
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
          >
            {ad.brand.pageName}
          </Link>
        </div>

        {ad.body && (
          <p className={`text-xs mb-3 line-clamp-2 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {ad.body}
          </p>
        )}

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
        {ad.snapshotUrl && (
          <a href={ad.snapshotUrl} target="_blank" rel="noopener noreferrer"
            className={`flex items-center justify-center gap-1.5 mt-3 pt-3 border-t text-xs font-semibold transition-colors ${
              darkMode ? 'border-[#1235e2]/10 text-slate-400 hover:text-[#1235e2]' : 'border-slate-100 text-slate-500 hover:text-[#1235e2]'
            }`}>
            <ExternalLink className="w-3 h-3" /> View on Meta
          </a>
        )}
      </div>
    </div>
  );
}
