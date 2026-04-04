import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';
import { compileBrandContext } from '@/lib/brand-context';
import type { BrandProfileFull } from '@/lib/brand-profile-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const client = new Anthropic();

// ---------------------------------------------------------------------------
// System prompt — Hikaru: senior creative strategist
// ---------------------------------------------------------------------------
const HIKARU_SYSTEM_PROMPT = `You are Hikaru, a senior creative strategist who specializes in Meta/Facebook advertising analysis. You work inside Facebook Ad Explorer — a competitive intelligence tool that tracks thousands of active ads across Europe.

Personality:
- Direct and opinionated. You don't hedge — you tell the user what the data says and what it means.
- Data-driven: you ALWAYS query the database before answering. Never fabricate stats.
- Strategically sharp: you identify whitespace, spot patterns others miss, and frame everything in terms of competitive advantage.
- You understand European ad markets (DACH, Nordics, UK, FR, etc.) and their nuances.

When answering:
- If the user asks about a brand or category, query the data FIRST. Call multiple tools if needed to build a complete picture.
- When comparing brands, always present a structured comparison table (markdown).
- When analyzing creative strategy, identify messaging angles, format mix, and whitespace/opportunities the brand is missing.
- When suggesting ad concepts, include verbatim hook lines, headlines, and body copy — not vague direction.
- Format responses with clear sections and headers. Use tables for comparisons. Use bold for key metrics.
- Keep responses focused and actionable. No filler.

Available brand categories in the database: airline, fast_food, car_rental, fashion, beauty, tech, food, fitness, home, wellness, pets, kids, travel, and more.

You also have access to the creator/influencer partnership database. Creators are people/pages that run partnership ads (e.g. "lisalegov with Ninepine" format in Meta Ad Library). You can search creators by name, brand, or category, and see which brands they work with.

You have 10 tools at your disposal. Use them aggressively — it's better to over-query than to guess.

When your answer involves comparing numbers, showing distributions, or illustrating trends, include an inline chart using this exact format:

:::chart
{"type":"bar","title":"Chart Title","data":[{"name":"Label","value":123}]}
:::

Chart types you can use:
- "bar": Compare values across categories (brands, formats, countries)
- "pie": Show proportional breakdowns (format mix, share of voice)
- "area": Show trends over time (weekly data, timeline)
- "horizontal-bar": Show ranked lists (top 10 brands by reach)

Rules:
- Use at most 2 charts per response. Pick the most impactful visualization.
- Always include text analysis alongside charts — never a chart alone.
- Keep data arrays under 12 items. Group smaller items into "Other" if needed.
- Use "name" for labels and "value" for the primary metric.
- For multi-series data, add a "keys" array: {"type":"bar","keys":["reach","adCount"],"data":[{"name":"Brand A","reach":100,"adCount":5}]}
- Use "valueFormatter" to hint formatting: "reach" for large numbers (1.2M), "percent" for percentages, "number" for plain numbers.
- The chart JSON must be valid JSON on a single conceptual block between :::chart and ::: delimiters.
- Place charts between paragraphs of text, not inside sentences.`;

// ---------------------------------------------------------------------------
// Tool definitions (9 tools)
// ---------------------------------------------------------------------------
const tools: Anthropic.Tool[] = [
  // --- Original 5 tools ---
  {
    name: 'search_ads',
    description:
      'Search ads in the database by brand name, ad text, format, or status. Returns ad details including creative text, reach, format, and brand info.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: {
          type: 'string',
          description: 'Search query to match against ad body text, title, or brand name',
        },
        brandName: {
          type: 'string',
          description: 'Filter by brand name (partial match)',
        },
        displayFormat: {
          type: 'string',
          enum: ['image', 'video', 'carousel'],
          description: 'Filter by ad format',
        },
        isActive: {
          type: 'boolean',
          description: 'Filter by active/inactive status',
        },
        sortBy: {
          type: 'string',
          enum: ['reachEstimate', 'startDate', 'createdAt'],
          description: 'Sort field (default: reachEstimate)',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default: 10, max: 25)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_brand_stats',
    description:
      'Get statistics for a specific brand including total ads, active ads, reach, demographics, top formats, and ad text samples.',
    input_schema: {
      type: 'object' as const,
      properties: {
        brandName: {
          type: 'string',
          description: 'Brand name to look up (partial match)',
        },
      },
      required: ['brandName'],
    },
  },
  {
    name: 'compare_brands',
    description:
      'Compare two or more brands side by side on metrics like ad count, reach, formats, and activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        brandNames: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of brand names to compare',
        },
      },
      required: ['brandNames'],
    },
  },
  {
    name: 'get_overview_stats',
    description:
      'Get overall database statistics: total brands, total ads, active ads, format distribution, and top brands by reach.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_category_insights',
    description:
      'Get insights for a brand category (e.g. "airline", "fast_food", "car_rental"). Returns all brands in that category with their metrics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Brand category to analyze (e.g. airline, fast_food, car_rental, fashion)',
        },
      },
      required: ['category'],
    },
  },

  // --- New 4 tools ---
  {
    name: 'get_sov_timeline',
    description:
      'Query Share of Voice timeline data for a category over time. Returns weekly snapshots with brand values and percentage share for a chosen metric.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Brand category to query (e.g. airline, fast_food)',
        },
        weeks: {
          type: 'number',
          description: 'Number of weeks of history to include (default: 12)',
        },
        metric: {
          type: 'string',
          enum: ['activeAds', 'totalReach', 'estSpend', 'newAds'],
          description: 'Metric to use for share-of-voice calculation (default: activeAds)',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'get_creative_analysis',
    description:
      'Query AI creative analysis data for ads in a category or for a specific brand. Returns messaging angles, visual styles, emotional tones, and scores.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filter by brand category (partial match)',
        },
        brandName: {
          type: 'string',
          description: 'Filter by brand name (partial match)',
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 10, max: 50)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_ad_templates',
    description:
      'Query ad template patterns that have been derived from successful ads. Returns copy formulas, visual directions, and messaging angles.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          description: 'Filter templates by category',
        },
        brandName: {
          type: 'string',
          description: 'Filter templates by brand name',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_format_breakdown',
    description:
      'Get detailed ad format distribution (image, video, carousel) for a brand or category with reach per format.',
    input_schema: {
      type: 'object' as const,
      properties: {
        brandName: {
          type: 'string',
          description: 'Brand name to analyze (partial match)',
        },
        category: {
          type: 'string',
          description: 'Category to analyze (partial match)',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_creators',
    description:
      'Search creator/influencer partnerships. Find creators by name, by the brands they work with, or by brand category. Returns creator names, partnership counts, total reach, and which brands they collaborate with. Use this for questions about influencers, creators, partnerships, or collaborations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        creatorName: {
          type: 'string',
          description: 'Search by creator name (partial match)',
        },
        brandName: {
          type: 'string',
          description: 'Find creators who partner with this brand (partial match)',
        },
        category: {
          type: 'string',
          description: 'Find creators who work with brands in this category (e.g. fashion, beauty, fitness)',
        },
        sortBy: {
          type: 'string',
          enum: ['totalReach', 'totalAds', 'brandCount'],
          description: 'Sort by reach, ad count, or number of brand partnerships (default: totalReach)',
        },
        limit: {
          type: 'number',
          description: 'Max results (default: 10, max: 25)',
        },
      },
      required: [],
    },
  },
];

// ---------------------------------------------------------------------------
// BigInt-safe JSON serializer
// ---------------------------------------------------------------------------
function safeSerialize(data: unknown): string {
  return JSON.stringify(data, (_k, v) => (typeof v === 'bigint' ? Number(v) : v));
}

// ---------------------------------------------------------------------------
// Tool implementations — original 5
// ---------------------------------------------------------------------------

async function searchAds(input: {
  search?: string;
  brandName?: string;
  displayFormat?: string;
  isActive?: boolean;
  sortBy?: string;
  limit?: number;
}) {
  const limit = Math.min(input.limit || 10, 25);
  const where: Record<string, unknown> = {};

  if (input.brandName) {
    where.brand = { pageName: { contains: input.brandName, mode: 'insensitive' } };
  }
  if (input.displayFormat) {
    where.displayFormat = input.displayFormat;
  }
  if (input.isActive !== undefined) {
    where.isActive = input.isActive;
  }
  if (input.search) {
    where.OR = [
      { body: { contains: input.search, mode: 'insensitive' } },
      { title: { contains: input.search, mode: 'insensitive' } },
    ];
  }

  const ads = await prisma.adLibraryAd.findMany({
    where,
    select: {
      adId: true,
      body: true,
      title: true,
      caption: true,
      displayFormat: true,
      isActive: true,
      reachEstimate: true,
      startDate: true,
      publisherPlatforms: true,
      ctaText: true,
      brand: { select: { pageName: true, category: true } },
      assets: {
        where: { downloadStatus: 'completed' },
        select: { storedUrl: true, assetType: true },
        take: 1,
      },
    },
    orderBy: { [input.sortBy || 'reachEstimate']: 'desc' },
    take: limit,
  });

  return ads.map((ad) => ({
    adId: ad.adId,
    brand: ad.brand.pageName,
    category: ad.brand.category,
    format: ad.displayFormat,
    active: ad.isActive,
    reach: ad.reachEstimate,
    startDate: ad.startDate,
    platforms: ad.publisherPlatforms,
    title: ad.title,
    body: ad.body?.slice(0, 300),
    caption: ad.caption,
    cta: ad.ctaText,
    hasMedia: ad.assets.length > 0,
    mediaType: ad.assets[0]?.assetType,
  }));
}

async function getBrandStats(input: { brandName: string }) {
  const brand = await prisma.adLibraryBrand.findFirst({
    where: { pageName: { contains: input.brandName, mode: 'insensitive' } },
    select: {
      pageName: true,
      pageId: true,
      category: true,
      country: true,
      demographicsJson: true,
      _count: { select: { ads: true } },
    },
  });

  if (!brand) return { error: `Brand "${input.brandName}" not found` };

  const [activeCount, formatCounts, topAds, totalReach] = await Promise.all([
    prisma.adLibraryAd.count({ where: { brand: { pageName: brand.pageName }, isActive: true } }),
    prisma.adLibraryAd.groupBy({
      by: ['displayFormat'],
      where: { brand: { pageName: brand.pageName } },
      _count: true,
    }),
    prisma.adLibraryAd.findMany({
      where: { brand: { pageName: brand.pageName }, isActive: true },
      select: { body: true, title: true, reachEstimate: true, displayFormat: true },
      orderBy: { reachEstimate: 'desc' },
      take: 5,
    }),
    prisma.adLibraryAd.aggregate({
      where: { brand: { pageName: brand.pageName }, isActive: true },
      _sum: { reachEstimate: true },
      _avg: { reachEstimate: true },
    }),
  ]);

  return {
    name: brand.pageName,
    category: brand.category,
    country: brand.country,
    totalAds: brand._count.ads,
    activeAds: activeCount,
    totalReach: totalReach._sum.reachEstimate,
    avgReach: Math.round(Number(totalReach._avg.reachEstimate) || 0),
    formats: formatCounts.map((f) => ({ format: f.displayFormat || 'unknown', count: f._count })),
    demographics: brand.demographicsJson ? JSON.parse(brand.demographicsJson as string) : null,
    topAds: topAds.map((a) => ({
      title: a.title,
      body: a.body?.slice(0, 200),
      reach: a.reachEstimate,
      format: a.displayFormat,
    })),
  };
}

async function compareBrands(input: { brandNames: string[] }) {
  const results = await Promise.all(
    input.brandNames.map(async (name) => {
      const brand = await prisma.adLibraryBrand.findFirst({
        where: { pageName: { contains: name, mode: 'insensitive' } },
      });
      if (!brand) return { name, error: 'Not found' };

      const [totalAds, activeAds, totalReach, formats] = await Promise.all([
        prisma.adLibraryAd.count({ where: { brandId: brand.id } }),
        prisma.adLibraryAd.count({ where: { brandId: brand.id, isActive: true } }),
        prisma.adLibraryAd.aggregate({
          where: { brandId: brand.id, isActive: true },
          _sum: { reachEstimate: true },
          _avg: { reachEstimate: true },
        }),
        prisma.adLibraryAd.groupBy({
          by: ['displayFormat'],
          where: { brandId: brand.id },
          _count: true,
        }),
      ]);

      return {
        name: brand.pageName,
        category: brand.category,
        country: brand.country,
        totalAds,
        activeAds,
        totalReach: totalReach._sum.reachEstimate,
        avgReach: Math.round(Number(totalReach._avg.reachEstimate) || 0),
        formats: formats.map((f) => ({ format: f.displayFormat, count: f._count })),
      };
    })
  );

  return results;
}

async function getOverviewStats() {
  const [totalBrands, totalAds, activeAds, formats, topBrands] = await Promise.all([
    prisma.adLibraryBrand.count(),
    prisma.adLibraryAd.count(),
    prisma.adLibraryAd.count({ where: { isActive: true } }),
    prisma.adLibraryAd.groupBy({ by: ['displayFormat'], _count: true }),
    prisma.adLibraryBrand.findMany({
      select: {
        pageName: true,
        category: true,
        _count: { select: { ads: true } },
      },
      orderBy: { ads: { _count: 'desc' } },
      take: 10,
    }),
  ]);

  return {
    totalBrands,
    totalAds,
    activeAds,
    inactiveAds: totalAds - activeAds,
    formats: formats.map((f) => ({ format: f.displayFormat || 'unknown', count: f._count })),
    topBrands: topBrands.map((b) => ({
      name: b.pageName,
      category: b.category,
      adCount: b._count.ads,
    })),
  };
}

async function getCategoryInsights(input: { category: string }) {
  const brands = await prisma.adLibraryBrand.findMany({
    where: { category: { contains: input.category, mode: 'insensitive' } },
    select: {
      pageName: true,
      country: true,
      _count: { select: { ads: true } },
    },
    orderBy: { ads: { _count: 'desc' } },
  });

  if (brands.length === 0) return { error: `No brands found in category "${input.category}"` };

  const brandStats = await Promise.all(
    brands.map(async (b) => {
      const activeCount = await prisma.adLibraryAd.count({
        where: { brand: { pageName: b.pageName }, isActive: true },
      });
      const reach = await prisma.adLibraryAd.aggregate({
        where: { brand: { pageName: b.pageName }, isActive: true },
        _sum: { reachEstimate: true },
        _avg: { reachEstimate: true },
      });
      return {
        name: b.pageName,
        country: b.country,
        totalAds: b._count.ads,
        activeAds: activeCount,
        totalReach: reach._sum.reachEstimate,
        avgReach: Math.round(Number(reach._avg.reachEstimate) || 0),
      };
    })
  );

  return {
    category: input.category,
    brandCount: brands.length,
    brands: brandStats,
  };
}

// ---------------------------------------------------------------------------
// Tool implementations — new 4
// ---------------------------------------------------------------------------

async function getSovTimeline(input: {
  category: string;
  weeks?: number;
  metric?: string;
}) {
  const weeks = input.weeks || 12;
  const metric = input.metric || 'activeAds';

  const brands = await prisma.adLibraryBrand.findMany({
    where: { category: { contains: input.category, mode: 'insensitive' } },
    select: { id: true, pageName: true },
  });

  if (brands.length === 0) {
    return { error: `No brands found in category "${input.category}"` };
  }

  const brandIds = brands.map((b) => b.id);
  const brandMap = Object.fromEntries(brands.map((b) => [b.id, b.pageName]));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);

  const snapshots = await prisma.sovSnapshot.findMany({
    where: { brandId: { in: brandIds }, weekStart: { gte: cutoff } },
    orderBy: { weekStart: 'asc' },
  });

  // Group by week
  const weekMap = new Map<
    string,
    { weekStart: string; brands: Record<string, number>; total: number }
  >();

  for (const snap of snapshots) {
    const weekKey = snap.weekStart.toISOString().slice(0, 10);
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { weekStart: weekKey, brands: {}, total: 0 });
    }
    const entry = weekMap.get(weekKey)!;
    const name = brandMap[snap.brandId] || snap.brandId;

    let value: number;
    switch (metric) {
      case 'totalReach':
        value = Number(snap.totalReach);
        break;
      case 'estSpend':
        value = snap.estSpend;
        break;
      case 'newAds':
        value = snap.newAdsCount;
        break;
      default:
        value = snap.activeAds;
    }

    entry.brands[name] = value;
    entry.total += value;
  }

  // Build timeline with percentage share
  const timeline = Array.from(weekMap.values()).map((week) => {
    const brandsWithShare: Record<string, { value: number; share: string }> = {};
    for (const [name, value] of Object.entries(week.brands)) {
      brandsWithShare[name] = {
        value,
        share: week.total > 0 ? ((value / week.total) * 100).toFixed(1) + '%' : '0%',
      };
    }
    return { weekStart: week.weekStart, metric, total: week.total, brands: brandsWithShare };
  });

  return { category: input.category, metric, weeks, timeline };
}

async function getCreativeAnalysis(input: {
  category?: string;
  brandName?: string;
  limit?: number;
}) {
  const limit = Math.min(input.limit || 10, 50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.category) {
    where.ad = { brand: { category: { contains: input.category, mode: 'insensitive' } } };
  }
  if (input.brandName) {
    where.ad = {
      ...where.ad,
      brand: {
        ...(where.ad?.brand || {}),
        pageName: { contains: input.brandName, mode: 'insensitive' },
      },
    };
  }

  const analyses = await prisma.adAnalysis.findMany({
    where,
    include: {
      ad: {
        select: {
          adId: true,
          body: true,
          title: true,
          displayFormat: true,
          reachEstimate: true,
          brand: { select: { pageName: true, category: true } },
        },
      },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
  });

  return analyses.map((a) => ({
    adId: a.ad.adId,
    brand: a.ad.brand.pageName,
    category: a.ad.brand.category,
    format: a.ad.displayFormat,
    reach: a.ad.reachEstimate,
    title: a.ad.title,
    body: a.ad.body?.slice(0, 200),
    headline: a.headline,
    messagingAngle: a.messagingAngle,
    visualStyle: a.visualStyle,
    ctaStyle: a.ctaStyle,
    targetAudience: a.targetAudience,
    emotionalTone: a.emotionalTone,
    creativityScore: a.creativityScore,
    clarityScore: a.clarityScore,
    persuasionScore: a.persuasionScore,
  }));
}

async function getAdTemplates(input: { category?: string; brandName?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.category) {
    where.category = { contains: input.category, mode: 'insensitive' };
  }
  if (input.brandName) {
    where.brand = { pageName: { contains: input.brandName, mode: 'insensitive' } };
  }

  const templates = await prisma.adTemplate.findMany({
    where,
    include: { brand: { select: { pageName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return templates.map((t) => ({
    name: t.name,
    brand: t.brand?.pageName || null,
    category: t.category,
    description: t.description,
    messagingAngle: t.messagingAngle,
    visualStyle: t.visualStyle,
    headlineFormula: t.headlineFormula,
    bodyFormula: t.bodyFormula,
    ctaText: t.ctaText,
    colorSuggestions: t.colorSuggestions,
    imageryNotes: t.imageryNotes,
    layoutNotes: t.layoutNotes,
    formatRecommendation: t.formatRecommendation,
    platformNotes: t.platformNotes,
  }));
}

async function getFormatBreakdown(input: { brandName?: string; category?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (input.brandName) {
    where.brand = { pageName: { contains: input.brandName, mode: 'insensitive' } };
  }
  if (input.category) {
    where.brand = {
      ...(where.brand || {}),
      category: { contains: input.category, mode: 'insensitive' },
    };
  }

  const formatCounts = await prisma.adLibraryAd.groupBy({
    by: ['displayFormat'],
    where,
    _count: true,
    _sum: { reachEstimate: true },
    _avg: { reachEstimate: true },
  });

  const totalAds = formatCounts.reduce((sum, f) => sum + f._count, 0);
  const totalReach = formatCounts.reduce((sum, f) => sum + (f._sum.reachEstimate || 0), 0);

  return {
    filter: { brandName: input.brandName || null, category: input.category || null },
    totalAds,
    totalReach,
    formats: formatCounts.map((f) => ({
      format: f.displayFormat || 'unknown',
      count: f._count,
      percentage: totalAds > 0 ? ((f._count / totalAds) * 100).toFixed(1) + '%' : '0%',
      totalReach: f._sum.reachEstimate || 0,
      reachShare:
        totalReach > 0
          ? (((f._sum.reachEstimate || 0) / totalReach) * 100).toFixed(1) + '%'
          : '0%',
      avgReach: Math.round(Number(f._avg.reachEstimate) || 0),
    })),
  };
}

async function searchCreators(input: {
  creatorName?: string;
  brandName?: string;
  category?: string;
  sortBy?: string;
  limit?: number;
}) {
  const limit = Math.min(input.limit || 10, 25);
  const sortBy = input.sortBy || 'totalReach';

  // Build where clause for creators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (input.creatorName) {
    where.pageName = { contains: input.creatorName, mode: 'insensitive' };
  }

  // Filter by brand or category through partnerships
  if (input.brandName || input.category) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partnershipWhere: any = {};
    if (input.brandName) {
      partnershipWhere.brand = { pageName: { contains: input.brandName, mode: 'insensitive' } };
    }
    if (input.category) {
      partnershipWhere.brand = {
        ...(partnershipWhere.brand || {}),
        category: { contains: input.category, mode: 'insensitive' },
      };
    }
    where.partnerships = { some: partnershipWhere };
  }

  const creators = await prisma.adCreator.findMany({
    where,
    orderBy: { [sortBy]: 'desc' },
    take: limit,
    select: {
      pageName: true,
      totalAds: true,
      totalReach: true,
      brandCount: true,
      partnerships: {
        select: {
          adCount: true,
          totalReach: true,
          brand: { select: { pageName: true, category: true, country: true } },
        },
        orderBy: { totalReach: 'desc' },
        take: 5,
      },
    },
  });

  const totalCreators = await prisma.adCreator.count({ where });

  return {
    totalMatching: totalCreators,
    showing: creators.length,
    creators: creators.map((c) => ({
      name: c.pageName,
      totalAds: c.totalAds,
      totalReach: c.totalReach,
      brandCount: c.brandCount,
      topBrands: c.partnerships.map((p) => ({
        brand: p.brand.pageName,
        category: p.brand.category,
        country: p.brand.country,
        ads: p.adCount,
        reach: p.totalReach,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<{ result: string; summary: string }> {
  let data: unknown;
  let summary: string;

  switch (name) {
    case 'search_ads': {
      const res = await searchAds(input as Parameters<typeof searchAds>[0]);
      data = res;
      summary = `Found ${res.length} ads${input.brandName ? ` for "${input.brandName}"` : ''}${input.search ? ` matching "${input.search}"` : ''}`;
      break;
    }
    case 'get_brand_stats': {
      const res = await getBrandStats(input as Parameters<typeof getBrandStats>[0]);
      data = res;
      if ('error' in res) {
        summary = res.error as string;
      } else {
        summary = `${res.name}: ${res.activeAds} active ads, ${Number(res.totalReach || 0).toLocaleString()} total reach`;
      }
      break;
    }
    case 'compare_brands': {
      const res = await compareBrands(input as Parameters<typeof compareBrands>[0]);
      data = res;
      summary = `Compared ${res.length} brands: ${res.map((r) => ('name' in r ? r.name : (r as { name?: string }).name) || 'unknown').join(', ')}`;
      break;
    }
    case 'get_overview_stats': {
      const res = await getOverviewStats();
      data = res;
      summary = `Database: ${res.totalBrands} brands, ${res.totalAds} ads (${res.activeAds} active)`;
      break;
    }
    case 'get_category_insights': {
      const res = await getCategoryInsights(input as Parameters<typeof getCategoryInsights>[0]);
      data = res;
      if ('error' in res) {
        summary = res.error as string;
      } else {
        summary = `Category "${res.category}": ${res.brandCount} brands`;
      }
      break;
    }
    case 'get_sov_timeline': {
      const res = await getSovTimeline(input as Parameters<typeof getSovTimeline>[0]);
      data = res;
      if ('error' in res) {
        summary = res.error as string;
      } else {
        summary = `SoV timeline for "${res.category}": ${res.timeline.length} weeks of ${res.metric} data`;
      }
      break;
    }
    case 'get_creative_analysis': {
      const res = await getCreativeAnalysis(input as Parameters<typeof getCreativeAnalysis>[0]);
      data = res;
      summary = `Found ${res.length} creative analyses${input.brandName ? ` for "${input.brandName}"` : ''}${input.category ? ` in "${input.category}"` : ''}`;
      break;
    }
    case 'get_ad_templates': {
      const res = await getAdTemplates(input as Parameters<typeof getAdTemplates>[0]);
      data = res;
      summary = `Found ${res.length} ad templates${input.category ? ` for "${input.category}"` : ''}`;
      break;
    }
    case 'get_format_breakdown': {
      const res = await getFormatBreakdown(input as Parameters<typeof getFormatBreakdown>[0]);
      data = res;
      summary = `Format breakdown: ${res.totalAds} ads across ${res.formats.length} formats`;
      break;
    }
    case 'search_creators': {
      const res = await searchCreators(input as Parameters<typeof searchCreators>[0]);
      data = res;
      summary = `Found ${res.totalMatching} creators${input.brandName ? ` partnering with "${input.brandName}"` : ''}${input.category ? ` in ${input.category}` : ''} (showing ${res.showing})`;
      break;
    }
    default:
      data = { error: `Unknown tool: ${name}` };
      summary = `Unknown tool: ${name}`;
  }

  return { result: safeSerialize(data), summary };
}

// ---------------------------------------------------------------------------
// Friendly label for thinking events
// ---------------------------------------------------------------------------
function toolThinkingLabel(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'search_ads':
      return `Searching ads${input.brandName ? ` for ${input.brandName}` : ''}${input.search ? ` matching "${input.search}"` : ''}...`;
    case 'get_brand_stats':
      return `Looking up stats for ${input.brandName}...`;
    case 'compare_brands':
      return `Comparing ${(input.brandNames as string[])?.join(', ')}...`;
    case 'get_overview_stats':
      return 'Fetching database overview...';
    case 'get_category_insights':
      return `Analyzing ${input.category} category...`;
    case 'get_sov_timeline':
      return `Pulling Share of Voice timeline for ${input.category}...`;
    case 'get_creative_analysis':
      return `Analyzing creative strategies${input.brandName ? ` for ${input.brandName}` : ''}...`;
    case 'get_ad_templates':
      return `Fetching ad templates${input.category ? ` for ${input.category}` : ''}...`;
    case 'get_format_breakdown':
      return `Breaking down formats${input.brandName ? ` for ${input.brandName}` : ''}...`;
    case 'search_creators':
      return `Searching creators${input.brandName ? ` partnering with ${input.brandName}` : ''}${input.category ? ` in ${input.category}` : ''}...`;
    default:
      return `Running ${name}...`;
  }
}

// ---------------------------------------------------------------------------
// POST handler — streaming SSE response with agentic tool loop
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const { messages, brandProfileId } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400 });
    }

    // Build typed message history
    let currentMessages: Anthropic.MessageParam[] = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    );

    // Fetch brand profile and build dynamic system prompt (once, before the loop)
    let systemPrompt = HIKARU_SYSTEM_PROMPT;
    if (brandProfileId && typeof brandProfileId === 'string') {
      try {
        const profile = await prisma.brandProfile.findUnique({
          where: { id: brandProfileId },
          include: {
            competitors: {
              include: {
                adLibraryBrand: {
                  select: { id: true, pageId: true, pageName: true, profilePicUrl: true },
                },
              },
            },
          },
        });
        if (profile) {
          systemPrompt += compileBrandContext(profile as unknown as BrandProfileFull);
        }
      } catch {
        // Non-blocking: proceed without brand context
      }
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          // --- Agentic tool loop (non-streaming calls) ---
          let iterations = 0;
          const maxIterations = 15;

          while (iterations < maxIterations) {
            iterations++;

            const response = await client.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: systemPrompt,
              tools,
              messages: currentMessages,
            });

            if (response.stop_reason === 'tool_use') {
              // Process each tool call — send thinking + result events
              const toolResults: Anthropic.ToolResultBlockParam[] = [];

              for (const block of response.content) {
                if (block.type === 'tool_use') {
                  const input = block.input as Record<string, unknown>;

                  // Send thinking event
                  send({
                    type: 'thinking',
                    step: toolThinkingLabel(block.name, input),
                  });

                  // Execute tool
                  const { result, summary } = await executeTool(block.name, input);

                  // Send tool result summary
                  send({
                    type: 'tool_result',
                    tool: block.name,
                    summary,
                  });

                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: result,
                  });
                }
              }

              // Append to conversation and continue loop
              currentMessages = [
                ...currentMessages,
                { role: 'assistant', content: response.content },
                { role: 'user', content: toolResults },
              ];
            } else {
              // Final response — extract full text and stream it in chunks
              const fullText = response.content
                .filter((b): b is Anthropic.TextBlock => b.type === 'text')
                .map((b) => b.text)
                .join('\n');

              // Stream text in chunks for a responsive feel
              const chunkSize = 20; // characters per chunk
              for (let i = 0; i < fullText.length; i += chunkSize) {
                const chunk = fullText.slice(i, i + chunkSize);
                send({ type: 'text', content: chunk });
              }

              send({ type: 'done' });
              controller.close();
              return;
            }
          }

          // If we exhausted iterations
          send({
            type: 'text',
            content:
              'I hit my processing limit for this question. Here is what I gathered so far — please try a more specific question.',
          });
          send({ type: 'done' });
          controller.close();
        } catch (err) {
          console.error('Hikaru stream error:', err);
          send({
            type: 'text',
            content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
          });
          send({ type: 'done' });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Hikaru error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Chat failed',
      }),
      { status: 500 }
    );
  }
}
