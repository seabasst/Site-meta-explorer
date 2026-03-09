'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plane,
  Car,
  UtensilsCrossed,
  ShoppingBag,
  Sparkles,
  Laptop,
  GraduationCap,
  Heart,
  ArrowRight,
  TrendingUp,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { V2Shell, V2Card, V2SectionTitle, V2Skeleton, formatNumber } from '../v2-shell';
import { useV2 } from '../v2-context';

interface Category {
  slug: string;
  label: string;
  brandCount: number;
  brandsIngested: number;
  ingestionPct: number;
  totalActiveAds: number;
  totalReach: number;
  brands: string[];
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  airline: <Plane className="w-5 h-5" />,
  car_rental: <Car className="w-5 h-5" />,
  fast_food: <UtensilsCrossed className="w-5 h-5" />,
  fashion: <ShoppingBag className="w-5 h-5" />,
  beauty: <Sparkles className="w-5 h-5" />,
  tech: <Laptop className="w-5 h-5" />,
  university: <GraduationCap className="w-5 h-5" />,
  nonprofit: <Heart className="w-5 h-5" />,
};

function getCategoryIcon(slug: string): React.ReactNode {
  return CATEGORY_ICONS[slug] || <Layers className="w-5 h-5" />;
}

export default function CategoriesPage() {
  const { darkMode } = useV2();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) return;
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const totalBrands = categories.reduce((s, c) => s + c.brandCount, 0);
  const totalActiveAds = categories.reduce((s, c) => s + c.totalActiveAds, 0);
  const totalReach = categories.reduce((s, c) => s + c.totalReach, 0);

  return (
    <V2Shell title="Categories">
      {loading ? (
        <V2Skeleton rows={3} />
      ) : categories.length === 0 ? (
        <V2Card className="p-12 text-center">
          <Layers className={`w-12 h-12 mx-auto mb-4 ${darkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          <h3 className="text-lg font-bold mb-2">No categories found</h3>
          <p className={`${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Add brands with categories to see industry analysis.
          </p>
        </V2Card>
      ) : (
        <>
          {/* Overview stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <V2Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-[#1235e2]/10' : 'bg-[#1235e2]/5'}`}>
                  <Layers className="w-5 h-5 text-[#1235e2]" />
                </div>
                <span className={`text-xs uppercase font-bold tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Categories
                </span>
              </div>
              <p className="text-2xl font-black">{categories.length}</p>
            </V2Card>
            <V2Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-[#1235e2]/10' : 'bg-[#1235e2]/5'}`}>
                  <BarChart3 className="w-5 h-5 text-[#1235e2]" />
                </div>
                <span className={`text-xs uppercase font-bold tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total Brands
                </span>
              </div>
              <p className="text-2xl font-black">{totalBrands}</p>
            </V2Card>
            <V2Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-[#1235e2]/10' : 'bg-[#1235e2]/5'}`}>
                  <TrendingUp className="w-5 h-5 text-[#1235e2]" />
                </div>
                <span className={`text-xs uppercase font-bold tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total Reach
                </span>
              </div>
              <p className="text-2xl font-black">{formatNumber(totalReach)}</p>
            </V2Card>
          </div>

          {/* Category grid */}
          <V2SectionTitle icon={<Layers className="w-5 h-5 text-[#1235e2]" />}>
            Industry Categories
          </V2SectionTitle>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <Link key={cat.slug} href={`/dashboard/v2/categories/${cat.slug}`}>
                <V2Card className="p-6 hover:shadow-lg transition-all group cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${darkMode ? 'bg-[#1235e2]/10' : 'bg-[#1235e2]/5'}`}>
                        <div className="text-[#1235e2]">{getCategoryIcon(cat.slug)}</div>
                      </div>
                      <div>
                        <h3 className="text-base font-bold">{cat.label}</h3>
                        <p className={`text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {cat.brandCount} brand{cat.brandCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <ArrowRight
                      className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${
                        darkMode ? 'text-slate-600 group-hover:text-[#1235e2]' : 'text-slate-300 group-hover:text-[#1235e2]'
                      }`}
                    />
                  </div>

                  {/* Stats row */}
                  <div className={`grid grid-cols-3 gap-3 py-3 border-t border-b mb-4 ${
                    darkMode ? 'border-[#1235e2]/10' : 'border-slate-100'
                  }`}>
                    <div>
                      <p className={`text-[10px] uppercase font-bold tracking-wider mb-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Active Ads
                      </p>
                      <p className="text-sm font-bold">{formatNumber(cat.totalActiveAds)}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase font-bold tracking-wider mb-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Reach
                      </p>
                      <p className="text-sm font-bold">{formatNumber(cat.totalReach)}</p>
                    </div>
                    <div>
                      <p className={`text-[10px] uppercase font-bold tracking-wider mb-0.5 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        Ingested
                      </p>
                      <p className="text-sm font-bold flex items-center gap-1">
                        {cat.ingestionPct}%
                        {cat.ingestionPct === 100 && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Ingestion progress bar */}
                  {cat.ingestionPct < 100 && (
                    <div className="mb-4">
                      <div className={`h-1.5 w-full rounded-full overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-200'}`}>
                        <div
                          className="h-full bg-amber-500 transition-all duration-500 rounded-full"
                          style={{ width: `${cat.ingestionPct}%` }}
                        />
                      </div>
                      <p className={`text-[10px] mt-1 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                        {cat.brandsIngested}/{cat.brandCount} brands ingested
                      </p>
                    </div>
                  )}

                  {/* Brand names preview */}
                  <div className="flex flex-wrap gap-1.5">
                    {cat.brands.map((name) => (
                      <span
                        key={name}
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          darkMode ? 'bg-[#1235e2]/10 text-slate-400' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {name}
                      </span>
                    ))}
                    {cat.brandCount > 6 && (
                      <span className={`text-[11px] px-2 py-0.5 ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                        +{cat.brandCount - 6} more
                      </span>
                    )}
                  </div>
                </V2Card>
              </Link>
            ))}
          </div>

          {/* Active ads by category bar */}
          <div className="mt-10">
            <V2SectionTitle icon={<BarChart3 className="w-5 h-5 text-[#1235e2]" />}>
              Active Ads by Category
            </V2SectionTitle>
            <V2Card className="p-6">
              <div className="space-y-3">
                {categories.map((cat) => {
                  const pct = totalActiveAds > 0 ? (cat.totalActiveAds / totalActiveAds) * 100 : 0;
                  return (
                    <div key={cat.slug} className="flex items-center gap-4">
                      <div className="w-28 shrink-0 flex items-center gap-2 text-sm font-medium truncate">
                        <span className="text-[#1235e2]">{getCategoryIcon(cat.slug)}</span>
                        {cat.label}
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <div className={`flex-1 h-7 rounded-lg overflow-hidden ${darkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          <div
                            className="h-full bg-[#1235e2] rounded-lg transition-all duration-700"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span className={`text-sm font-semibold w-20 text-right shrink-0 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                          {formatNumber(cat.totalActiveAds)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </V2Card>
          </div>
        </>
      )}
    </V2Shell>
  );
}
