import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const client = new Anthropic();

const R2_PUBLIC_URL = 'https://pub-25ef069908854da9871d20aea605675a.r2.dev';

interface AnalysisResult {
  headline: string;
  messagingAngle: string;
  visualStyle: string;
  colorPalette: string[];
  ctaStyle: string;
  targetAudience: string;
  emotionalTone: string;
  creativityScore: number;
  clarityScore: number;
  persuasionScore: number;
  keyElements: string[];
  whyItWorks: string;
}

// Analyze a single ad with vision
async function analyzeAdImage(
  imageUrl: string,
  adContext: { body?: string | null; title?: string | null; brand: string; format?: string | null }
): Promise<AnalysisResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: imageUrl },
          },
          {
            type: 'text',
            text: `Analyze this Facebook/Meta ad creative for ${adContext.brand}.
${adContext.body ? `Ad copy: "${adContext.body.slice(0, 300)}"` : ''}
${adContext.title ? `Title: "${adContext.title}"` : ''}
Format: ${adContext.format || 'image'}

Return a JSON object with EXACTLY these fields:
{
  "headline": "the main headline or hook pattern used",
  "messagingAngle": "one of: price-focused, emotional, urgency, social-proof, lifestyle, educational, humor, fear-of-missing-out",
  "visualStyle": "one of: lifestyle, product-shot, UGC-style, minimal, illustration, destination, before-after, testimonial",
  "colorPalette": ["#hex1", "#hex2", "#hex3"] (3 dominant colors),
  "ctaStyle": "description of the call-to-action approach",
  "targetAudience": "inferred target audience in 10 words or less",
  "emotionalTone": "one of: aspirational, urgent, playful, trustworthy, exciting, calm, bold, nostalgic",
  "creativityScore": 1-10,
  "clarityScore": 1-10,
  "persuasionScore": 1-10,
  "keyElements": ["element1", "element2", "element3"] (3 standout creative elements),
  "whyItWorks": "one sentence on what makes this ad effective or ineffective"
}

Return ONLY valid JSON, no markdown.`,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Parse JSON, handling potential markdown wrapping
  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// Analyze a video ad using copy/metadata only (no vision)
async function analyzeAdCopy(adContext: {
  body?: string | null;
  title?: string | null;
  brand: string;
  format?: string | null;
}): Promise<AnalysisResult> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analyze this Facebook/Meta video ad for ${adContext.brand} based on its copy.
${adContext.body ? `Ad copy: "${adContext.body.slice(0, 500)}"` : 'No ad copy available.'}
${adContext.title ? `Title: "${adContext.title}"` : ''}
Format: ${adContext.format || 'video'}

Return a JSON object with EXACTLY these fields:
{
  "headline": "the main headline or hook pattern used",
  "messagingAngle": "one of: price-focused, emotional, urgency, social-proof, lifestyle, educational, humor, fear-of-missing-out",
  "visualStyle": "one of: lifestyle, product-shot, UGC-style, minimal, illustration, destination, before-after, testimonial (infer from copy)",
  "colorPalette": ["#333333", "#666666", "#999999"] (estimate brand-appropriate colors),
  "ctaStyle": "description of the call-to-action approach",
  "targetAudience": "inferred target audience in 10 words or less",
  "emotionalTone": "one of: aspirational, urgent, playful, trustworthy, exciting, calm, bold, nostalgic",
  "creativityScore": 1-10,
  "clarityScore": 1-10,
  "persuasionScore": 1-10,
  "keyElements": ["element1", "element2", "element3"] (3 standout copy elements),
  "whyItWorks": "one sentence on what makes this ad copy effective or ineffective"
}

Return ONLY valid JSON, no markdown.`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

// Generate templates from a batch of analyses
async function generateTemplates(
  analyses: Array<{ analysis: AnalysisResult; adBody?: string | null; adTitle?: string | null; brand: string }>,
  category: string
): Promise<Array<{
  name: string;
  description: string;
  messagingAngle: string;
  visualStyle: string;
  headlineFormula: string;
  bodyFormula: string;
  ctaText: string;
  colorSuggestions: string[];
  imageryNotes: string;
  layoutNotes: string;
  formatRecommendation: string;
  platformNotes: string;
}>> {
  const summaryData = analyses.map((a) => ({
    brand: a.brand,
    angle: a.analysis.messagingAngle,
    visual: a.analysis.visualStyle,
    tone: a.analysis.emotionalTone,
    headline: a.analysis.headline,
    body: a.adBody?.slice(0, 150),
    cta: a.analysis.ctaStyle,
    colors: a.analysis.colorPalette,
    scores: {
      creativity: a.analysis.creativityScore,
      clarity: a.analysis.clarityScore,
      persuasion: a.analysis.persuasionScore,
    },
    whyItWorks: a.analysis.whyItWorks,
  }));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert ad strategist. Analyze these ${analyses.length} top-performing ${category} ads and create 3-5 reusable ad templates.

Ad analyses:
${JSON.stringify(summaryData, null, 2)}

Create templates that capture the PATTERNS across these ads. Each template should be a formula that anyone can use.

Return a JSON array of templates:
[
  {
    "name": "Short catchy template name (e.g. 'Destination Dream')",
    "description": "When to use this template (1-2 sentences)",
    "messagingAngle": "price-focused | emotional | urgency | social-proof | lifestyle | educational",
    "visualStyle": "lifestyle | product-shot | UGC-style | minimal | destination | testimonial",
    "headlineFormula": "Formula with {placeholders} e.g. 'Fly to {destination} from {price}'",
    "bodyFormula": "Full ad copy template with {placeholders}. 2-3 sentences.",
    "ctaText": "Recommended CTA text",
    "colorSuggestions": ["#hex1", "#hex2", "#hex3"],
    "imageryNotes": "What imagery to use (1-2 sentences)",
    "layoutNotes": "How to layout the ad (1-2 sentences)",
    "formatRecommendation": "image | video | carousel",
    "platformNotes": "Platform-specific tips"
  }
]

Make templates specific to the ${category} industry but generic enough that any brand can use them. Use {brand}, {product}, {price}, {destination}, {benefit}, {cta_url} as placeholders.

Return ONLY valid JSON array, no markdown.`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

export async function POST(request: NextRequest) {
  try {
    const { category, brandId, limit = 10 } = await request.json();

    if (!category && !brandId) {
      return Response.json({ error: 'category or brandId required' }, { status: 400 });
    }

    const cappedLimit = Math.min(limit, 30);

    // Build query for top ads with downloaded assets
    const where: Record<string, unknown> = {
      isActive: true,
      assets: { some: { downloadStatus: 'completed', storedUrl: { not: null } } },
    };

    if (brandId) {
      where.brandId = brandId;
    } else if (category) {
      where.brand = { category: { equals: category, mode: 'insensitive' } };
    }

    // Get top ads by reach that have images
    const ads = await prisma.adLibraryAd.findMany({
      where,
      select: {
        id: true,
        adId: true,
        body: true,
        title: true,
        displayFormat: true,
        reachEstimate: true,
        brand: { select: { pageName: true, category: true } },
        assets: {
          where: { downloadStatus: 'completed', storedUrl: { not: null } },
          select: { storedUrl: true, storedKey: true, assetType: true },
          take: 1,
        },
        analysis: { select: { id: true } },
      },
      orderBy: { reachEstimate: 'desc' },
      take: cappedLimit,
    });

    console.log(`[analyze] Found ${ads.length} ads for category=${category} brandId=${brandId}`);

    if (ads.length === 0) {
      return Response.json({ error: 'No ads with downloaded assets found' }, { status: 404 });
    }

    // Analyze ads that don't have cached analysis
    const analysisResults: Array<{
      adId: string;
      analysis: AnalysisResult;
      adBody?: string | null;
      adTitle?: string | null;
      brand: string;
    }> = [];

    // Separate cached vs needs-analysis
    const needsAnalysis: typeof ads = [];
    for (const ad of ads) {
      if (ad.analysis) {
        const cached = await prisma.adAnalysis.findUnique({
          where: { adId: ad.id },
        });
        if (cached?.fullAnalysis) {
          analysisResults.push({
            adId: ad.id,
            analysis: cached.fullAnalysis as unknown as AnalysisResult,
            adBody: ad.body,
            adTitle: ad.title,
            brand: ad.brand.pageName,
          });
          continue;
        }
      }
      if (ad.assets[0]?.storedKey) {
        needsAnalysis.push(ad);
      }
    }

    console.log(`[analyze] ${analysisResults.length} cached, ${needsAnalysis.length} to analyze`);

    // Analyze in parallel batches of 5
    const BATCH_SIZE = 5;
    for (let i = 0; i < needsAnalysis.length; i += BATCH_SIZE) {
      const batch = needsAnalysis.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (ad) => {
          const asset = ad.assets[0];
          const assetUrl = `${R2_PUBLIC_URL}/${asset.storedKey}`;
          const isVideo = asset.assetType === 'video';

          const analysis = isVideo
            ? await analyzeAdCopy({
                body: ad.body,
                title: ad.title,
                brand: ad.brand.pageName,
                format: ad.displayFormat,
              })
            : await analyzeAdImage(assetUrl, {
                body: ad.body,
                title: ad.title,
                brand: ad.brand.pageName,
                format: ad.displayFormat,
              });

          // Cache in DB
          const data = {
            headline: analysis.headline,
            messagingAngle: analysis.messagingAngle,
            visualStyle: analysis.visualStyle,
            colorPalette: analysis.colorPalette,
            ctaStyle: analysis.ctaStyle,
            targetAudience: analysis.targetAudience,
            emotionalTone: analysis.emotionalTone,
            creativityScore: analysis.creativityScore,
            clarityScore: analysis.clarityScore,
            persuasionScore: analysis.persuasionScore,
            fullAnalysis: JSON.parse(JSON.stringify(analysis)),
          };

          await prisma.adAnalysis.upsert({
            where: { adId: ad.id },
            create: { adId: ad.id, ...data },
            update: data,
          });

          return {
            adId: ad.id,
            analysis,
            adBody: ad.body,
            adTitle: ad.title,
            brand: ad.brand.pageName,
          };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          analysisResults.push(result.value);
        } else {
          const errMsg = result.reason?.message || String(result.reason);
          console.error(`[analyze] Failed: ${errMsg}`);
          if (errMsg.includes('authentication') || errMsg.includes('api_key') || errMsg.includes('401')) {
            return Response.json({ error: `AI API error: ${errMsg}` }, { status: 500 });
          }
        }
      }
    }

    console.log(`[analyze] Total analyzed: ${analysisResults.length}`);

    if (analysisResults.length === 0) {
      return Response.json(
        { error: 'No ads could be analyzed. Check server logs for details.' },
        { status: 500 }
      );
    }

    // Generate templates from analyses
    const categoryName = category || ads[0]?.brand.category || 'general';
    const templates = await generateTemplates(analysisResults, categoryName);

    // Store templates
    const storedTemplates = await Promise.all(
      templates.map(async (t) => {
        return prisma.adTemplate.create({
          data: {
            category: categoryName,
            brandId: brandId || null,
            sourceAdIds: analysisResults.map((a) => a.adId),
            name: t.name,
            description: t.description,
            messagingAngle: t.messagingAngle,
            visualStyle: t.visualStyle,
            headlineFormula: t.headlineFormula,
            bodyFormula: t.bodyFormula,
            ctaText: t.ctaText,
            colorSuggestions: t.colorSuggestions,
            imageryNotes: t.imageryNotes,
            layoutNotes: t.layoutNotes,
            formatRecommendation: t.formatRecommendation || null,
            platformNotes: t.platformNotes || null,
          },
        });
      })
    );

    return Response.json({
      adsAnalyzed: analysisResults.length,
      analyses: analysisResults.map((a) => ({
        adId: a.adId,
        brand: a.brand,
        ...a.analysis,
      })),
      templates: storedTemplates,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

// GET: Retrieve cached analyses and templates
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const brandId = searchParams.get('brandId');

  try {
    // Get templates
    const templateWhere: Record<string, unknown> = {};
    if (category) templateWhere.category = { equals: category, mode: 'insensitive' };
    if (brandId) templateWhere.brandId = brandId;

    const templates = await prisma.adTemplate.findMany({
      where: templateWhere,
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get analyses
    const analysisWhere: Record<string, unknown> = {};
    if (brandId) {
      analysisWhere.ad = { brandId };
    } else if (category) {
      analysisWhere.ad = { brand: { category: { equals: category, mode: 'insensitive' } } };
    }

    const analyses = await prisma.adAnalysis.findMany({
      where: analysisWhere,
      include: {
        ad: {
          select: {
            adId: true,
            body: true,
            title: true,
            displayFormat: true,
            reachEstimate: true,
            brand: { select: { pageName: true } },
            assets: {
              where: { downloadStatus: 'completed' },
              select: { storedUrl: true, storedKey: true, assetType: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return Response.json({ templates, analyses });
  } catch (error) {
    console.error('Fetch analysis error:', error);
    return Response.json({ error: 'Failed to fetch analyses' }, { status: 500 });
  }
}
