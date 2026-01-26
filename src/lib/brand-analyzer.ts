/**
 * Brand Analyzer - Expert Facebook Ad Analysis for E-commerce
 *
 * Analyzes ad data to extract key KPIs and generate strategic insights
 * for e-commerce brands and their advertising strategies.
 */

import type { FacebookAdResult, AggregatedDemographics, MediaTypeBreakdown } from './facebook-api';

export interface BrandKPIs {
  // Volume & Scale
  totalAds: number;
  activeAds: number;
  inactiveAds: number;
  activeRate: number; // % of ads still running

  // Reach Metrics
  totalReach: number;
  avgReachPerAd: number;
  medianReach: number;
  topAdReach: number;

  // Creative Velocity
  adsPerWeek: number;
  adsLast30Days: number;
  adsLast7Days: number;
  creativeFreshness: 'high' | 'medium' | 'low'; // How often new ads launch

  // Ad Longevity
  avgAdLifespanDays: number;
  longestRunningDays: number;
  evergreenAdsCount: number; // Ads running 30+ days

  // Media Mix
  videoPercentage: number;
  imagePercentage: number;
  preferredFormat: 'video' | 'image' | 'balanced';

  // Targeting Focus
  primaryGender: string;
  genderSkew: number; // How skewed toward one gender (0-100)
  primaryAgeGroup: string;
  topMarkets: string[];
  marketConcentration: number; // How concentrated in top markets (0-100)
}

export interface BrandInsight {
  category: 'strategy' | 'creative' | 'targeting' | 'performance' | 'opportunity';
  title: string;
  description: string;
  metric?: string;
  sentiment: 'positive' | 'neutral' | 'warning' | 'insight';
}

export interface BrandAnalysis {
  brandName: string;
  analysisDate: string;
  kpis: BrandKPIs;
  insights: BrandInsight[];
  summary: string;
  strategyProfile: {
    type: 'scale-focused' | 'testing-focused' | 'evergreen-focused' | 'seasonal' | 'emerging';
    description: string;
  };
  competitivePosition: {
    adVolume: 'high' | 'medium' | 'low';
    creativeDiversity: 'high' | 'medium' | 'low';
    marketPresence: 'broad' | 'focused' | 'niche';
  };
}

/**
 * Calculate days between two dates
 */
function daysBetween(startDate: string, endDate: string | null): number {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate median of an array
 */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Extract KPIs from ad data
 */
function extractKPIs(
  ads: FacebookAdResult[],
  demographics: AggregatedDemographics | null,
  mediaBreakdown: MediaTypeBreakdown | null
): BrandKPIs {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Basic counts
  const activeAds = ads.filter(ad => ad.isActive).length;
  const inactiveAds = ads.length - activeAds;

  // Reach metrics
  const reaches = ads.map(ad => ad.euTotalReach).filter(r => r > 0);
  const totalReach = reaches.reduce((sum, r) => sum + r, 0);
  const avgReachPerAd = reaches.length > 0 ? totalReach / reaches.length : 0;
  const medianReach = median(reaches);
  const topAdReach = Math.max(...reaches, 0);

  // Creative velocity
  const adsWithDates = ads.filter(ad => ad.startedRunning);
  const adsLast30Days = adsWithDates.filter(ad =>
    new Date(ad.startedRunning!) >= thirtyDaysAgo
  ).length;
  const adsLast7Days = adsWithDates.filter(ad =>
    new Date(ad.startedRunning!) >= sevenDaysAgo
  ).length;

  // Calculate ads per week over last 8 weeks
  const eightWeeksAgo = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
  const recentAds = adsWithDates.filter(ad => new Date(ad.startedRunning!) >= eightWeeksAgo);
  const adsPerWeek = recentAds.length / 8;

  // Creative freshness
  let creativeFreshness: 'high' | 'medium' | 'low' = 'low';
  if (adsPerWeek >= 5) creativeFreshness = 'high';
  else if (adsPerWeek >= 2) creativeFreshness = 'medium';

  // Ad longevity
  const lifespans = adsWithDates.map(ad =>
    daysBetween(ad.startedRunning!, ad.stoppedRunning)
  );
  const avgAdLifespanDays = lifespans.length > 0
    ? lifespans.reduce((sum, d) => sum + d, 0) / lifespans.length
    : 0;
  const longestRunningDays = Math.max(...lifespans, 0);
  const evergreenAdsCount = lifespans.filter(d => d >= 30).length;

  // Media mix
  const videoPercentage = mediaBreakdown?.videoPercentage || 0;
  const imagePercentage = mediaBreakdown?.imagePercentage || 0;
  let preferredFormat: 'video' | 'image' | 'balanced' = 'balanced';
  if (videoPercentage > 60) preferredFormat = 'video';
  else if (imagePercentage > 60) preferredFormat = 'image';

  // Targeting analysis
  let primaryGender = 'All';
  let genderSkew = 0;
  if (demographics?.genderBreakdown && demographics.genderBreakdown.length > 0) {
    const topGender = demographics.genderBreakdown[0];
    primaryGender = topGender.gender === 'female' ? 'Women' :
                    topGender.gender === 'male' ? 'Men' : 'All';
    // Calculate skew (how far from 50/50)
    const femalePercent = demographics.genderBreakdown.find(g => g.gender === 'female')?.percentage || 0;
    const malePercent = demographics.genderBreakdown.find(g => g.gender === 'male')?.percentage || 0;
    genderSkew = Math.abs(femalePercent - malePercent);
  }

  let primaryAgeGroup = '25-34';
  if (demographics?.ageBreakdown && demographics.ageBreakdown.length > 0) {
    primaryAgeGroup = demographics.ageBreakdown[0].age;
  }

  // Market analysis
  const topMarkets: string[] = [];
  let marketConcentration = 0;
  if (demographics?.regionBreakdown && demographics.regionBreakdown.length > 0) {
    const top3 = demographics.regionBreakdown.slice(0, 3);
    topMarkets.push(...top3.map(r => r.region));
    marketConcentration = top3.reduce((sum, r) => sum + r.percentage, 0);
  }

  return {
    totalAds: ads.length,
    activeAds,
    inactiveAds,
    activeRate: ads.length > 0 ? (activeAds / ads.length) * 100 : 0,
    totalReach,
    avgReachPerAd,
    medianReach,
    topAdReach,
    adsPerWeek,
    adsLast30Days,
    adsLast7Days,
    creativeFreshness,
    avgAdLifespanDays,
    longestRunningDays,
    evergreenAdsCount,
    videoPercentage,
    imagePercentage,
    preferredFormat,
    primaryGender,
    genderSkew,
    primaryAgeGroup,
    topMarkets,
    marketConcentration,
  };
}

/**
 * Generate strategic insights based on KPIs
 */
function generateInsights(kpis: BrandKPIs, ads: FacebookAdResult[]): BrandInsight[] {
  const insights: BrandInsight[] = [];

  // Creative velocity insights
  if (kpis.adsPerWeek >= 5) {
    insights.push({
      category: 'creative',
      title: 'High Creative Output',
      description: `Launching ~${kpis.adsPerWeek.toFixed(1)} new ads per week indicates aggressive testing or scaling. This brand prioritizes creative diversity.`,
      metric: `${kpis.adsPerWeek.toFixed(1)} ads/week`,
      sentiment: 'positive',
    });
  } else if (kpis.adsPerWeek < 1) {
    insights.push({
      category: 'creative',
      title: 'Low Creative Velocity',
      description: 'Minimal new ad launches suggest reliance on proven creatives or limited ad budget. Consider whether more testing could unlock growth.',
      metric: `${kpis.adsPerWeek.toFixed(1)} ads/week`,
      sentiment: 'warning',
    });
  }

  // Evergreen strategy
  if (kpis.evergreenAdsCount >= 5) {
    insights.push({
      category: 'strategy',
      title: 'Evergreen Winners Identified',
      description: `${kpis.evergreenAdsCount} ads running 30+ days indicates successful creative that resonates with audiences. These are likely top performers worth studying.`,
      metric: `${kpis.evergreenAdsCount} long-running ads`,
      sentiment: 'positive',
    });
  }

  // Ad lifespan insight
  if (kpis.avgAdLifespanDays > 45) {
    insights.push({
      category: 'performance',
      title: 'Strong Ad Durability',
      description: `Average ad lifespan of ${Math.round(kpis.avgAdLifespanDays)} days suggests creatives maintain performance over time. This brand has found winning formulas.`,
      metric: `${Math.round(kpis.avgAdLifespanDays)} day avg`,
      sentiment: 'positive',
    });
  } else if (kpis.avgAdLifespanDays < 14) {
    insights.push({
      category: 'performance',
      title: 'Rapid Creative Turnover',
      description: `Short ${Math.round(kpis.avgAdLifespanDays)}-day average lifespan may indicate testing phase, creative fatigue, or performance issues.`,
      metric: `${Math.round(kpis.avgAdLifespanDays)} day avg`,
      sentiment: 'neutral',
    });
  }

  // Gender targeting
  if (kpis.genderSkew > 40) {
    insights.push({
      category: 'targeting',
      title: `${kpis.primaryGender}-Focused Strategy`,
      description: `Strong ${kpis.genderSkew.toFixed(0)}% gender skew toward ${kpis.primaryGender.toLowerCase()}. This brand has a clear primary audience.`,
      metric: `${kpis.genderSkew.toFixed(0)}% skew`,
      sentiment: 'insight',
    });
  }

  // Market concentration
  if (kpis.marketConcentration > 70) {
    insights.push({
      category: 'targeting',
      title: 'Concentrated Market Focus',
      description: `${kpis.marketConcentration.toFixed(0)}% of reach in top 3 markets (${kpis.topMarkets.join(', ')}). Highly focused geographic strategy.`,
      metric: `${kpis.marketConcentration.toFixed(0)}% concentration`,
      sentiment: 'insight',
    });
  } else if (kpis.marketConcentration < 40 && kpis.topMarkets.length > 0) {
    insights.push({
      category: 'targeting',
      title: 'Broad Market Distribution',
      description: 'Reach spread across many markets indicates pan-European strategy or market testing phase.',
      metric: `${kpis.marketConcentration.toFixed(0)}% in top 3`,
      sentiment: 'neutral',
    });
  }

  // Media format
  if (kpis.videoPercentage > 70) {
    insights.push({
      category: 'creative',
      title: 'Video-First Strategy',
      description: `${kpis.videoPercentage.toFixed(0)}% video content. This brand invests heavily in video production, likely for storytelling and engagement.`,
      metric: `${kpis.videoPercentage.toFixed(0)}% video`,
      sentiment: 'insight',
    });
  } else if (kpis.imagePercentage > 70) {
    insights.push({
      category: 'creative',
      title: 'Image-Focused Approach',
      description: `${kpis.imagePercentage.toFixed(0)}% static images. Efficient for testing and scaling, with lower production costs.`,
      metric: `${kpis.imagePercentage.toFixed(0)}% images`,
      sentiment: 'insight',
    });
  }

  // Scale opportunity
  if (kpis.activeRate < 30 && kpis.totalAds > 20) {
    insights.push({
      category: 'opportunity',
      title: 'Low Active Rate',
      description: `Only ${kpis.activeRate.toFixed(0)}% of analyzed ads still running. May indicate scaling down, seasonal pause, or creative refresh cycle.`,
      metric: `${kpis.activeRate.toFixed(0)}% active`,
      sentiment: 'warning',
    });
  } else if (kpis.activeRate > 80) {
    insights.push({
      category: 'opportunity',
      title: 'Active Scaling Mode',
      description: `${kpis.activeRate.toFixed(0)}% of ads still active indicates aggressive current spending and growth focus.`,
      metric: `${kpis.activeRate.toFixed(0)}% active`,
      sentiment: 'positive',
    });
  }

  // Reach analysis
  if (kpis.avgReachPerAd > 50000) {
    insights.push({
      category: 'performance',
      title: 'High Average Reach',
      description: `${(kpis.avgReachPerAd / 1000).toFixed(0)}K average reach per ad suggests significant ad spend and broad audience targeting.`,
      metric: `${(kpis.avgReachPerAd / 1000).toFixed(0)}K avg reach`,
      sentiment: 'positive',
    });
  }

  return insights;
}

/**
 * Determine the brand's advertising strategy profile
 */
function determineStrategyProfile(kpis: BrandKPIs): BrandAnalysis['strategyProfile'] {
  // Scale-focused: High volume, high reach, many active ads
  if (kpis.activeAds > 30 && kpis.totalReach > 500000 && kpis.adsPerWeek >= 3) {
    return {
      type: 'scale-focused',
      description: 'Aggressive scaling with high ad volume and reach. This brand is investing heavily in paid acquisition.',
    };
  }

  // Testing-focused: High velocity, low lifespan, many variants
  if (kpis.adsPerWeek >= 5 && kpis.avgAdLifespanDays < 21) {
    return {
      type: 'testing-focused',
      description: 'Rapid creative testing with frequent new launches. Focused on finding winning creatives through iteration.',
    };
  }

  // Evergreen-focused: Long lifespans, fewer but stable ads
  if (kpis.evergreenAdsCount >= 5 && kpis.avgAdLifespanDays > 30) {
    return {
      type: 'evergreen-focused',
      description: 'Relies on proven, long-running creatives. Prioritizes stability and consistent performance over testing.',
    };
  }

  // Seasonal: Low current activity, history of ads
  if (kpis.activeRate < 30 && kpis.totalAds > 20) {
    return {
      type: 'seasonal',
      description: 'Currently scaled down, possibly between campaigns or in a seasonal pause period.',
    };
  }

  // Emerging: Low volume overall
  return {
    type: 'emerging',
    description: 'Early-stage or conservative advertising approach. Building presence or testing the channel.',
  };
}

/**
 * Generate executive summary
 */
function generateSummary(
  brandName: string,
  kpis: BrandKPIs,
  strategyProfile: BrandAnalysis['strategyProfile']
): string {
  const parts: string[] = [];

  // Opening with brand and scale
  parts.push(`${brandName} is running a ${strategyProfile.type.replace('-', ' ')} advertising strategy.`);

  // Volume context
  if (kpis.totalAds > 50) {
    parts.push(`With ${kpis.activeAds} active ads out of ${kpis.totalAds} analyzed, they maintain a substantial presence on Meta platforms.`);
  } else if (kpis.totalAds > 20) {
    parts.push(`Their current portfolio of ${kpis.activeAds} active ads represents a moderate Meta advertising presence.`);
  } else {
    parts.push(`With ${kpis.activeAds} active ads, they're operating at a smaller scale on Meta platforms.`);
  }

  // Reach and performance
  if (kpis.totalReach > 100000) {
    parts.push(`Total EU reach of ${(kpis.totalReach / 1000).toFixed(0)}K indicates significant market penetration.`);
  }

  // Creative approach
  if (kpis.creativeFreshness === 'high') {
    parts.push(`Their high creative velocity (~${kpis.adsPerWeek.toFixed(1)} new ads/week) suggests active optimization and testing.`);
  } else if (kpis.evergreenAdsCount > 3) {
    parts.push(`They've identified ${kpis.evergreenAdsCount} evergreen winners running 30+ days, indicating proven creative formulas.`);
  }

  // Targeting summary
  if (kpis.genderSkew > 30) {
    parts.push(`Primary audience skews toward ${kpis.primaryGender.toLowerCase()} in the ${kpis.primaryAgeGroup} age bracket.`);
  }

  // Market focus
  if (kpis.topMarkets.length > 0) {
    parts.push(`Key markets include ${kpis.topMarkets.slice(0, 3).join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Main analysis function
 */
export function analyzeBrand(
  brandName: string,
  ads: FacebookAdResult[],
  demographics: AggregatedDemographics | null,
  mediaBreakdown: MediaTypeBreakdown | null
): BrandAnalysis {
  const kpis = extractKPIs(ads, demographics, mediaBreakdown);
  const insights = generateInsights(kpis, ads);
  const strategyProfile = determineStrategyProfile(kpis);
  const summary = generateSummary(brandName, kpis, strategyProfile);

  // Determine competitive position
  const adVolume: 'high' | 'medium' | 'low' =
    kpis.totalAds > 50 ? 'high' : kpis.totalAds > 20 ? 'medium' : 'low';

  const creativeDiversity: 'high' | 'medium' | 'low' =
    kpis.adsPerWeek >= 5 ? 'high' : kpis.adsPerWeek >= 2 ? 'medium' : 'low';

  const marketPresence: 'broad' | 'focused' | 'niche' =
    kpis.marketConcentration < 50 ? 'broad' :
    kpis.marketConcentration < 75 ? 'focused' : 'niche';

  return {
    brandName,
    analysisDate: new Date().toISOString(),
    kpis,
    insights,
    summary,
    strategyProfile,
    competitivePosition: {
      adVolume,
      creativeDiversity,
      marketPresence,
    },
  };
}
