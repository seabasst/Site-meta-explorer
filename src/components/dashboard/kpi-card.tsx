'use client';

import type { LucideIcon } from 'lucide-react';
import { V2Card, formatNumber } from '@/app/dashboard/v2/v2-shell';
import { useV2 } from '@/app/dashboard/v2/v2-context';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
}

export function KpiCard({ label, value, icon: Icon, trend }: KpiCardProps) {
  const { darkMode } = useV2();

  return (
    <V2Card className="p-6">
      <div className="flex items-start justify-between mb-3">
        <p
          className={`text-xs uppercase font-bold tracking-wide ${
            darkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {label}
        </p>
        <Icon className="w-5 h-5 text-[#1235e2]" />
      </div>
      <p className="text-3xl font-black">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      {trend && (
        <p
          className={`text-xs mt-2 font-medium ${
            trend.value >= 0 ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {trend.value >= 0 ? '+' : ''}
          {trend.value}% {trend.label}
        </p>
      )}
    </V2Card>
  );
}
