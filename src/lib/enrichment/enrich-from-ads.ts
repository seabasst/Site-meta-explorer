// =============================================================================
// Enrich Brand Profile from Ad Library Data
// =============================================================================
// Core pipeline: gather ad data from DB, synthesize via Haiku, return
// extracted profile fields. Does NOT write to the database -- the caller
// (API endpoint) handles change detection, selective merge, and persistence.

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { CATEGORY_KEYS, type CategoryKey } from "@/lib/classification/taxonomy";
import { computeEnrichmentHash } from "./enrichment-hash";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentFields {
  brandVoice: string | null;
  positioning: string | null;
  demographics: string[];
  interests: string[];
  painPoints: string[];
  missionStatement: string | null;
}

export interface EnrichmentResult {
  fields: EnrichmentFields;
  hash: string;
  adCount: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5-20251001";

const ENRICHMENT_SYSTEM = `You are a brand analyst. Given ad library data for a brand, extract brand profile information. Only extract what is clearly supported by the data. Return null for any field without strong evidence.`;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Gather ad data for a brand and call Haiku to extract profile fields.
 * Throws if the brand has fewer than 3 classified ads.
 */
export async function enrichFromAds(brandId: string): Promise<EnrichmentResult> {
  // 1. Gather data in parallel
  const [brand, classifications, analyses, ads] = await Promise.all([
    prisma.adLibraryBrand.findUnique({
      where: { id: brandId },
      select: { pageName: true, category: true, website: true },
    }),
    prisma.adClassification.findMany({
      where: { ad: { brandId, isActive: true } },
      take: 100,
    }),
    prisma.adAnalysis.findMany({
      where: { ad: { brandId, isActive: true } },
      select: {
        emotionalTone: true,
        visualStyle: true,
        targetAudience: true,
        messagingAngle: true,
      },
      take: 50,
    }),
    prisma.adLibraryAd.findMany({
      where: { brandId, isActive: true },
      select: { body: true, ctaType: true, ctaText: true, title: true },
      orderBy: { startDate: "desc" },
      take: 20,
    }),
  ]);

  if (!brand) {
    throw new Error(`Brand not found: ${brandId}`);
  }

  const adCount = classifications.length;
  if (adCount < 3) {
    throw new Error(
      `Not enough classified ads for enrichment (need at least 3, found ${adCount})`
    );
  }

  // 2. Build classification distribution
  const distribution: Record<string, Record<string, number>> = {};
  for (const key of CATEGORY_KEYS) {
    distribution[key] = {};
    for (const c of classifications) {
      const val = c[key as CategoryKey] as string;
      if (val) distribution[key][val] = (distribution[key][val] || 0) + 1;
    }
  }

  // 3. Sample unique ad bodies (top 10)
  const uniqueBodies = [
    ...new Set(ads.map((a) => a.body).filter(Boolean)),
  ].slice(0, 10) as string[];

  // 4. Compute enrichment hash
  const hash = computeEnrichmentHash({
    classificationSummary: distribution,
    adCount,
    topAdBodies: uniqueBodies,
  });

  // 5. Build prompt
  const prompt = `Analyze this brand's ad library data and extract profile fields.

**Brand:** ${brand.pageName}
**Category:** ${brand.category || "Unknown"}
**Website:** ${brand.website || "Unknown"}
**Active Ads Analyzed:** ${adCount}

**Ad Classification Distribution (what types of ads they run):**
${JSON.stringify(distribution, null, 2)}

**Sample Ad Copy (most recent 10):**
${uniqueBodies.map((b, i) => `${i + 1}. ${b.slice(0, 200)}`).join("\n")}

**Ad Tone/Style Analysis:**
${analyses
  .slice(0, 10)
  .map(
    (a) =>
      `- Tone: ${a.emotionalTone || "?"}, Style: ${a.visualStyle || "?"}, Audience: ${a.targetAudience || "?"}`
  )
  .join("\n")}

Extract these fields:
{
  "brandVoice": "2-3 sentence description of brand's communication tone based on ad copy patterns, or null",
  "positioning": "1-2 sentence market positioning based on messaging angles and offer types, or null",
  "demographics": ["array of target demographic segments based on intendedAudience distribution and ad targeting"],
  "interests": ["array of audience interests inferred from ad themes and messaging"],
  "painPoints": ["array of customer pain points addressed in ad copy"],
  "missionStatement": "1 sentence brand mission if clearly evident from ads, or null"
}

Return ONLY valid JSON. No markdown.`;

  // 6. Call Haiku
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: ENRICHMENT_SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  // 7. Parse response
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  const parsed = JSON.parse(cleaned) as EnrichmentFields;

  // Normalize: ensure arrays are arrays, strings are strings or null
  const fields: EnrichmentFields = {
    brandVoice: typeof parsed.brandVoice === "string" ? parsed.brandVoice : null,
    positioning: typeof parsed.positioning === "string" ? parsed.positioning : null,
    missionStatement:
      typeof parsed.missionStatement === "string" ? parsed.missionStatement : null,
    demographics: Array.isArray(parsed.demographics)
      ? parsed.demographics.filter((d): d is string => typeof d === "string")
      : [],
    interests: Array.isArray(parsed.interests)
      ? parsed.interests.filter((i): i is string => typeof i === "string")
      : [],
    painPoints: Array.isArray(parsed.painPoints)
      ? parsed.painPoints.filter((p): p is string => typeof p === "string")
      : [],
  };

  return {
    fields,
    hash,
    adCount,
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
