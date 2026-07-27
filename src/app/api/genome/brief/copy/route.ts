import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// POST /api/genome/brief/copy
//
// Turns an Ad Brief Generator recommendation (the winning gene combo for an
// industry) into ready-to-ship ad copy in the user's brand voice — via Claude.
// Requires ANTHROPIC_API_KEY (production).
// =============================================================================

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  genes: z.object({
    hookTactic: z.string().nullable().optional(),
    messagingAngle: z.string().nullable().optional(),
    creativeMechanic: z.string().nullable().optional(),
    visualFormat: z.string().nullable().optional(),
    offerType: z.string().nullable().optional(),
  }),
  brand: z.string().default('Your brand'),
  industry: z.string().default('their industry'),
  voice: z.string().default('clear, confident, human'),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { genes, brand, industry, voice } = parsed.data;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 });
  }

  const recipe = Object.entries(genes)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const claude = new Anthropic();
  try {
    const r = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 700,
      system: `You are a senior DTC copywriter for "${brand}" (${industry}). Voice: ${voice}. Return ONLY JSON: {headline, primaryText, cta}.`,
      messages: [{
        role: 'user',
        content: `Write one Meta ad for ${brand} that executes this proven creative recipe (these choices are the longest-running, best-reaching in the industry — follow the recipe, make it specific to us):\n${recipe}`,
      }],
    });
    const text = r.content.map((c) => ('text' in c ? c.text : '')).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Model did not return JSON');
    return NextResponse.json(JSON.parse(m[0]));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Generation failed' }, { status: 500 });
  }
}
