'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { V2Card, formatNumber } from '@/app/dashboard/v2/v2-shell';
import { useV2 } from '@/app/dashboard/v2/v2-context';

interface TopBrand {
  id: string;
  pageId: string;
  pageName: string;
  category: string | null;
  adCount: number;
  activeAdCount: number;
  totalReach: string;
}

type SortKey = 'adCount' | 'activeAdCount' | 'totalReach';

interface TopBrandsTableProps {
  data: TopBrand[];
}

export function TopBrandsTable({ data }: TopBrandsTableProps) {
  const { darkMode } = useV2();
  const [sortKey, setSortKey] = useState<SortKey>('adCount');
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sorted = [...data].sort((a, b) => {
    let aVal: number;
    let bVal: number;
    if (sortKey === 'totalReach') {
      aVal = parseInt(a.totalReach, 10) || 0;
      bVal = parseInt(b.totalReach, 10) || 0;
    } else {
      aVal = a[sortKey];
      bVal = b[sortKey];
    }
    return sortAsc ? aVal - bVal : bVal - aVal;
  });

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  return (
    <V2Card className="overflow-hidden">
      <div className="px-6 py-4">
        <h3 className="text-base font-bold">Top Brands</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr
            className={`text-left text-xs uppercase tracking-wide border-b ${
              darkMode
                ? 'text-slate-400 border-[#1235e2]/10'
                : 'text-slate-500 border-slate-100'
            }`}
          >
            <th className="px-6 py-3 font-bold">Brand</th>
            <th className="px-6 py-3 font-bold">Category</th>
            <th
              className="px-6 py-3 font-bold text-right cursor-pointer select-none"
              onClick={() => handleSort('adCount')}
            >
              Total Ads
              <SortIcon col="adCount" />
            </th>
            <th
              className="px-6 py-3 font-bold text-right cursor-pointer select-none"
              onClick={() => handleSort('activeAdCount')}
            >
              Active
              <SortIcon col="activeAdCount" />
            </th>
            <th
              className="px-6 py-3 font-bold text-right cursor-pointer select-none"
              onClick={() => handleSort('totalReach')}
            >
              Total Reach
              <SortIcon col="totalReach" />
            </th>
          </tr>
        </thead>
        <tbody
          className={`divide-y ${
            darkMode ? 'divide-[#1235e2]/10' : 'divide-slate-100'
          }`}
        >
          {sorted.map((brand) => (
            <tr
              key={brand.id}
              className={`transition-colors ${
                darkMode
                  ? 'hover:bg-[#1235e2]/10'
                  : 'hover:bg-slate-50'
              }`}
            >
              <td className="px-6 py-4">
                <Link
                  href={`/dashboard/v2/ad-library?brandPageId=${brand.pageId}`}
                  className="font-medium hover:text-[#1235e2] transition-colors"
                >
                  {brand.pageName}
                </Link>
              </td>
              <td
                className={`px-6 py-4 capitalize ${
                  darkMode ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {brand.category || '-'}
              </td>
              <td className="px-6 py-4 text-right">
                {formatNumber(brand.adCount)}
              </td>
              <td className="px-6 py-4 text-right text-green-500 font-medium">
                {formatNumber(brand.activeAdCount)}
              </td>
              <td className="px-6 py-4 text-right font-semibold">
                {formatNumber(brand.totalReach)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </V2Card>
  );
}
