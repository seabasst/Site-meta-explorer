'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Megaphone } from 'lucide-react';
import { V2Card, formatNumber } from '@/app/dashboard/v2/v2-shell';
import { useV2 } from '@/app/dashboard/v2/v2-context';

interface PartnershipBrand {
  brandId: string;
  brandPageId: string;
  brandName: string;
  partnershipAds: number;
  creatorCount: number;
  totalReach: number;
}

export function TopPartnershipBrands() {
  const { darkMode } = useV2();
  const [brands, setBrands] = useState<PartnershipBrand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ad-library/creators/top-brands')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setBrands(data.brands || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <V2Card className="p-6">
        <div className={`animate-pulse space-y-3`}>
          <div className={`h-5 w-48 rounded ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-10 rounded ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`} />
          ))}
        </div>
      </V2Card>
    );
  }

  if (brands.length === 0) return null;

  return (
    <V2Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone className="w-4 h-4 text-[#1235e2]" />
        <h3 className="text-sm font-bold">Top Brands by Creator Partnerships</h3>
      </div>
      <div className="space-y-1">
        {brands.map((brand, i) => (
          <Link
            key={brand.brandId}
            href={`/dashboard/v2/creators?brandId=${brand.brandId}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
            }`}
          >
            <span className={`w-5 text-xs font-bold text-right ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{brand.brandName}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="text-xs font-bold">{brand.partnershipAds}</p>
                <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>ads</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {brand.creatorCount}
                </p>
                <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>creators</p>
              </div>
              <div className="text-right w-16">
                <p className="text-xs font-bold">{formatNumber(brand.totalReach)}</p>
                <p className={`text-[10px] ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>reach</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/dashboard/v2/creators"
        className="block mt-3 text-center text-xs font-semibold text-[#1235e2] hover:underline"
      >
        View all creators →
      </Link>
    </V2Card>
  );
}
