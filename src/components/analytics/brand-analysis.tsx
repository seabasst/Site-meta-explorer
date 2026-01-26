/**
 * BrandAnalysis - Expert Facebook Ad Analysis Component
 *
 * Displays comprehensive brand analysis with KPIs, insights, and strategic summary
 * for e-commerce brands analyzing their competitors' Facebook advertising.
 */

'use client';

import { useMemo } from 'react';
import {
  TrendingUp,
  Target,
  Zap,
  Clock,
  Users,
  Globe,
  Play,
  Image as ImageIcon,
  BarChart3,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Info,
  Sparkles,
} from 'lucide-react';
import { analyzeBrand, type BrandAnalysis as BrandAnalysisType, type BrandInsight } from '@/lib/brand-analyzer';
import type { FacebookAdResult, AggregatedDemographics, MediaTypeBreakdown } from '@/lib/facebook-api';

interface BrandAnalysisProps {
  brandName: string;
  ads: FacebookAdResult[];
  demographics: AggregatedDemographics | null;
  mediaBreakdown: MediaTypeBreakdown | null;
}

// Strategy profile colors and icons
const STRATEGY_STYLES = {
  'scale-focused': {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/50',
    icon: TrendingUp,
  },
  'testing-focused': {
    color: 'text-purple-400',
    bg: 'bg-purple-500/20',
    border: 'border-purple-500/50',
    icon: Zap,
  },
  'evergreen-focused': {
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/50',
    icon: Clock,
  },
  'seasonal': {
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    border: 'border-amber-500/50',
    icon: BarChart3,
  },
  'emerging': {
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/50',
    icon: Sparkles,
  },
};

// Insight sentiment colors
const SENTIMENT_STYLES = {
  positive: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  neutral: {
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  insight: {
    icon: Lightbulb,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
};

function KPICard({
  label,
  value,
  subValue,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-colors ${
        highlight
          ? 'bg-[var(--accent-green)]/10 border-[var(--accent-green)]/30'
          : 'bg-[var(--bg-tertiary)] border-[var(--border-subtle)]'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
        <Icon
          className={`w-4 h-4 ${
            highlight ? 'text-[var(--accent-green-light)]' : 'text-[var(--text-muted)]'
          }`}
        />
      </div>
      <div
        className={`text-2xl font-bold ${
          highlight ? 'text-[var(--accent-green-light)]' : 'text-[var(--text-primary)]'
        }`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {subValue && <div className="text-xs text-[var(--text-muted)] mt-1">{subValue}</div>}
    </div>
  );
}

function InsightCard({ insight }: { insight: BrandInsight }) {
  const style = SENTIMENT_STYLES[insight.sentiment];
  const Icon = style.icon;

  return (
    <div className={`p-4 rounded-xl border ${style.bg} ${style.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${style.color} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">{insight.title}</h4>
            {insight.metric && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}>
                {insight.metric}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {insight.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export function BrandAnalysis({
  brandName,
  ads,
  demographics,
  mediaBreakdown,
}: BrandAnalysisProps) {
  const analysis = useMemo(
    () => analyzeBrand(brandName, ads, demographics, mediaBreakdown),
    [brandName, ads, demographics, mediaBreakdown]
  );

  const strategyStyle = STRATEGY_STYLES[analysis.strategyProfile.type];
  const StrategyIcon = strategyStyle.icon;

  const { kpis } = analysis;

  return (
    <div className="space-y-6">
      {/* Header with Strategy Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${strategyStyle.bg} ${strategyStyle.border} border`}
        >
          <StrategyIcon className={`w-4 h-4 ${strategyStyle.color}`} />
          <span className={`text-sm font-medium ${strategyStyle.color} capitalize`}>
            {analysis.strategyProfile.type.replace('-', ' ')} Strategy
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" />
            {analysis.competitivePosition.adVolume} volume
          </span>
          <span className="opacity-40">•</span>
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            {analysis.competitivePosition.creativeDiversity} diversity
          </span>
          <span className="opacity-40">•</span>
          <span className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" />
            {analysis.competitivePosition.marketPresence} presence
          </span>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="p-5 rounded-xl bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-elevated)] border border-[var(--border-subtle)]">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent-yellow)]/20">
            <Sparkles className="w-5 h-5 text-[var(--accent-yellow)]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[var(--text-primary)] mb-2">Expert Analysis</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {analysis.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Key KPIs Grid */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
          Key Performance Indicators
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KPICard
            label="Active Ads"
            value={kpis.activeAds}
            subValue={`${kpis.activeRate.toFixed(0)}% of total`}
            icon={TrendingUp}
            highlight={kpis.activeAds > 20}
          />
          <KPICard
            label="Total EU Reach"
            value={kpis.totalReach >= 1000000
              ? `${(kpis.totalReach / 1000000).toFixed(1)}M`
              : kpis.totalReach >= 1000
              ? `${(kpis.totalReach / 1000).toFixed(0)}K`
              : kpis.totalReach}
            subValue={`${(kpis.avgReachPerAd / 1000).toFixed(1)}K avg/ad`}
            icon={Users}
            highlight={kpis.totalReach > 100000}
          />
          <KPICard
            label="Ads / Week"
            value={kpis.adsPerWeek.toFixed(1)}
            subValue={`${kpis.adsLast7Days} in last 7 days`}
            icon={Zap}
            highlight={kpis.adsPerWeek >= 5}
          />
          <KPICard
            label="Avg Lifespan"
            value={`${Math.round(kpis.avgAdLifespanDays)}d`}
            subValue={`${kpis.evergreenAdsCount} evergreen (30d+)`}
            icon={Clock}
            highlight={kpis.avgAdLifespanDays > 30}
          />
          <KPICard
            label="Primary Audience"
            value={kpis.primaryGender}
            subValue={`${kpis.primaryAgeGroup} age group`}
            icon={Target}
          />
          <KPICard
            label="Top Markets"
            value={kpis.topMarkets.slice(0, 2).join(', ') || 'N/A'}
            subValue={`${kpis.marketConcentration.toFixed(0)}% in top 3`}
            icon={Globe}
          />
          <KPICard
            label="Video Content"
            value={`${kpis.videoPercentage.toFixed(0)}%`}
            subValue={`${kpis.imagePercentage.toFixed(0)}% images`}
            icon={kpis.preferredFormat === 'video' ? Play : ImageIcon}
            highlight={kpis.videoPercentage > 60}
          />
          <KPICard
            label="Top Ad Reach"
            value={kpis.topAdReach >= 1000
              ? `${(kpis.topAdReach / 1000).toFixed(0)}K`
              : kpis.topAdReach}
            subValue={`Median: ${(kpis.medianReach / 1000).toFixed(1)}K`}
            icon={BarChart3}
          />
        </div>
      </div>

      {/* Strategic Insights */}
      {analysis.insights.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3">
            Strategic Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.insights.slice(0, 6).map((insight, index) => (
              <InsightCard key={index} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Strategy Description */}
      <div className="p-4 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <div className="flex items-start gap-3">
          <StrategyIcon className={`w-5 h-5 ${strategyStyle.color} flex-shrink-0 mt-0.5`} />
          <div>
            <h4 className={`text-sm font-medium ${strategyStyle.color} mb-1 capitalize`}>
              {analysis.strategyProfile.type.replace('-', ' ')} Approach
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {analysis.strategyProfile.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
