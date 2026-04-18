import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const client = new Anthropic();

interface AnalysisItem {
  adId: string;
  brand: string;
  headline: string;
  messagingAngle: string;
  visualStyle: string;
  colorPalette: string[];
  emotionalTone: string;
  creativityScore: number;
  clarityScore: number;
  persuasionScore: number;
  keyElements: string[];
  whyItWorks: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { brandName, brandPageId, competitorNames, myAnalyses, compAnalyses } =
      (await request.json()) as {
        brandName: string;
        brandPageId: string;
        competitorNames: string[];
        myAnalyses: AnalysisItem[];
        compAnalyses: AnalysisItem[];
      };

    if (!brandName || (!myAnalyses?.length && !compAnalyses?.length)) {
      return Response.json({ error: 'brandName and at least some analyses required' }, { status: 400 });
    }

    // Build summary data for the prompt
    const mySummary = myAnalyses.map((a) => ({
      headline: a.headline,
      angle: a.messagingAngle,
      visual: a.visualStyle,
      tone: a.emotionalTone,
      scores: { creativity: a.creativityScore, clarity: a.clarityScore, persuasion: a.persuasionScore },
      elements: a.keyElements,
      whyItWorks: a.whyItWorks,
    }));

    const compSummary = compAnalyses.map((a) => ({
      brand: a.brand,
      headline: a.headline,
      angle: a.messagingAngle,
      visual: a.visualStyle,
      tone: a.emotionalTone,
      scores: { creativity: a.creativityScore, clarity: a.clarityScore, persuasion: a.persuasionScore },
      elements: a.keyElements,
      whyItWorks: a.whyItWorks,
    }));

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are an expert Meta Ads strategist. Analyze the competitive landscape between "${brandName}" and their competitors (${competitorNames.join(', ') || 'unknown'}).

## ${brandName}'s Ad Analyses (${mySummary.length} ads):
${JSON.stringify(mySummary, null, 2)}

## Competitor Ad Analyses (${compSummary.length} ads):
${JSON.stringify(compSummary, null, 2)}

Provide TWO things in your response as a JSON object:

### 1. Competitive Insight
Analyze the creative strategies of both sides and identify:
- yourStrengths: 3-4 things ${brandName} does well in their ads
- competitorStrengths: 3-4 things competitors do better
- gaps: 3-4 creative approaches competitors use that ${brandName} is missing
- opportunities: 3-4 specific, actionable creative ideas ${brandName} should try to outperform competitors

### 2. Five Pillar Templates
Create EXACTLY 5 ad templates following the Five Pillars of Creative Diversity. Each template should be designed to BEAT the competition by exploiting the identified gaps and opportunities.

**The Five Pillars:**
1. FORMAT — Reels video, Stories, static image, carousel, lookbook
2. TONE & ANGLE — aspiration/lifestyle, problem-solving, expert/educational, social proof, entertainment/humor
3. CUSTOMER JOURNEY PHASE — awareness (storytelling), consideration (comparisons, reviews), conversion (offers, urgency)
4. VISUAL STYLE — polished studio, handheld UGC, minimalist product, selfie-style, before-after, lifestyle
5. MESSENGER & VOICE — founder narrative, influencer haul, customer review, brand storytelling, expert recommendation

Each template emphasizes a different pillar as its primary differentiator.

Return this exact JSON structure:
{
  "insight": {
    "yourStrengths": ["strength1", "strength2", "strength3"],
    "competitorStrengths": ["strength1", "strength2", "strength3"],
    "gaps": ["gap1", "gap2", "gap3"],
    "opportunities": ["opportunity1", "opportunity2", "opportunity3"]
  },
  "templates": [
    {
      "name": "Short catchy name",
      "description": "When to use this (1-2 sentences)",
      "primaryPillar": "format | tone | journey | visual | messenger",
      "pillarDetails": {
        "format": "e.g. Reels vertical video, 15-30s",
        "tone": "e.g. aspirational lifestyle",
        "journeyPhase": "e.g. awareness",
        "visualStyle": "e.g. polished studio",
        "messenger": "e.g. founder narrative"
      },
      "messagingAngle": "price-focused | emotional | urgency | social-proof | lifestyle | educational",
      "visualStyle": "lifestyle | product-shot | UGC-style | minimal | destination | testimonial",
      "headlineFormula": "Formula with {placeholders}",
      "bodyFormula": "Full ad copy template with {placeholders}. 2-3 sentences.",
      "ctaText": "CTA text",
      "colorSuggestions": ["#hex1", "#hex2", "#hex3"],
      "imageryNotes": "What imagery to use",
      "layoutNotes": "Layout recommendations",
      "formatRecommendation": "image | video | carousel | reel | story",
      "platformNotes": "Platform-specific tips"
    }
  ]
}

Make templates specific to beating the competition. Reference actual gaps and opportunities. Use {brand}, {product}, {price}, {benefit}, {cta_url} as placeholders.

Return ONLY valid JSON, no markdown.`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(jsonStr);

    // Resolve brandId for template storage
    let brandId: string | null = null;
    if (brandPageId) {
      const brand = await prisma.adLibraryBrand.findUnique({
        where: { pageId: brandPageId },
        select: { id: true, category: true },
      });
      if (brand) brandId = brand.id;
    }

    // Store templates in DB
    const storedTemplates = await Promise.all(
      (result.templates || []).map(async (t: Record<string, unknown>) => {
        return prisma.adTemplate.create({
          data: {
            category: brandName,
            ...(brandId ? { brand: { connect: { id: brandId } } } : {}),
            sourceAdIds: [
              ...myAnalyses.map((a) => a.adId),
              ...compAnalyses.map((a) => a.adId),
            ],
            name: t.name as string,
            description: t.description as string,
            messagingAngle: t.messagingAngle as string,
            visualStyle: t.visualStyle as string,
            primaryPillar: (t.primaryPillar as string) || null,
            pillarDetails: t.pillarDetails ? JSON.parse(JSON.stringify(t.pillarDetails)) : null,
            headlineFormula: t.headlineFormula as string,
            bodyFormula: t.bodyFormula as string,
            ctaText: t.ctaText as string,
            colorSuggestions: (t.colorSuggestions as string[]) || [],
            imageryNotes: t.imageryNotes as string,
            layoutNotes: t.layoutNotes as string,
            formatRecommendation: (t.formatRecommendation as string) || null,
            platformNotes: (t.platformNotes as string) || null,
          },
        });
      })
    );

    return Response.json({
      insight: result.insight,
      templates: storedTemplates,
    });
  } catch (error) {
    console.error('Strategy analysis error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Strategy analysis failed' },
      { status: 500 }
    );
  }
}
