'use client';

import { Users, BookOpen, Activity, Archive } from 'lucide-react';
import { V2Card, formatNumber } from '../../v2-shell';
import { AdLibraryStats } from '../types';

export function StatsBar({ stats, darkMode }: { stats: AdLibraryStats | null; darkMode: boolean }) {
  const statCards = [
    { label: 'Total Brands', value: stats?.totalBrands ?? 0, icon: Users, color: 'text-[#1235e2]' },
    { label: 'Total Ads', value: stats?.totalAds ?? 0, icon: BookOpen, color: 'text-[#1235e2]' },
    { label: 'Active Ads', value: stats?.activeAds ?? 0, icon: Activity, color: 'text-green-500' },
    { label: 'Inactive Ads', value: stats?.inactiveAds ?? 0, icon: Archive, color: 'text-slate-400' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {statCards.map((stat) => (
        <V2Card key={stat.label} className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-bold uppercase tracking-wider ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {stat.label}
            </span>
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
          </div>
          <p className="text-2xl font-black">{formatNumber(stat.value)}</p>
        </V2Card>
      ))}
    </div>
  );
}
