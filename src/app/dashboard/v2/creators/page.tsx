'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  TrendingUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  Megaphone,
  X,
  Globe,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Partnership {
  brandPageId: string;
  brandName: string;
  brandProfilePic: string | null;
  brandCategory: string | null;
  brandCountry: string | null;
  adCount: number;
  totalReach: number;
}

interface Creator {
  id: string;
  pageId: string;
  pageName: string;
  totalAds: number;
  totalReach: number;
  brandCount: number;
  reachPerAd: number;
  partnerships: Partnership[];
}

interface FilterBrand {
  id: string;
  pageId: string;
  name: string;
}

interface Filters {
  countries: string[];
  categories: string[];
  brands: FilterBrand[];
}

interface Summary {
  totalCreators: number;
  totalReach: number;
  totalAds: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SORT_OPTIONS = [
  { value: 'reach', label: 'Highest Reach' },
  { value: 'brands', label: 'Most Brands' },
  { value: 'ads', label: 'Most Ads' },
  { value: 'name', label: 'Name' },
] as const;

const REACH_RANGES = [
  { value: '', label: 'Any reach' },
  { value: '1000', label: '1K+' },
  { value: '10000', label: '10K+' },
  { value: '50000', label: '50K+' },
  { value: '100000', label: '100K+' },
  { value: '500000', label: '500K+' },
  { value: '1000000', label: '1M+' },
] as const;

const COUNTRY_FLAGS: Record<string, string> = {
  SE: '🇸🇪', NO: '🇳🇴', DK: '🇩🇰', FI: '🇫🇮', GB: '🇬🇧', US: '🇺🇸',
  DE: '🇩🇪', FR: '🇫🇷', NL: '🇳🇱', AT: '🇦🇹', BE: '🇧🇪', ES: '🇪🇸',
  IT: '🇮🇹', PT: '🇵🇹', IE: '🇮🇪', CH: '🇨🇭', AU: '🇦🇺', CA: '🇨🇦',
  PL: '🇵🇱', CZ: '🇨🇿', HU: '🇭🇺', RO: '🇷🇴', GR: '🇬🇷', HR: '🇭🇷',
  BG: '🇧🇬', SK: '🇸🇰', SI: '🇸🇮', EE: '🇪🇪', LV: '🇱🇻', LT: '🇱🇹',
  LU: '🇱🇺', MT: '🇲🇹', CY: '🇨🇾', IS: '🇮🇸',
  BR: '🇧🇷', MX: '🇲🇽', AR: '🇦🇷', CO: '🇨🇴', CL: '🇨🇱',
  JP: '🇯🇵', KR: '🇰🇷', IN: '🇮🇳', SG: '🇸🇬', HK: '🇭🇰',
  ZA: '🇿🇦', NG: '🇳🇬', AE: '🇦🇪', SA: '🇸🇦', IL: '🇮🇱',
  NZ: '🇳🇿', TW: '🇹🇼', PH: '🇵🇭', MY: '🇲🇾', ID: '🇮🇩', TH: '🇹🇭',
};

function getFlag(code: string | null): string {
  if (!code) return '🌍';
  return COUNTRY_FLAGS[code.toUpperCase()] || '🌍';
}

// ---------------------------------------------------------------------------
// Creator Detail Lightbox
// ---------------------------------------------------------------------------

interface CreatorAd {
  adId: string | null;
  snapshotUrl: string | null;
  mediaUrl: string | null;
  mediaType: 'image' | 'video';
  body: string | null;
  title: string | null;
  brandName: string;
  brandPageId: string;
  brandProfilePic: string | null;
}

function CreatorLightbox({ creator, darkMode, onClose }: { creator: Creator; darkMode: boolean; onClose: () => void }) {
  const countries = [...new Set(creator.partnerships.map(p => p.brandCountry).filter(Boolean))] as string[];
  const [ads, setAds] = useState<CreatorAd[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/ad-library/creators/ads?creatorId=${creator.id}&limit=12`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setAds(data.ads || []))
      .catch(() => {})
      .finally(() => setAdsLoading(false));
  }, [creator.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl ${
          darkMode ? 'bg-[#101322] border-[#1235e2]/20' : 'bg-white border-slate-200'
        }`}
      >
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-1.5 rounded-lg z-10 transition-colors ${
            darkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
              darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-[#1235e2]/10 text-[#1235e2]'
            }`}>
              {creator.pageName?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-lg font-bold">{creator.pageName}</h2>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {creator.brandCount} brand partnership{creator.brandCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <a
            href={`https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${creator.pageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#1235e2] text-white hover:bg-[#0f2dc5] transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View in Meta Ad Library
          </a>
        </div>

        <div className="p-6">
          <div className={`grid grid-cols-3 gap-3 p-4 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
            {[
              { label: 'Total Reach', value: formatNumber(creator.totalReach) },
              { label: 'Ads', value: String(creator.totalAds) },
              { label: 'Reach/Ad', value: formatNumber(creator.reachPerAd) },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</p>
                <p className="text-sm font-bold mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>

          {countries.length > 0 && (
            <div className="mt-5">
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Markets
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {countries.map((code) => (
                  <span key={code} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                    darkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {getFlag(code)} {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Partnership Ads */}
          <div className="mt-5">
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Partnership Ads ({ads.length})
            </h3>
            {adsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className={`h-64 rounded-xl animate-pulse ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`} />
                ))}
              </div>
            ) : ads.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {ads.filter(ad => ad.mediaUrl).map((ad, idx) => (
                  <div
                    key={ad.adId || idx}
                    className={`rounded-xl border overflow-hidden ${
                      darkMode ? 'border-[#1235e2]/10' : 'border-slate-200'
                    }`}
                  >
                    <div className="relative aspect-[9/16] overflow-hidden">
                      {ad.mediaType === 'video' ? (
                        <video
                          src={ad.mediaUrl!}
                          controls
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                      ) : (
                        <img
                          src={ad.mediaUrl!}
                          alt={`Ad by ${ad.brandName}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      )}
                    </div>
                    <div className={`px-2.5 py-2 space-y-1 border-t ${
                      darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'
                    }`}>
                      {ad.title && (
                        <p className={`text-[11px] font-semibold leading-tight line-clamp-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{ad.title}</p>
                      )}
                      {ad.body && (
                        <p className={`text-[10px] leading-snug line-clamp-3 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{ad.body}</p>
                      )}
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[10px] font-medium truncate opacity-60">{ad.brandName}</span>
                        {ad.adId && (
                          <a
                            href={`https://www.facebook.com/ads/library/?id=${ad.adId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[9px] font-semibold text-[#1235e2] hover:underline shrink-0 ml-1"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>No partnership ads found in database</p>
            )}
          </div>

          {/* Brand Partnerships */}
          <div className="mt-5">
            <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Brand Partnerships ({creator.brandCount})
            </h3>
            <div className="space-y-1">
              {creator.partnerships.map((p) => (
                <Link
                  key={p.brandPageId}
                  href={`/dashboard/v2/ad-library/${p.brandPageId}`}
                  onClick={onClose}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                  }`}
                >
                  {p.brandProfilePic ? (
                    <img src={p.brandProfilePic} alt="" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                      darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {p.brandName?.[0] || '?'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{p.brandName}</p>
                    <div className={`flex items-center gap-2 text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      {p.brandCategory && <span>{p.brandCategory}</span>}
                      {p.brandCountry && <span>{getFlag(p.brandCountry)} {p.brandCountry}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold">{formatNumber(p.totalReach)}</p>
                    <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{p.adCount} ads</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Creator Card
// ---------------------------------------------------------------------------

function CreatorCard({ creator, darkMode, onClick }: { creator: Creator; darkMode: boolean; onClick: () => void }) {
  const countries = [...new Set(creator.partnerships.map(p => p.brandCountry).filter(Boolean))] as string[];

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border transition-all hover:shadow-lg ${
        darkMode
          ? 'bg-[#1235e2]/5 border-[#1235e2]/10 hover:border-[#1235e2]/40'
          : 'bg-white border-slate-200 hover:border-[#1235e2]/40'
      }`}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 text-slate-600'
          }`}>
            {creator.pageName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">{creator.pageName}</h3>
            <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {creator.brandCount} brand{creator.brandCount !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className={`grid grid-cols-3 gap-3 py-3 border-t border-b ${
          darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'
        }`}>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Reach</p>
            <p className="text-sm font-bold">{formatNumber(creator.totalReach)}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Ads</p>
            <p className="text-sm font-bold">{creator.totalAds}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Reach/Ad</p>
            <p className="text-sm font-bold">{formatNumber(creator.reachPerAd)}</p>
          </div>
        </div>

        <div className={`flex items-center justify-between mt-3`}>
          <div className="flex items-center gap-0.5">
            {countries.slice(0, 5).map((code) => (
              <span key={code} className="text-sm" title={code}>{getFlag(code)}</span>
            ))}
            {countries.length > 5 && (
              <span className={`text-[10px] ml-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                +{countries.length - 5}
              </span>
            )}
            {countries.length === 0 && (
              <span className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>🌍 Global</span>
            )}
          </div>
          <span className={`flex items-center gap-1 text-[10px] font-semibold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <TrendingUp className="w-3 h-3" />
            {formatNumber(creator.reachPerAd)}/ad
          </span>
        </div>

        <div className="flex items-center gap-1 mt-3">
          {creator.partnerships.slice(0, 5).map((p) => (
            p.brandProfilePic ? (
              <img key={p.brandPageId} src={p.brandProfilePic} alt={p.brandName} title={p.brandName}
                className="w-5 h-5 rounded object-cover shrink-0" />
            ) : (
              <div key={p.brandPageId} title={p.brandName}
                className={`w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold shrink-0 ${
                  darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-slate-100 text-slate-500'
                }`}>
                {p.brandName?.[0] || '?'}
              </div>
            )
          ))}
          {creator.partnerships.length > 5 && (
            <span className={`text-[10px] ml-1 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              +{creator.partnerships.length - 5}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CreatorsPage() {
  const { darkMode } = useV2();

  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);

  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [sortBy, setSortBy] = useState('reach');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [minBrands, setMinBrands] = useState(0);
  const [minReach, setMinReach] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounce, countryFilter, categoryFilter, brandFilter, sortBy, sortOrder, minBrands, minReach]);

  const fetchCreators = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '24',
        sortBy,
        sortOrder,
      });
      if (searchDebounce) params.set('search', searchDebounce);
      if (countryFilter) params.set('country', countryFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (brandFilter) params.set('brandId', brandFilter);
      if (minBrands > 0) params.set('minBrands', String(minBrands));
      if (minReach) params.set('minReach', minReach);

      const res = await fetch(`/api/ad-library/creators?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      setCreators(data.creators || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
      setFilters(data.filters || null);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Failed to fetch creators:', err);
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounce, countryFilter, categoryFilter, brandFilter, sortBy, sortOrder, minBrands, minReach]);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  const activeFilterCount = [countryFilter, categoryFilter, brandFilter, minBrands > 0, minReach].filter(Boolean).length;

  return (
    <V2Shell title="Creators & Partnerships">
      {summary && summary.totalCreators > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Creators', value: formatNumber(summary.totalCreators), icon: Users },
            { label: 'Total Reach', value: formatNumber(summary.totalReach), icon: TrendingUp },
            { label: 'Partnership Ads', value: formatNumber(summary.totalAds), icon: Megaphone },
          ].map((stat) => (
            <V2Card key={stat.label}>
              <div className="flex items-center gap-3 p-4">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-[#1235e2]/10' : 'bg-[#1235e2]/5'}`}>
                  <stat.icon className="w-4 h-4 text-[#1235e2]" />
                </div>
                <div>
                  <p className={`text-[10px] uppercase font-bold tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {stat.label}
                  </p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              </div>
            </V2Card>
          ))}
        </div>
      )}

      <V2Card>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search creators..."
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm border transition-colors ${
                darkMode
                  ? 'bg-white/5 border-[#1235e2]/10 text-white placeholder:text-slate-500 focus:border-[#1235e2]/40'
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#1235e2]/40'
              } focus:outline-none`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Filter className={`w-3 h-3 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />

            <select
              value={minReach}
              onChange={(e) => setMinReach(e.target.value)}
              className={`text-xs font-semibold px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                darkMode ? 'bg-white/5 border-[#1235e2]/10 text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {REACH_RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            {filters && filters.brands.length > 0 && (
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className={`text-xs font-semibold px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  darkMode ? 'bg-white/5 border-[#1235e2]/10 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="">All Brands</option>
                {filters.brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            {filters && filters.categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className={`text-xs font-semibold px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  darkMode ? 'bg-white/5 border-[#1235e2]/10 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="">All Categories</option>
                {filters.categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}

            {filters && filters.countries.length > 0 && (
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className={`text-xs font-semibold px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  darkMode ? 'bg-white/5 border-[#1235e2]/10 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                <option value="">All Countries</option>
                {filters.countries.map((c) => (
                  <option key={c} value={c}>{getFlag(c)} {c}</option>
                ))}
              </select>
            )}

            <select
              value={minBrands}
              onChange={(e) => setMinBrands(parseInt(e.target.value))}
              className={`text-xs font-semibold px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                darkMode ? 'bg-white/5 border-[#1235e2]/10 text-white' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              <option value="0">Any # brands</option>
              <option value="2">2+ brands</option>
              <option value="3">3+ brands</option>
              <option value="5">5+ brands</option>
            </select>

            <div className="ml-auto flex items-center gap-1">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={`text-xs font-semibold px-2 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  darkMode ? 'bg-white/5 border-[#1235e2]/10 text-white' : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                className={`p-1.5 rounded-lg border transition-colors ${
                  darkMode ? 'border-[#1235e2]/10 hover:bg-white/5 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-500'
                }`}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeFilterCount > 0 && (
              <button
                onClick={() => {
                  setCountryFilter('');
                  setCategoryFilter('');
                  setBrandFilter('');
                  setMinBrands(0);
                  setMinReach('');
                }}
                className="text-[10px] font-bold text-[#1235e2] hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {total} creator{total !== 1 ? 's' : ''} found
          </div>
        </div>
      </V2Card>

      {!loading && creators.length === 0 && (
        <V2Card>
          <div className="p-12 text-center">
            <Users className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
            <h3 className="text-lg font-bold mb-2">No creators found</h3>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {search || countryFilter || minReach
                ? 'Try adjusting your filters or search query.'
                : 'Creator partnership data is being scraped — check back soon.'}
            </p>
          </div>
        </V2Card>
      )}

      {loading && <V2Skeleton rows={6} />}

      {!loading && creators.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
          {creators.map((creator) => (
            <CreatorCard
              key={creator.id}
              creator={creator}
              darkMode={darkMode}
              onClick={() => setSelectedCreator(creator)}
            />
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className={`p-2 rounded-lg border transition-colors ${
              page <= 1 ? 'opacity-30 cursor-not-allowed'
                : darkMode ? 'border-[#1235e2]/10 hover:bg-white/5 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-500'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
            darkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'
          }`}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className={`p-2 rounded-lg border transition-colors ${
              page >= totalPages ? 'opacity-30 cursor-not-allowed'
                : darkMode ? 'border-[#1235e2]/10 hover:bg-white/5 text-slate-400' : 'border-slate-200 hover:bg-slate-50 text-slate-500'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {selectedCreator && (
        <CreatorLightbox
          creator={selectedCreator}
          darkMode={darkMode}
          onClose={() => setSelectedCreator(null)}
        />
      )}
    </V2Shell>
  );
}
