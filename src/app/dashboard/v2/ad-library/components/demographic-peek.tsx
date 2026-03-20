'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { NormalizedDemographics } from '@/lib/demographics-normalizer';

// =============================================================================
// Types
// =============================================================================

interface DemographicPeekProps {
  demographics: NormalizedDemographics;
  darkMode: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const GENDER_COLORS: Record<string, string> = {
  male: '#3b82f6',
  female: '#ec4899',
  unknown: '#6b7280',
};

const CHART_HEIGHT = 120;

// =============================================================================
// Tooltip styles
// =============================================================================

function tooltipStyle(darkMode: boolean) {
  return {
    backgroundColor: darkMode ? '#161b2e' : '#fff',
    border: `1px solid ${darkMode ? 'rgba(18,53,226,0.2)' : '#e2e8f0'}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: darkMode ? '#e2e8f0' : '#1e293b',
  };
}

function tickFill(darkMode: boolean) {
  return darkMode ? '#94a3b8' : '#64748b';
}

// =============================================================================
// Sub-charts
// =============================================================================

function AgeChart({
  data,
  darkMode,
}: {
  data: NormalizedDemographics['ageBreakdown'];
  darkMode: boolean;
}) {
  return (
    <div>
      <p
        className={`mb-1 text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
      >
        Age
      </p>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data}>
          <XAxis
            dataKey="age"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tick={{ fill: tickFill(darkMode) }}
          />
          <Tooltip
            contentStyle={tooltipStyle(darkMode)}
            formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Share']}
          />
          <Bar dataKey="percentage" fill="#1235e2" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function GenderChart({
  data,
  darkMode,
}: {
  data: NormalizedDemographics['genderBreakdown'];
  darkMode: boolean;
}) {
  return (
    <div>
      <p
        className={`mb-1 text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
      >
        Gender
      </p>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={data} layout="vertical">
          <YAxis
            dataKey="gender"
            type="category"
            fontSize={10}
            width={50}
            tickLine={false}
            axisLine={false}
            tick={{ fill: tickFill(darkMode) }}
          />
          <XAxis type="number" hide />
          <Tooltip
            contentStyle={tooltipStyle(darkMode)}
            formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Share']}
          />
          <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`gender-${index}`}
                fill={GENDER_COLORS[entry.gender.toLowerCase()] ?? '#6b7280'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RegionChart({
  data,
  darkMode,
}: {
  data: NormalizedDemographics['regionBreakdown'];
  darkMode: boolean;
}) {
  const top5 = data.slice(0, 5);

  return (
    <div>
      <p
        className={`mb-1 text-xs font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}
      >
        Top Regions
      </p>
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <BarChart data={top5}>
          <XAxis
            dataKey="region"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tick={{ fill: tickFill(darkMode) }}
          />
          <Tooltip
            contentStyle={tooltipStyle(darkMode)}
            formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Share']}
          />
          <Bar dataKey="percentage" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// =============================================================================
// Main component
// =============================================================================

export function DemographicPeek({
  demographics,
  darkMode,
  collapsed,
  onToggleCollapse,
}: DemographicPeekProps) {
  const hasAge = demographics.ageBreakdown.length > 0;
  const hasGender = demographics.genderBreakdown.length > 0;
  const hasRegion = demographics.regionBreakdown.length > 0;

  // If all breakdowns are empty, render nothing
  if (!hasAge && !hasGender && !hasRegion) {
    return null;
  }

  const ChevronIcon = collapsed ? ChevronDown : ChevronUp;

  return (
    <div
      className={`rounded-xl border ${
        darkMode
          ? 'border-[#1235e2]/10 bg-[#101322]/50'
          : 'border-slate-200 bg-white'
      }`}
    >
      {/* Header */}
      <button
        onClick={onToggleCollapse}
        className={`flex w-full items-center justify-between px-4 py-3 text-sm font-medium ${
          darkMode ? 'text-slate-300' : 'text-slate-700'
        }`}
      >
        <span>Audience Demographics</span>
        <ChevronIcon className="h-4 w-4" />
      </button>

      {/* Charts grid */}
      {!collapsed && (
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-3">
          {hasAge && (
            <AgeChart data={demographics.ageBreakdown} darkMode={darkMode} />
          )}
          {hasGender && (
            <GenderChart
              data={demographics.genderBreakdown}
              darkMode={darkMode}
            />
          )}
          {hasRegion && (
            <RegionChart
              data={demographics.regionBreakdown}
              darkMode={darkMode}
            />
          )}
        </div>
      )}
    </div>
  );
}
