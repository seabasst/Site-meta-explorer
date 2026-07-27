import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';

// =============================================================================
// POST /api/genome/remix
//
// The magic trick: take a competitor's PROVEN winner (their longest-running
// ad), decode its creative recipe, and generate YOUR brand's version of it —
// new copy (Claude) + a new image (Gemini). Competitor's proven playbook ->
// your ready-to-ship ad.
//
// Reuses the same providers as the Creative Lab (Anthropic Claude for text,
// Gemini for images). Requires ANTHROPIC_API_KEY + GEMINI_API_KEY (production).
// =============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DURATION_DAYS = `ROUND((EXTRACT(EPOCH FROM (COALESCE(a."endDate", NOW()) - a."startDate")) / 86400)::numeric)::int`;

const bodySchema = z.object({
  competitor: z.string().min(1), // brand name or pageId
  adId: z.string().optional(), // pin a specific winning ad; else auto-pick longest-running
  myBrand: z.object({
    name: z.string().min(1),
    category: z.string().min(1),
    voice: z.string().default('clear, confident, human'),
    market: z.string().default('UK / English'),
    palette: z.string().optional(),
  }),
  generateImage: z.boolean().default(true),
});

const claude = new Anthropic();
const MODEL = 'claude-sonnet-4-20250514';

async function claudeJson<T>(system: string, user: string, maxTokens = 900): Promise<T> {
  const r = await claude.messages.create({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] });
  const text = r.content.map((c) => ('text' in c ? c.text : '')).join('');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Model did not return JSON');
  return JSON.parse(match[0]) as T;
}

interface Genome {
  hookTactic: string; messagingAngle: string; creativeMechanic: string;
  visualFormat: string; offerType: string; awarenessStage: string; whyItWorks: string;
}

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.flatten() }, { status: 400 });
  }
  const { competitor, adId, myBrand, generateImage } = parsed.data;

  // 1) Fetch the proven winner (specific ad, or the brand's longest-running).
  const rows = await prisma.$queryRawUnsafe<Array<{
    brandName: string; adId: string; days: number; reach: number | null;
    body: string | null; title: string | null; displayFormat: string | null; isActive: boolean;
    hookTactic: string | null; messagingAngle: string | null; creativeMechanic: string | null;
    visualFormat: string | null; offerType: string | null; awarenessStage: string | null;
  }>>(
    `
    SELECT b."pageName" AS "brandName", a."adId", ${DURATION_DAYS} AS days, a."reachEstimate" AS reach,
      a.body, a.title, a."displayFormat", a."isActive",
      c."hookTactic", c."messagingAngle", c."creativeMechanic", c."visualFormat", c."offerType", c."awarenessStage"
    FROM "AdLibraryAd" a
    JOIN "AdLibraryBrand" b ON b.id = a."brandId"
    LEFT JOIN "AdClassification" c ON c."adId" = a.id
    WHERE ${adId ? 'a."adId" = $1' : '(b."pageId" = $1 OR b."pageName" ILIKE $2)'}
      AND a."startDate" IS NOT NULL AND a."reachEstimate" IS NOT NULL
    ORDER BY days DESC, a."reachEstimate" DESC LIMIT 1
    `,
    ...(adId ? [adId] : [competitor, competitor])
  );
  const w = rows[0];
  if (!w) return NextResponse.json({ error: `No ads found for "${competitor}"` }, { status: 404 });

  // 2) Decode the genome (use precomputed classification, else classify on the fly).
  let genome: Genome;
  if (w.hookTactic) {
    genome = {
      hookTactic: w.hookTactic, messagingAngle: w.messagingAngle!, creativeMechanic: w.creativeMechanic!,
      visualFormat: w.visualFormat!, offerType: w.offerType!, awarenessStage: w.awarenessStage!,
      whyItWorks: 'Precomputed classification.',
    };
  } else {
    genome = await claudeJson<Genome>(
      'You are an expert Meta ad classifier. Return ONLY JSON with keys: hookTactic, messagingAngle, creativeMechanic, visualFormat, offerType, awarenessStage, whyItWorks (one sentence on why this recipe converts).',
      `Classify this proven ad (it has run ${w.days} days).\nHeadline: ${w.title ?? ''}\nBody: ${w.body ?? ''}\nFormat: ${w.displayFormat ?? ''}`
    );
  }

  // 3) Remix the copy into the user's brand (adapt the recipe, don't copy words).
  const copy = await claudeJson<{ headline: string; primaryText: string; cta: string }>(
    `You are a senior DTC copywriter for "${myBrand.name}" (${myBrand.category}). Voice: ${myBrand.voice}. Market/language: ${myBrand.market}. Return ONLY JSON: {headline, primaryText, cta}.`,
    `Write a NEW Meta ad for ${myBrand.name} that reuses this PROVEN recipe from a competitor's ${w.days}-day winner. Adapt the recipe to our brand and market — never copy their wording.\nHook tactic: ${genome.hookTactic}\nAngle: ${genome.messagingAngle}\nMechanic: ${genome.creativeMechanic}\nOffer: ${genome.offerType}\nAwareness stage: ${genome.awarenessStage}\nWhy it works: ${genome.whyItWorks}`
  );

  // 4) Generate the image (Gemini) — optional.
  let imageDataUrl: string | null = null;
  let imageError: string | null = null;
  if (generateImage) {
    if (!process.env.GEMINI_API_KEY) {
      imageError = 'GEMINI_API_KEY not configured';
    } else {
      try {
        const prompt = `High-converting Meta feed ad for ${myBrand.name}, a ${myBrand.category} brand. Visual format: ${genome.visualFormat}. Creative mechanic: ${genome.creativeMechanic}.${myBrand.palette ? ` Brand palette: ${myBrand.palette}.` : ''} Premium, photorealistic, 4:5 vertical. Tastefully overlay the headline "${copy.headline}" in a clean modern sans-serif, highly legible.`;
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const resp = await ai.models.generateContent({ model: 'gemini-2.0-flash-exp', contents: prompt, config: { responseModalities: ['TEXT', 'IMAGE'] } });
        for (const part of resp.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) {
            imageDataUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            break;
          }
        }
        if (!imageDataUrl) imageError = 'No image returned by the model';
      } catch (err) {
        imageError = err instanceof Error ? err.message : 'Image generation failed';
      }
    }
  }

  return NextResponse.json({
    competitor: { name: w.brandName },
    winner: { adId: w.adId, runDays: w.days, isActive: w.isActive, reach: w.reach, headline: w.title, body: w.body },
    genome,
    remix: { brand: myBrand.name, ...copy, imageDataUrl, imageError },
  });
}
