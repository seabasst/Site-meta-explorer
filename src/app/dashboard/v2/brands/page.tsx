'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Eye,
  EyeOff,
  BarChart3,
  Globe,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

interface Brand {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  category: string | null;
  country: string | null;
  activeAdCount: number;
  totalReach: number;
  website: string | null;
  monitoredSince?: string;
}

export default function BrandsPage() {
  const { darkMode } = useV2();

  // Tabs
  const [tab, setTab] = useState<'monitored' | 'browse'>('monitored');

  // Monitored brands
  const [monitored, setMonitored] = useState<Brand[]>([]);
  const [monitoredLoading, setMonitoredLoading] = useState(true);
  const [monitoredTotal, setMonitoredTotal] = useState(0);

  // Browse brands
  const [brands, setBrands] = useState<Brand[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browsePage, setBrowsePage] = useState(1);
  const [browseTotalPages, setBrowseTotalPages] = useState(1);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseSearchDebounce, setBrowseSearchDebounce] = useState('');
  const [monitoredIds, setMonitoredIds] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setBrowseSearchDebounce(browseSearch), 400);
    return () => clearTimeout(timer);
  }, [browseSearch]);

  // Fetch monitored brands
  const fetchMonitored = useCallback(async () => {
    setMonitoredLoading(true);
    try {
      const res = await fetch('/api/ad-library/brands/monitor?limit=100');
      if (res.ok) {
        const data = await res.json();
        setMonitored(data.brands || []);
        setMonitoredTotal(data.pagination?.total || 0);
        setMonitoredIds(new Set((data.brands || []).map((b: Brand) => b.id)));
      }
    } catch (err) {
      console.error('Failed to fetch monitored brands:', err);
    } finally {
      setMonitoredLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitored();
  }, [fetchMonitored]);

  // Fetch browse brands
  const fetchBrands = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(browsePage),
        limit: '24',
        sortBy: 'activeAdCount',
        sortOrder: 'desc',
      });
      if (browseSearchDebounce.trim()) {
        params.set('search', browseSearchDebounce.trim());
      }
      const res = await fetch(`/api/ad-library/brands?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBrands(data.brands || []);
        setBrowseTotalPages(data.pagination?.totalPages || 1);

        // Check which are monitored
        const ids = (data.brands || []).map((b: Brand) => b.id);
        if (ids.length > 0) {
          try {
            const checkRes = await fetch('/api/ad-library/brands/monitor/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ brandIds: ids }),
            });
            if (checkRes.ok) {
              const { monitoredBrandIds } = await checkRes.json();
              setMonitoredIds((prev) => {
                const next = new Set(prev);
                monitoredBrandIds.forEach((id: string) => next.add(id));
                return next;
              });
            }
          } catch { /* non-critical */ }
        }
      }
    } catch (err) {
      console.error('Failed to fetch brands:', err);
    } finally {
      setBrowseLoading(false);
    }
  }, [browsePage, browseSearchDebounce]);

  useEffect(() => {
    if (tab === 'browse') fetchBrands();
  }, [tab, fetchBrands]);

  useEffect(() => {
    setBrowsePage(1);
  }, [browseSearchDebounce]);

  const toggleMonitor = async (brandId: string) => {
    const isMonitored = monitoredIds.has(brandId);
    // Optimistic update
    setMonitoredIds((prev) => {
      const next = new Set(prev);
      if (isMonitored) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
    if (isMonitored) {
      setMonitored((prev) => prev.filter((b) => b.id !== brandId));
      setMonitoredTotal((prev) => prev - 1);
    }
    try {
      await fetch('/api/ad-library/brands/monitor', {
        method: isMonitored ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId }),
      });
      if (!isMonitored) fetchMonitored(); // Refresh to get full brand data
    } catch {
      // Revert
      setMonitoredIds((prev) => {
        const next = new Set(prev);
        if (isMonitored) next.add(brandId);
        else next.delete(brandId);
        return next;
      });
      if (isMonitored) fetchMonitored();
    }
  };

  return (
    <V2Shell title="Brands">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6">
        <button
          onClick={() => setTab('monitored')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'monitored'
              ? 'bg-[#1235e2] text-white'
              : darkMode ? 'text-slate-400 hover:bg-[#1235e2]/10' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Monitored ({monitoredTotal})
        </button>
        <button
          onClick={() => setTab('browse')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'browse'
              ? 'bg-[#1235e2] text-white'
              : darkMode ? 'text-slate-400 hover:bg-[#1235e2]/10' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Browse All
        </button>
      </div>

      {tab === 'monitored' && (
        <>
          <V2SectionTitle icon={<Eye className="w-5 h-5 text-[#1235e2]" />}>
            Monitored Brands
          </V2SectionTitle>

          {monitoredLoading ? (
            <V2Skeleton rows={3} />
          ) : monitored.length === 0 ? (
            <V2Card className="p-12 text-center">
              <Users className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`text-lg font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                No monitored brands yet
              </p>
              <p className={`mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Browse brands and click the eye icon to start monitoring them.
              </p>
              <button
                onClick={() => setTab('browse')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1235e2] text-white rounded-lg text-sm font-medium hover:bg-[#0f2bc4] transition-colors"
              >
                Browse Brands
              </button>
            </V2Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monitored.map((brand) => (
                <BrandCard
                  key={brand.id}
                  brand={brand}
                  darkMode={darkMode}
                  isMonitored={true}
                  onToggleMonitor={toggleMonitor}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'browse' && (
        <>
          {/* Search */}
          <V2Card className="p-4 mb-6">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              darkMode ? 'bg-slate-800' : 'bg-slate-50'
            }`}>
              <Search className={`w-4 h-4 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                value={browseSearch}
                onChange={(e) => setBrowseSearch(e.target.value)}
                placeholder="Search brands..."
                className={`flex-1 bg-transparent outline-none text-sm ${
                  darkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          </V2Card>

          {browseLoading ? (
            <V2Skeleton rows={3} />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.map((brand) => (
                  <BrandCard
                    key={brand.id}
                    brand={brand}
                    darkMode={darkMode}
                    isMonitored={monitoredIds.has(brand.id)}
                    onToggleMonitor={toggleMonitor}
                  />
                ))}
              </div>

              {browseTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setBrowsePage((p) => Math.max(1, p - 1))}
                    disabled={browsePage <= 1}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
                      darkMode
                        ? 'bg-[#1235e2]/10 text-slate-300 hover:bg-[#1235e2]/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Page {browsePage} of {browseTotalPages}
                  </span>
                  <button
                    onClick={() => setBrowsePage((p) => Math.min(browseTotalPages, p + 1))}
                    disabled={browsePage >= browseTotalPages}
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
        </>
      )}
    </V2Shell>
  );
}

function BrandCard({
  brand,
  darkMode,
  isMonitored,
  onToggleMonitor,
}: {
  brand: Brand;
  darkMode: boolean;
  isMonitored: boolean;
  onToggleMonitor: (brandId: string) => void;
}) {
  return (
    <V2Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {brand.profilePicUrl ? (
            <img src={brand.profilePicUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
              darkMode ? 'bg-[#1235e2]/20 text-[#1235e2]' : 'bg-[#1235e2]/10 text-[#1235e2]'
            }`}>
              {brand.pageName?.[0] || '?'}
            </div>
          )}
          <div className="min-w-0">
            <Link
              href={`/dashboard/v2/ad-library/${brand.pageId}`}
              className="text-sm font-bold truncate block hover:text-[#1235e2] transition-colors"
            >
              {brand.pageName}
            </Link>
            {brand.category && (
              <p className={`text-xs capitalize ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {brand.category}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => onToggleMonitor(brand.id)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isMonitored
              ? 'bg-[#1235e2] text-white'
              : darkMode
                ? 'bg-[#1235e2]/10 text-slate-400 hover:bg-[#1235e2]/20 hover:text-[#1235e2]'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-[#1235e2]'
          }`}
          title={isMonitored ? 'Stop monitoring' : 'Monitor brand'}
        >
          {isMonitored ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      </div>

      <div className={`grid grid-cols-2 gap-3 pt-3 border-t ${darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'}`}>
        <div>
          <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Active Ads</p>
          <p className="text-sm font-bold">{formatNumber(brand.activeAdCount)}</p>
        </div>
        <div>
          <p className={`text-[10px] uppercase font-bold ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>Total Reach</p>
          <p className="text-sm font-bold">{formatNumber(brand.totalReach)}</p>
        </div>
      </div>

      {brand.country && (
        <div className={`flex items-center gap-1.5 mt-3 pt-3 border-t text-xs ${
          darkMode ? 'border-[#1235e2]/10 text-slate-400' : 'border-slate-100 text-slate-500'
        }`}>
          <Globe className="w-3 h-3" />
          {brand.country}
        </div>
      )}
    </V2Card>
  );
}
