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
  carouselPercentage: number;
  preferredFormat: 'video' | 'image' | 'carousel' | 'balanced';

  // Targeting Focus
  primaryGender: string;
  genderSkew: number; // How skewed toward one gender (0-100)
  primaryAgeGroup: string;
  topMarkets: string[];
  marketConcentration: number; // How concentrated in top markets (0-100)

  // Messaging Analysis
  messagingDiversity: 'high' | 'medium' | 'low';
  priceHeavyAdsPercentage: number; // % of ads with price mentions
  discountHeavyAdsPercentage: number; // % of ads with discount language
  urgencyAdsPercentage: number; // % of ads with urgency language
  emotionalAdsPercentage: number; // % of ads with emotional appeals
  uniqueHooksCount: number; // Number of distinct messaging angles
  dominantMessagingStyle: 'price-focused' | 'benefit-focused' | 'emotional' | 'urgency' | 'balanced';
}

export interface BrandInsight {
  category: 'strategy' | 'creative' | 'targeting' | 'performance' | 'opportunity' | 'messaging';
  title: string;
  description: string;
  metric?: string;
  sentiment: 'positive' | 'neutral' | 'warning' | 'insight';
  recommendation?: string; // Actionable recommendation
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
 * Analyze messaging patterns in ad copy
 */
interface MessagingAnalysis {
  priceHeavyAdsPercentage: number;
  discountHeavyAdsPercentage: number;
  urgencyAdsPercentage: number;
  emotionalAdsPercentage: number;
  uniqueHooksCount: number;
  messagingDiversity: 'high' | 'medium' | 'low';
  dominantMessagingStyle: 'price-focused' | 'benefit-focused' | 'emotional' | 'urgency' | 'balanced';
}

function analyzeMessaging(ads: FacebookAdResult[]): MessagingAnalysis {
  const adTexts = ads
    .map(ad => ad.creativeBody?.toLowerCase() || '')
    .filter(text => text.length > 0);

  if (adTexts.length === 0) {
    return {
      priceHeavyAdsPercentage: 0,
      discountHeavyAdsPercentage: 0,
      urgencyAdsPercentage: 0,
      emotionalAdsPercentage: 0,
      uniqueHooksCount: 0,
      messagingDiversity: 'low',
      dominantMessagingStyle: 'balanced',
    };
  }

  // Price patterns: $XX, €XX, £XX, XX€, "price", "only", "just", numbers with currency
  const pricePatterns = /(\$|€|£|usd|eur|gbp)\s*\d+|\d+\s*(€|£|\$)|(\bprice\b|\bonly\b\s*\$|\bjust\b\s*\$|\bfrom\b\s*\$|\bstarting\b\s*(at\s*)?\$)/i;

  // Discount patterns: % off, save, discount, sale, deal, free shipping
  const discountPatterns = /(\d+%\s*off|\bsave\b|\bdiscount\b|\bsale\b|\bdeal\b|\bfree shipping\b|\bbogo\b|\bbuy\s*\d+\s*get\b|\bhalf\s*price\b|\bclearance\b)/i;

  // Urgency patterns: limited time, ends soon, last chance, hurry, now, today only, don't miss
  const urgencyPatterns = /(\blimited\s*(time|offer|stock)\b|\bends\s*(soon|today|tonight)\b|\blast\s*chance\b|\bhurry\b|\bact\s*now\b|\btoday\s*only\b|\bdon'?t\s*miss\b|\bwhile\s*(supplies|stocks)\s*last\b|\bexpires?\b|\brunning\s*out\b)/i;

  // Emotional patterns: love, amazing, perfect, dream, transform, life-changing, feel
  const emotionalPatterns = /(\byou('?ll)?\s*love\b|\bamazing\b|\bperfect\b|\bdream\b|\btransform\b|\blife.?changing\b|\bfeel\s*(great|amazing|confident|beautiful)\b|\bdeserve\b|\btreat\s*yourself\b|\bgame.?changer\b|\bfinally\b)/i;

  // Count ads matching each pattern
  let priceCount = 0;
  let discountCount = 0;
  let urgencyCount = 0;
  let emotionalCount = 0;

  for (const text of adTexts) {
    if (pricePatterns.test(text)) priceCount++;
    if (discountPatterns.test(text)) discountCount++;
    if (urgencyPatterns.test(text)) urgencyCount++;
    if (emotionalPatterns.test(text)) emotionalCount++;
  }

  const total = adTexts.length;
  const priceHeavyAdsPercentage = (priceCount / total) * 100;
  const discountHeavyAdsPercentage = (discountCount / total) * 100;
  const urgencyAdsPercentage = (urgencyCount / total) * 100;
  const emotionalAdsPercentage = (emotionalCount / total) * 100;

  // Calculate unique hooks by extracting first sentence/phrase patterns
  const hooks = new Set<string>();
  for (const text of adTexts) {
    // Get first ~50 chars or first sentence as the "hook"
    const firstSentence = text.split(/[.!?]/)[0]?.trim().substring(0, 50) || '';
    if (firstSentence.length > 10) {
      // Normalize to detect similar hooks
      const normalized = firstSentence
        .replace(/\d+/g, 'X')
        .replace(/\$|€|£/g, '$')
        .trim();
      hooks.add(normalized);
    }
  }
  const uniqueHooksCount = hooks.size;

  // Calculate messaging diversity based on variety of styles used
  const stylesUsed = [
    priceHeavyAdsPercentage > 20,
    discountHeavyAdsPercentage > 20,
    urgencyAdsPercentage > 20,
    emotionalAdsPercentage > 20,
  ].filter(Boolean).length;

  let messagingDiversity: 'high' | 'medium' | 'low' = 'low';
  if (stylesUsed >= 3 && uniqueHooksCount >= 10) {
    messagingDiversity = 'high';
  } else if (stylesUsed >= 2 || uniqueHooksCount >= 5) {
    messagingDiversity = 'medium';
  }

  // Determine dominant messaging style
  const styleScores = {
    'price-focused': priceHeavyAdsPercentage + discountHeavyAdsPercentage,
    'benefit-focused': 100 - priceHeavyAdsPercentage - urgencyAdsPercentage,
    'emotional': emotionalAdsPercentage,
    'urgency': urgencyAdsPercentage,
  };

  let dominantMessagingStyle: 'price-focused' | 'benefit-focused' | 'emotional' | 'urgency' | 'balanced' = 'balanced';
  const maxScore = Math.max(...Object.values(styleScores));

  if (maxScore > 50) {
    if (styleScores['price-focused'] === maxScore) dominantMessagingStyle = 'price-focused';
    else if (styleScores['emotional'] === maxScore) dominantMessagingStyle = 'emotional';
    else if (styleScores['urgency'] === maxScore) dominantMessagingStyle = 'urgency';
    else dominantMessagingStyle = 'benefit-focused';
  }

  return {
    priceHeavyAdsPercentage,
    discountHeavyAdsPercentage,
    urgencyAdsPercentage,
    emotionalAdsPercentage,
    uniqueHooksCount,
    messagingDiversity,
    dominantMessagingStyle,
  };
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
  const carouselPercentage = mediaBreakdown?.carouselPercentage || 0;
  let preferredFormat: 'video' | 'image' | 'carousel' | 'balanced' = 'balanced';
  if (videoPercentage > 60) preferredFormat = 'video';
  else if (imagePercentage > 60) preferredFormat = 'image';
  else if (carouselPercentage > 60) preferredFormat = 'carousel';

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

  // Messaging analysis
  const messaging = analyzeMessaging(ads);

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
    carouselPercentage,
    preferredFormat,
    primaryGender,
    genderSkew,
    primaryAgeGroup,
    topMarkets,
    marketConcentration,
    // Messaging KPIs
    messagingDiversity: messaging.messagingDiversity,
    priceHeavyAdsPercentage: messaging.priceHeavyAdsPercentage,
    discountHeavyAdsPercentage: messaging.discountHeavyAdsPercentage,
    urgencyAdsPercentage: messaging.urgencyAdsPercentage,
    emotionalAdsPercentage: messaging.emotionalAdsPercentage,
    uniqueHooksCount: messaging.uniqueHooksCount,
    dominantMessagingStyle: messaging.dominantMessagingStyle,
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
  } else if (kpis.carouselPercentage > 40) {
    insights.push({
      category: 'creative',
      title: 'Carousel-Heavy Strategy',
      description: `${kpis.carouselPercentage.toFixed(0)}% carousel ads. This brand uses multi-card formats to showcase product range or tell sequential stories.`,
      metric: `${kpis.carouselPercentage.toFixed(0)}% carousel`,
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

  // ============================================
  // MESSAGING INSIGHTS
  // ============================================

  // Price-heavy messaging warning
  if (kpis.priceHeavyAdsPercentage > 50) {
    insights.push({
      category: 'messaging',
      title: 'Price-Heavy Messaging',
      description: `${kpis.priceHeavyAdsPercentage.toFixed(0)}% of ads lead with price points. Heavy price focus can commoditize your brand and attract deal-seekers over loyal customers.`,
      metric: `${kpis.priceHeavyAdsPercentage.toFixed(0)}% price-focused`,
      sentiment: 'warning',
      recommendation: 'Test benefit-led and emotional messaging to build brand value beyond price competition.',
    });
  } else if (kpis.priceHeavyAdsPercentage > 30) {
    insights.push({
      category: 'messaging',
      title: 'Moderate Price Focus',
      description: `${kpis.priceHeavyAdsPercentage.toFixed(0)}% of ads include price messaging. A balanced approach, but consider testing more value-proposition led copy.`,
      metric: `${kpis.priceHeavyAdsPercentage.toFixed(0)}% price-focused`,
      sentiment: 'neutral',
    });
  }

  // Discount-heavy messaging
  if (kpis.discountHeavyAdsPercentage > 40) {
    insights.push({
      category: 'messaging',
      title: 'Discount-Dependent Strategy',
      description: `${kpis.discountHeavyAdsPercentage.toFixed(0)}% of ads feature discounts or sales. This can train customers to wait for deals and erode margins.`,
      metric: `${kpis.discountHeavyAdsPercentage.toFixed(0)}% discount-focused`,
      sentiment: 'warning',
      recommendation: 'Diversify with value-based messaging that justifies full price. Highlight quality, uniqueness, or transformation.',
    });
  }

  // Low messaging diversity
  if (kpis.messagingDiversity === 'low') {
    insights.push({
      category: 'messaging',
      title: 'Low Message Diversity',
      description: `Only ${kpis.uniqueHooksCount} unique hooks detected. Repetitive messaging limits audience appeal and causes creative fatigue faster.`,
      metric: `${kpis.uniqueHooksCount} unique hooks`,
      sentiment: 'warning',
      recommendation: 'Test different angles: problem-aware, solution-aware, testimonial-led, story-driven, and benefit-focused hooks.',
    });
  } else if (kpis.messagingDiversity === 'high') {
    insights.push({
      category: 'messaging',
      title: 'Strong Message Diversity',
      description: `${kpis.uniqueHooksCount} unique hooks across multiple messaging styles. This brand tests various angles to find what resonates.`,
      metric: `${kpis.uniqueHooksCount} unique hooks`,
      sentiment: 'positive',
    });
  }

  // Urgency overuse
  if (kpis.urgencyAdsPercentage > 50) {
    insights.push({
      category: 'messaging',
      title: 'Urgency Overload',
      description: `${kpis.urgencyAdsPercentage.toFixed(0)}% of ads use urgency tactics. Overuse can feel manipulative and reduce trust with sophisticated buyers.`,
      metric: `${kpis.urgencyAdsPercentage.toFixed(0)}% urgency-based`,
      sentiment: 'warning',
      recommendation: 'Balance urgency with educational content and social proof to build trust alongside conversion pressure.',
    });
  }

  // Emotional messaging opportunity
  if (kpis.emotionalAdsPercentage < 15 && kpis.priceHeavyAdsPercentage > 30) {
    insights.push({
      category: 'messaging',
      title: 'Missing Emotional Connection',
      description: `Only ${kpis.emotionalAdsPercentage.toFixed(0)}% emotional content while ${kpis.priceHeavyAdsPercentage.toFixed(0)}% is price-focused. Emotional resonance drives brand loyalty and higher LTV.`,
      metric: `${kpis.emotionalAdsPercentage.toFixed(0)}% emotional`,
      sentiment: 'insight',
      recommendation: 'Test aspirational messaging, customer transformations, and lifestyle imagery to connect beyond transactions.',
    });
  } else if (kpis.emotionalAdsPercentage > 40) {
    insights.push({
      category: 'messaging',
      title: 'Strong Emotional Appeal',
      description: `${kpis.emotionalAdsPercentage.toFixed(0)}% of ads use emotional messaging. This builds deeper brand connections and customer loyalty.`,
      metric: `${kpis.emotionalAdsPercentage.toFixed(0)}% emotional`,
      sentiment: 'positive',
    });
  }

  // Dominant style insight
  if (kpis.dominantMessagingStyle === 'price-focused') {
    insights.push({
      category: 'messaging',
      title: 'Price-Led Brand Position',
      description: 'This brand positions primarily on price. While effective for conversion, it limits premium positioning and attracts price-sensitive customers.',
      sentiment: 'insight',
      recommendation: 'Consider a 70/30 split: 70% value/benefit messaging, 30% price/offer messaging to balance conversion with brand building.',
    });
  } else if (kpis.dominantMessagingStyle === 'benefit-focused') {
    insights.push({
      category: 'messaging',
      title: 'Value-Led Positioning',
      description: 'This brand leads with benefits and value propositions rather than price. This supports premium positioning and customer loyalty.',
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
