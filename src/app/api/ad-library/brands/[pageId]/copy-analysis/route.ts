import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const client = new Anthropic();

// =============================================================================
// Types
// =============================================================================

interface MessagingTheme {
  theme: string;
  adCount: number;
  exampleSnippets: string[];
}

interface ToneProfile {
  description: string;
  consistencyScore: number;
  dominantTraits: string[];
}

interface CtaAnalysis {
  distribution: Record<string, number>;
  effectivenessPatterns: string[];
  topPerforming: string | null;
}

interface HookPattern {
  category: string;
  pattern: string;
  frequency: number;
  examples: string[];
}

interface CopyLengthAnalysis {
  averageLength: number;
  minLength: number;
  maxLength: number;
  sweetSpot: string;
  distribution: Record<string, number>;
}

interface ContentStrategyInsights {
  workingPatterns: string[];
  gaps: string[];
  recommendations: string[];
}

interface CopyAnalysisResult {
  messagingThemes: MessagingTheme[];
  toneProfile: ToneProfile;
  ctaAnalysis: CtaAnalysis;
  hookPatterns: HookPattern[];
  contentStrategy: ContentStrategyInsights;
  copyLength: CopyLengthAnalysis;
  metadata: {
    totalAdsAnalyzed: number;
    totalAdsInLibrary: number;
    sampledAt: string;
    brandName: string;
  };
}

// =============================================================================
// In-memory cache (keyed by pageId, with timestamp)
// =============================================================================

const analysisCache = new Map<
  string,
  { result: CopyAnalysisResult; timestamp: number }
>();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// =============================================================================
// Helpers
// =============================================================================

/** Take a random sample of up to `n` items from an array */
function randomSample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, n);
}

/** Compute copy length stats from ads */
function computeLengthStats(
  ads: Array<{ body: string | null }>
): Pick<CopyLengthAnalysis, 'averageLength' | 'minLength' | 'maxLength' | 'distribution'> {
  const lengths = ads
    .map((a) => (a.body ?? '').length)
    .filter((l) => l > 0);

  if (lengths.length === 0) {
    return { averageLength: 0, minLength: 0, maxLength: 0, distribution: {} };
  }

  const sum = lengths.reduce((a, b) => a + b, 0);
  const distribution: Record<string, number> = {
    'short (0-50)': 0,
    'medium (51-150)': 0,
    'long (151-300)': 0,
    'very long (300+)': 0,
  };

  for (const len of lengths) {
    if (len <= 50) distribution['short (0-50)']++;
    else if (len <= 150) distribution['medium (51-150)']++;
    else if (len <= 300) distribution['long (151-300)']++;
    else distribution['very long (300+)']++;
  }

  return {
    averageLength: Math.round(sum / lengths.length),
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
    distribution,
  };
}

/** Build the CTA distribution from raw ads */
function buildCtaDistribution(
  ads: Array<{ ctaText: string | null }>
): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const ad of ads) {
    const cta = ad.ctaText ?? 'No CTA';
    dist[cta] = (dist[cta] || 0) + 1;
  }
  return dist;
}

// =============================================================================
// GET /api/ad-library/brands/[pageId]/copy-analysis
// Analyze ad copy for a brand using Claude
// =============================================================================

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { pageId } = await params;

    // Check cache first
    const cached = analysisCache.get(pageId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.result,
        metadata: { ...cached.result.metadata, cached: true },
      });
    }

    // Find brand by pageId
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
    });

    if (!brand) {
      return NextResponse.json(
        { error: 'Brand not found' },
        { status: 404 }
      );
    }

    // Fetch all ads with copy fields
    const allAds = await prisma.adLibraryAd.findMany({
      where: { brandId: brand.id },
      select: {
        body: true,
        title: true,
        ctaText: true,
        displayFormat: true,
        startDate: true,
      },
    });

    if (allAds.length === 0) {
      return NextResponse.json(
        { error: 'No ads found for this brand' },
        { status: 404 }
      );
    }

    // Filter to ads that have at least some copy content
    const adsWithCopy = allAds.filter(
      (ad) => ad.body || ad.title
    );

    if (adsWithCopy.length === 0) {
      return NextResponse.json(
        { error: 'No ads with copy content found for this brand' },
        { status: 404 }
      );
    }

    // Random sample of up to 100 ads for the AI analysis
    const sampledAds = randomSample(adsWithCopy, 100);

    // Pre-compute stats from ALL ads (not just the sample)
    const lengthStats = computeLengthStats(adsWithCopy);
    const ctaDistribution = buildCtaDistribution(allAds);

    // Build ad copy payload for the prompt
    const adCopyPayload = sampledAds.map((ad, i) => ({
      index: i + 1,
      body: ad.body ?? '',
      title: ad.title ?? '',
      cta: ad.ctaText ?? '',
      format: ad.displayFormat ?? 'unknown',
      date: ad.startDate ? ad.startDate.toISOString().split('T')[0] : null,
    }));

    // Build the prompt
    const prompt = `You are an expert ad copy analyst. Analyze the following ${sampledAds.length} Facebook/Instagram ads from the brand "${brand.pageName}" and provide a structured analysis.

**Pre-computed statistics (from all ${allAds.length} ads):**
- CTA distribution: ${JSON.stringify(ctaDistribution)}
- Copy length: avg=${lengthStats.averageLength} chars, min=${lengthStats.minLength}, max=${lengthStats.maxLength}
- Length distribution: ${JSON.stringify(lengthStats.distribution)}

**Ad copy samples (${sampledAds.length} of ${adsWithCopy.length} ads with copy):**
${JSON.stringify(adCopyPayload, null, 1)}

Analyze the ad copy and respond with ONLY valid JSON matching this exact schema (no markdown, no explanation):

{
  "messagingThemes": [
    {
      "theme": "Theme name",
      "adCount": 0,
      "exampleSnippets": ["snippet1", "snippet2"]
    }
  ],
  "toneProfile": {
    "description": "Overall brand voice description in 2-3 sentences",
    "consistencyScore": 0,
    "dominantTraits": ["trait1", "trait2", "trait3"]
  },
  "ctaAnalysis": {
    "effectivenessPatterns": ["pattern1", "pattern2"],
    "topPerforming": "most common or effective CTA text"
  },
  "hookPatterns": [
    {
      "category": "Category name (e.g., Question, Statistic, Pain Point, Social Proof, Urgency)",
      "pattern": "Description of the hook pattern",
      "frequency": 0,
      "examples": ["example1", "example2"]
    }
  ],
  "contentStrategy": {
    "workingPatterns": ["pattern1", "pattern2"],
    "gaps": ["gap1", "gap2"],
    "recommendations": ["rec1", "rec2"]
  },
  "copyLength": {
    "sweetSpot": "Description of the optimal copy length range based on the data"
  }
}

Requirements:
- messagingThemes: identify 5-8 recurring themes. Count how many ads in the sample match each theme. Include 2-3 short snippet examples per theme.
- toneProfile: describe the overall voice. consistencyScore from 0-100 (how consistent is the tone across ads).
- ctaAnalysis: note effectiveness patterns and which CTA seems strongest. I've already computed the distribution.
- hookPatterns: categorize the opening lines/hooks used. Group by type (Question, Statistic, Pain Point, Social Proof, Urgency, Direct Benefit, Story, etc.)
- contentStrategy: what copy patterns appear most frequently (working), what's missing (gaps), and what they should try (recommendations).
- copyLength.sweetSpot: based on the length distribution, describe the ideal copy length range.

Respond ONLY with valid JSON. No markdown code fences.`;

    // Call Claude
    let analysisFromAI: Record<string, unknown>;
    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      analysisFromAI = JSON.parse(cleanJson) as Record<string, unknown>;
    } catch (aiError) {
      console.error('[copy-analysis] Claude API error:', aiError);
      // Return partial results with just the computed stats
      return NextResponse.json({
        messagingThemes: [],
        toneProfile: {
          description: 'Analysis unavailable — AI processing failed',
          consistencyScore: 0,
          dominantTraits: [],
        },
        ctaAnalysis: {
          distribution: ctaDistribution,
          effectivenessPatterns: [],
          topPerforming: null,
        },
        hookPatterns: [],
        contentStrategy: {
          workingPatterns: [],
          gaps: [],
          recommendations: [],
        },
        copyLength: {
          ...lengthStats,
          sweetSpot: 'Analysis unavailable',
        },
        metadata: {
          totalAdsAnalyzed: sampledAds.length,
          totalAdsInLibrary: allAds.length,
          sampledAt: new Date().toISOString(),
          brandName: brand.pageName,
          partial: true,
          error: aiError instanceof Error ? aiError.message : 'AI analysis failed',
        },
      });
    }

    // Merge AI results with pre-computed stats
    const aiCtaAnalysis = (analysisFromAI.ctaAnalysis ?? {}) as Record<string, unknown>;
    const aiCopyLength = (analysisFromAI.copyLength ?? {}) as Record<string, unknown>;

    const result: CopyAnalysisResult = {
      messagingThemes: (analysisFromAI.messagingThemes as MessagingTheme[]) ?? [],
      toneProfile: (analysisFromAI.toneProfile as ToneProfile) ?? {
        description: '',
        consistencyScore: 0,
        dominantTraits: [],
      },
      ctaAnalysis: {
        distribution: ctaDistribution,
        effectivenessPatterns: (aiCtaAnalysis.effectivenessPatterns as string[]) ?? [],
        topPerforming: (aiCtaAnalysis.topPerforming as string) ?? null,
      },
      hookPatterns: (analysisFromAI.hookPatterns as HookPattern[]) ?? [],
      contentStrategy: (analysisFromAI.contentStrategy as ContentStrategyInsights) ?? {
        workingPatterns: [],
        gaps: [],
        recommendations: [],
      },
      copyLength: {
        ...lengthStats,
        sweetSpot: (aiCopyLength.sweetSpot as string) ?? 'Not determined',
      },
      metadata: {
        totalAdsAnalyzed: sampledAds.length,
        totalAdsInLibrary: allAds.length,
        sampledAt: new Date().toISOString(),
        brandName: brand.pageName,
      },
    };

    // Cache the result
    analysisCache.set(pageId, { result, timestamp: Date.now() });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/ad-library/brands/[pageId]/copy-analysis] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze brand copy' },
      { status: 500 }
    );
  }
}
