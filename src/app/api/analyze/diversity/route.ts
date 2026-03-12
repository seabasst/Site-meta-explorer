import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const client = new Anthropic();

interface PillarClassification {
  format: string;
  tone: string;
  journeyPhase: string;
  visualStyle: string;
  messenger: string;
}

interface AdSummary {
  adId: string;
  body: string | null;
  title: string | null;
  displayFormat: string | null;
  ctaType: string | null;
  ctaText: string | null;
  linkUrl: string | null;
  startDate: string | null;
  pillars?: PillarClassification;
}

interface PillarDistribution {
  format: Record<string, number>;
  tone: Record<string, number>;
  journeyPhase: Record<string, number>;
  visualStyle: Record<string, number>;
  messenger: Record<string, number>;
}

interface Recommendation {
  pillar: string;
  gap: string;
  suggestion: string;
  briefTitle: string;
  briefDescription: string;
  imagePrompt: string;
  priority: 'high' | 'medium' | 'low';
}

export async function POST(request: NextRequest) {
  try {
    const { pageId } = await request.json();

    if (!pageId) {
      return Response.json({ error: 'pageId required' }, { status: 400 });
    }

    // Find brand
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: { id: true, pageName: true, category: true },
    });

    if (!brand) {
      return Response.json({ error: 'Brand not found in database' }, { status: 404 });
    }

    // Fetch all active ads (we only need copy/metadata, not assets)
    const ads = await prisma.adLibraryAd.findMany({
      where: { brandId: brand.id, isActive: true },
      select: {
        id: true,
        adId: true,
        body: true,
        title: true,
        displayFormat: true,
        ctaType: true,
        ctaText: true,
        linkUrl: true,
        startDate: true,
        publisherPlatforms: true,
      },
      orderBy: { startDate: 'desc' },
      take: 100,
    });

    if (ads.length === 0) {
      return Response.json({ error: 'No active ads found for this brand' }, { status: 404 });
    }

    // Prepare ad summaries for Claude
    const adSummaries: AdSummary[] = ads.map((ad) => ({
      adId: ad.adId,
      body: ad.body?.slice(0, 200) || null,
      title: ad.title,
      displayFormat: ad.displayFormat,
      ctaType: ad.ctaType,
      ctaText: ad.ctaText,
      linkUrl: ad.linkUrl,
      startDate: ad.startDate?.toISOString().split('T')[0] || null,
    }));

    // Classify all ads across the Five Pillars in one call
    const classifyResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `You are an expert Meta Ads analyst. Classify each of these ${ads.length} ads from "${brand.pageName}" across the Five Pillars of Creative Diversity.

**The Five Pillars (use ONLY these exact category values):**

1. FORMAT: "static-image" | "video" | "carousel" | "reel" | "story" | "collection"
2. TONE & ANGLE: "aspirational" | "problem-solving" | "educational" | "social-proof" | "humor" | "urgency" | "price-focused" | "emotional"
3. CUSTOMER JOURNEY PHASE: "awareness" | "consideration" | "conversion"
4. VISUAL STYLE: "studio" | "ugc" | "minimal" | "lifestyle" | "before-after" | "product-shot" | "illustration" | "selfie"
5. MESSENGER & VOICE: "brand" | "founder" | "influencer" | "customer" | "expert"

Ads to classify:
${JSON.stringify(adSummaries, null, 2)}

Classify each ad. If you can't determine a pillar from the copy, make your best inference from the ad copy tone, CTA, and format.

Return a JSON array with one object per ad:
[
  {
    "adId": "the ad's adId",
    "format": "one of the format values",
    "tone": "one of the tone values",
    "journeyPhase": "one of the journey values",
    "visualStyle": "one of the visual values",
    "messenger": "one of the messenger values"
  }
]

Return ONLY valid JSON, no markdown.`,
        },
      ],
    });

    const classifyText = classifyResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const classifyJson = classifyText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const classifications: Array<PillarClassification & { adId: string }> = JSON.parse(classifyJson);

    // Build distribution counts
    const distribution: PillarDistribution = {
      format: {},
      tone: {},
      journeyPhase: {},
      visualStyle: {},
      messenger: {},
    };

    for (const c of classifications) {
      distribution.format[c.format] = (distribution.format[c.format] || 0) + 1;
      distribution.tone[c.tone] = (distribution.tone[c.tone] || 0) + 1;
      distribution.journeyPhase[c.journeyPhase] = (distribution.journeyPhase[c.journeyPhase] || 0) + 1;
      distribution.visualStyle[c.visualStyle] = (distribution.visualStyle[c.visualStyle] || 0) + 1;
      distribution.messenger[c.messenger] = (distribution.messenger[c.messenger] || 0) + 1;
    }

    // Calculate diversity scores (0-100) per pillar
    // Higher = more diverse (more even distribution across categories)
    const calcDiversityScore = (counts: Record<string, number>, maxCategories: number): number => {
      const values = Object.values(counts);
      if (values.length <= 1) return 0;
      const total = values.reduce((s, v) => s + v, 0);
      // Shannon entropy normalized
      let entropy = 0;
      for (const v of values) {
        if (v > 0) {
          const p = v / total;
          entropy -= p * Math.log2(p);
        }
      }
      const maxEntropy = Math.log2(maxCategories);
      return Math.round((entropy / maxEntropy) * 100);
    };

    const diversityScores = {
      format: calcDiversityScore(distribution.format, 6),
      tone: calcDiversityScore(distribution.tone, 8),
      journeyPhase: calcDiversityScore(distribution.journeyPhase, 3),
      visualStyle: calcDiversityScore(distribution.visualStyle, 8),
      messenger: calcDiversityScore(distribution.messenger, 5),
      overall: 0,
    };
    diversityScores.overall = Math.round(
      (diversityScores.format + diversityScores.tone + diversityScores.journeyPhase +
        diversityScores.visualStyle + diversityScores.messenger) / 5
    );

    // Generate recommendations based on gaps
    const recResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are an expert Meta Ads strategist. Based on this Five Pillars creative diversity analysis for "${brand.pageName}", identify gaps and recommend new creatives.

**Current Distribution (${classifications.length} ads analyzed):**
- FORMAT: ${JSON.stringify(distribution.format)}
- TONE: ${JSON.stringify(distribution.tone)}
- JOURNEY PHASE: ${JSON.stringify(distribution.journeyPhase)}
- VISUAL STYLE: ${JSON.stringify(distribution.visualStyle)}
- MESSENGER: ${JSON.stringify(distribution.messenger)}

**Diversity Scores (0-100, higher = more diverse):**
${JSON.stringify(diversityScores, null, 2)}

Analyze the distribution and generate exactly 5 recommendations for new creatives that would improve diversity. Focus on:
1. Missing or underrepresented categories in each pillar
2. Combinations that are completely absent (e.g., no UGC video with social-proof tone)
3. Journey phases that are weak (most brands over-index on conversion)

For each recommendation, provide a complete creative brief AND an image generation prompt.

Return JSON:
{
  "summary": "2-3 sentence overview of the brand's creative diversity health",
  "biggestGap": "The single most important gap to fill (1 sentence)",
  "recommendations": [
    {
      "pillar": "which pillar this primarily addresses (format | tone | journeyPhase | visualStyle | messenger)",
      "gap": "what's missing (1 sentence)",
      "suggestion": "what to create (1 sentence)",
      "briefTitle": "creative brief title",
      "briefDescription": "Full creative brief: describe the ad concept, visual direction, copy angle, target audience, and platform. 3-5 sentences.",
      "imagePrompt": "Detailed prompt for AI image generation: describe the exact scene, photography style, lighting, colors, subjects, composition. No text/words in image. Make it look like a real ad photo. 2-3 sentences.",
      "priority": "high | medium | low"
    }
  ]
}

Return ONLY valid JSON, no markdown.`,
        },
      ],
    });

    const recText = recResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const recJson = recText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const recommendations = JSON.parse(recJson);

    return Response.json({
      brandName: brand.pageName,
      category: brand.category,
      totalAdsAnalyzed: classifications.length,
      distribution,
      diversityScores,
      classifications: classifications.map((c) => ({
        adId: c.adId,
        format: c.format,
        tone: c.tone,
        journeyPhase: c.journeyPhase,
        visualStyle: c.visualStyle,
        messenger: c.messenger,
      })),
      summary: recommendations.summary,
      biggestGap: recommendations.biggestGap,
      recommendations: recommendations.recommendations,
    });
  } catch (error) {
    console.error('Diversity analysis error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Diversity analysis failed' },
      { status: 500 }
    );
  }
}
