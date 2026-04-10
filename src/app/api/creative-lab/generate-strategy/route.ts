// @ts-nocheck — BrandStrategy model not yet in schema (WIP route)
import { NextRequest } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  pageId: z.string().min(1, 'pageId is required'),
  pageName: z.string().optional(),
  category: z.string().optional(),
  step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  audience: z.string().optional(),
  differentiators: z.string().optional(),
  positioning: z.string().optional(),
  strategyId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Response validation schemas
// ---------------------------------------------------------------------------

const personaSchema = z.object({
  name: z.string(),
  painPoints: z.array(z.string()),
  desires: z.array(z.string()),
});

const messagingAngleSchema = z.object({
  angle: z.string(),
  awarenessStage: z.string(),
  painPersonaMapping: z.string(),
});

const strategyMatrixSchema = z.object({
  personas: z.array(personaSchema),
  messagingAngles: z.array(messagingAngleSchema),
  prioritizedAngles: z.array(z.string()),
});

const hookScoresSchema = z.object({
  stoppingPower: z.number(),
  relevance: z.number(),
  emotionalResonance: z.number(),
  clarity: z.number(),
});

const hookSchema = z.object({
  text: z.string(),
  trigger: z.string(),
  messagingAngle: z.string(),
  awarenessStage: z.string(),
  scores: hookScoresSchema,
});

const hooksResponseSchema = z.object({
  hooks: z.array(hookSchema),
});

// ---------------------------------------------------------------------------
// POST /api/creative-lab/generate-strategy
// Multi-step strategy engine: Step 1 (Brand Profile), Step 2 (Messaging),
// Step 3 (Ad Hooks).
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { pageId, pageName, category, step, audience, differentiators, positioning, strategyId } =
      parsed.data;

    // ================================================================
    // STEP 1: Brand Profile
    // ================================================================
    if (step === 1) {
      return handleStep1(pageId, audience, differentiators, positioning, pageName, category);
    }

    // ================================================================
    // STEP 2: Messaging Strategy
    // ================================================================
    if (step === 2) {
      if (!strategyId) {
        return Response.json(
          { error: 'strategyId is required for step 2' },
          { status: 400 }
        );
      }
      return handleStep2(strategyId);
    }

    // ================================================================
    // STEP 3: Ad Hooks
    // ================================================================
    if (step === 3) {
      if (!strategyId) {
        return Response.json(
          { error: 'strategyId is required for step 3' },
          { status: 400 }
        );
      }
      return handleStep3(strategyId);
    }

    return Response.json({ error: 'Invalid step' }, { status: 400 });
  } catch (error) {
    console.error('Generate strategy error:', error);

    // Detect Claude API errors specifically
    if (
      error instanceof Anthropic.APIError ||
      (error instanceof Error && error.message.includes('anthropic'))
    ) {
      return Response.json(
        { error: 'AI service temporarily unavailable.' },
        { status: 503 }
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate strategy',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// Step 1: Brand Profile
// ============================================================================

async function handleStep1(
  pageId: string,
  audience?: string,
  differentiators?: string,
  positioning?: string,
  pageName?: string,
  category?: string
) {
  // ------------------------------------------------------------------
  // 1. Find brand (auto-create if discovered via Facebook API search)
  // ------------------------------------------------------------------
  let brand = await prisma.adLibraryBrand.findUnique({
    where: { pageId },
    select: { id: true, pageName: true, category: true },
  });

  if (!brand && pageName) {
    brand = await prisma.adLibraryBrand.create({
      data: {
        pageId,
        pageName,
        category: category || null,
        ingestionStatus: 'pending',
      },
      select: { id: true, pageName: true, category: true },
    });
  }

  if (!brand) {
    return Response.json({ error: 'Brand not found' }, { status: 404 });
  }

  // ------------------------------------------------------------------
  // 2. Fetch cached analysis (required)
  // ------------------------------------------------------------------
  const cache = await prisma.brandAnalysisCache.findUnique({
    where: { brandId: brand.id },
  });

  if (!cache) {
    return Response.json(
      {
        error:
          'Run analysis first. No cached analysis found for this brand.',
      },
      { status: 404 }
    );
  }

  // ------------------------------------------------------------------
  // 3. Fetch top-performing ads for context
  // ------------------------------------------------------------------
  const topAds = await prisma.adLibraryAd.findMany({
    where: { brandId: brand.id, body: { not: null } },
    orderBy: { reachEstimate: 'desc' },
    take: 10,
    select: {
      body: true,
      title: true,
      caption: true,
      ctaText: true,
      displayFormat: true,
    },
  });

  // ------------------------------------------------------------------
  // 4. Build brand context
  // ------------------------------------------------------------------
  const brandContext = {
    brandName: brand.pageName,
    category: brand.category || 'Unknown',
    audience: audience || null,
    differentiators: differentiators || null,
    positioning: positioning || null,
    analysisScores: {
      categories: {
        assetType: cache.assetTypeScore,
        visualFormat: cache.visualFormatScore,
        hookTactic: cache.hookTacticScore,
        messagingAngle: cache.messagingAngleScore,
        awarenessStage: cache.awarenessStageScore,
        creativeMechanic: cache.creativeMechanicScore,
        offerType: cache.offerTypeScore,
        intendedAudience: cache.intendedAudienceScore,
        overall: cache.overallScore,
      },
      andromeda: {
        score: cache.andromedaScore,
        refreshRate: cache.avgRefreshRate,
        stalePercentage: cache.stalePercentage,
        hookQuality: cache.hookQualityAvg,
        uniqueConcepts: cache.uniqueConcepts,
      },
    },
    sampleAds: topAds.map((ad) => ({
      body: ad.body?.slice(0, 300) || null,
      title: ad.title || null,
      caption: ad.caption || null,
      ctaText: ad.ctaText || null,
      displayFormat: ad.displayFormat || null,
    })),
  };

  // ------------------------------------------------------------------
  // 5. Create new BrandStrategy record
  // ------------------------------------------------------------------
  const strategy = await prisma.brandStrategy.create({
    data: {
      brandId: brand.id,
      brandContext: brandContext as object,
      completedSteps: 1,
    },
  });

  return Response.json({ strategyId: strategy.id, brandContext });
}

// ============================================================================
// Step 2: Messaging Strategy
// ============================================================================

async function handleStep2(strategyId: string) {
  // ------------------------------------------------------------------
  // 1. Find BrandStrategy
  // ------------------------------------------------------------------
  const strategy = await prisma.brandStrategy.findUnique({
    where: { id: strategyId },
    include: { brand: { select: { id: true, pageName: true, category: true } } },
  });

  if (!strategy) {
    return Response.json(
      { error: 'Strategy not found' },
      { status: 404 }
    );
  }

  const brandContext = strategy.brandContext as Record<string, unknown>;

  // ------------------------------------------------------------------
  // 2. Fetch sample ads for real copy integration
  // ------------------------------------------------------------------
  const topAds = await prisma.adLibraryAd.findMany({
    where: { brandId: strategy.brand.id, body: { not: null } },
    orderBy: { reachEstimate: 'desc' },
    take: 10,
    select: { body: true, title: true, caption: true },
  });

  const adCopyBlock = topAds
    .map((ad, i) => {
      const parts = [`${i + 1}.`];
      if (ad.body) parts.push(`Body: "${ad.body.slice(0, 250)}"`);
      if (ad.title) parts.push(`Title: "${ad.title}"`);
      if (ad.caption) parts.push(`Caption: "${ad.caption}"`);
      return parts.join(' | ');
    })
    .join('\n');

  const scores = (brandContext.analysisScores as Record<string, unknown>) || {};
  const categories = (scores.categories as Record<string, number>) || {};
  const andromeda = (scores.andromeda as Record<string, number>) || {};

  // ------------------------------------------------------------------
  // 3. Build Claude prompt
  // ------------------------------------------------------------------
  const prompt = `You are a world-class creative strategist specializing in paid social advertising. Your job is to produce a messaging strategy grounded in REAL competitive intelligence data from this brand's ad library.

**Brand:** ${strategy.brand.pageName}
**Category:** ${strategy.brand.category || 'Unknown'}
**User-provided audience:** ${(brandContext.audience as string) || 'Not specified'}
**User-provided differentiators:** ${(brandContext.differentiators as string) || 'Not specified'}
**User-provided positioning:** ${(brandContext.positioning as string) || 'Not specified'}

**Creative Diversity Scores (0-100, 8 categories):**
- Asset type diversity: ${categories.assetType ?? 'N/A'}
- Visual format diversity: ${categories.visualFormat ?? 'N/A'}
- Hook tactic diversity: ${categories.hookTactic ?? 'N/A'}
- Messaging angle diversity: ${categories.messagingAngle ?? 'N/A'}
- Awareness stage coverage: ${categories.awarenessStage ?? 'N/A'}
- Creative mechanic diversity: ${categories.creativeMechanic ?? 'N/A'}
- Offer type diversity: ${categories.offerType ?? 'N/A'}
- Intended audience diversity: ${categories.intendedAudience ?? 'N/A'}
- Overall diversity: ${categories.overall ?? 'N/A'}

**Andromeda Performance Metrics:**
- Andromeda score: ${andromeda.score ?? 'N/A'}/100
- Creative refresh rate: ${andromeda.refreshRate ?? 'N/A'} new ads/week
- Stale ad percentage: ${andromeda.stalePercentage ?? 'N/A'}%
- Hook quality average: ${andromeda.hookQuality ?? 'N/A'}/10
- Unique concepts: ${andromeda.uniqueConcepts ?? 'N/A'}

**REAL ad copy from this brand's top-performing ads (by reach):**
${adCopyBlock || 'No ads available'}

---

Using this data, produce a comprehensive messaging strategy. The strategy must be grounded in what this brand is ACTUALLY doing (their real ads above) and identify gaps based on the diversity scores and Andromeda metrics.

**The 5 Awareness Stages (Eugene Schwartz):**
1. **Unaware** — The prospect doesn't know they have a problem. Content must disrupt their worldview with a pattern interrupt, surprising fact, or relatable scenario.
2. **Problem-Aware** — They know the problem exists but don't know solutions exist. Content must agitate the pain, validate the frustration, and hint that a solution exists.
3. **Solution-Aware** — They know solutions exist but don't know YOUR product. Content must position your product as the best solution by highlighting unique mechanisms or approaches.
4. **Product-Aware** — They know your product but haven't bought. Content must overcome objections, provide social proof, create urgency, and differentiate from alternatives.
5. **Most-Aware** — They know your product well and just need the right offer. Content should focus on deals, reminders, loyalty rewards, and new features/uses.

**Instructions:**
- Create 2-3 detailed personas based on who this brand's ads are actually targeting (infer from the ad copy)
- For each persona, identify 3-5 specific pain points and 3-5 desires
- Generate 8-12 messaging angles distributed across ALL 5 awareness stages
- Prioritize angles by potential impact based on where the brand's current gaps are (low diversity scores = opportunities)
- Each messaging angle should map to a specific persona's pain point or desire

Respond with ONLY valid JSON in this exact format:
{
  "personas": [
    {
      "name": "Persona Name (e.g., 'The Overwhelmed Parent')",
      "painPoints": ["specific pain point 1", "specific pain point 2", "..."],
      "desires": ["specific desire 1", "specific desire 2", "..."]
    }
  ],
  "messagingAngles": [
    {
      "angle": "A specific messaging angle (1-2 sentences describing the approach)",
      "awarenessStage": "One of: Unaware, Problem-Aware, Solution-Aware, Product-Aware, Most-Aware",
      "painPersonaMapping": "Which persona + which pain point or desire this targets"
    }
  ],
  "prioritizedAngles": [
    "The angle text of the top 3-5 highest-priority angles, ordered by potential impact"
  ]
}

Requirements:
- personas: exactly 2-3 personas with 3-5 pain points and 3-5 desires each
- messagingAngles: 8-12 angles spread across ALL 5 awareness stages (at least 1 per stage)
- prioritizedAngles: top 3-5 angles by potential impact
- Ground everything in the REAL ad data above — reference actual copy patterns you observe
- No markdown, no explanation, ONLY valid JSON`;

  // ------------------------------------------------------------------
  // 4. Call Claude with retry on JSON parse failure
  // ------------------------------------------------------------------
  const strategyMatrix = await callClaudeWithRetry(prompt, strategyMatrixSchema);

  // ------------------------------------------------------------------
  // 5. Update BrandStrategy
  // ------------------------------------------------------------------
  await prisma.brandStrategy.update({
    where: { id: strategyId },
    data: {
      strategyMatrix: strategyMatrix as object,
      completedSteps: 2,
    },
  });

  return Response.json({ strategyMatrix });
}

// ============================================================================
// Step 3: Ad Hooks
// ============================================================================

async function handleStep3(strategyId: string) {
  // ------------------------------------------------------------------
  // 1. Find BrandStrategy and verify step 2 is complete
  // ------------------------------------------------------------------
  const strategy = await prisma.brandStrategy.findUnique({
    where: { id: strategyId },
    include: { brand: { select: { id: true, pageName: true, category: true } } },
  });

  if (!strategy) {
    return Response.json(
      { error: 'Strategy not found' },
      { status: 404 }
    );
  }

  if (strategy.completedSteps < 2) {
    return Response.json(
      { error: 'Complete step 2 (Messaging Strategy) before generating hooks' },
      { status: 400 }
    );
  }

  const brandContext = strategy.brandContext as Record<string, unknown>;
  const strategyMatrix = strategy.strategyMatrix as Record<string, unknown>;

  // ------------------------------------------------------------------
  // 2. Fetch sample ad hooks from the brand's existing ads
  // ------------------------------------------------------------------
  const topAds = await prisma.adLibraryAd.findMany({
    where: { brandId: strategy.brand.id, body: { not: null } },
    orderBy: { reachEstimate: 'desc' },
    take: 10,
    select: { body: true },
  });

  const existingHooks = topAds
    .map((ad) => {
      if (!ad.body) return null;
      // Extract first line/sentence as the hook
      const firstLine = ad.body.split(/[.\n]/)[0]?.trim();
      return firstLine ? `"${firstLine.slice(0, 150)}"` : null;
    })
    .filter(Boolean)
    .join('\n');

  // ------------------------------------------------------------------
  // 3. Build Claude prompt
  // ------------------------------------------------------------------
  const prompt = `You are an elite direct-response copywriter specializing in scroll-stopping ad hooks for paid social. Your hooks must be grounded in REAL brand data and a completed messaging strategy.

**Brand:** ${strategy.brand.pageName}
**Category:** ${strategy.brand.category || 'Unknown'}

**Brand Context:**
${JSON.stringify(brandContext, null, 2)}

**Messaging Strategy (from Step 2):**
${JSON.stringify(strategyMatrix, null, 2)}

**Existing hooks from the brand's top-performing ads:**
${existingHooks || 'No hooks available'}

---

Generate at least 15 ad hooks using the 8 psychological triggers below. Each hook must map to a specific messaging angle and awareness stage from the strategy above.

**The 8 Psychological Triggers (with examples):**

1. **Pattern Interrupt** — Breaks expectations. Says something unexpected that makes the reader pause.
   Example: "I stopped brushing my teeth for 30 days. Here's what happened."
   Example: "Your accountant doesn't want you to know this."

2. **Identity Call-Out** — Directly addresses a specific type of person so they think "that's me!"
   Example: "Attention: overwhelmed moms who haven't had a full night's sleep in months."
   Example: "If you're a freelancer making under $5K/month, read this."

3. **Pain Agitation** — Pokes at an existing wound. Makes the reader feel the problem acutely.
   Example: "Tired of watching your ad spend disappear with nothing to show for it?"
   Example: "That moment when your jeans don't fit anymore and you pretend it's the brand."

4. **Curiosity Gap** — Creates an information gap the reader HAS to close.
   Example: "The #1 reason your skincare routine isn't working (it's not what you think)."
   Example: "We tested 47 protein powders. Only 3 passed our standards."

5. **Social Proof** — Leverages others' actions or endorsements to build credibility.
   Example: "Join 250,000+ professionals who start their morning with this."
   Example: "My dermatologist recommended this and I was skeptical. 6 weeks later..."

6. **Contrarian** — Takes a bold, counterintuitive stance that challenges conventional wisdom.
   Example: "Stop drinking 8 glasses of water a day. Here's why."
   Example: "The best marketing strategy? Stop marketing."

7. **Aspiration** — Paints a vivid picture of the desired future state.
   Example: "Imagine waking up tomorrow with zero credit card debt."
   Example: "What would you do with 10 extra hours every week?"

8. **Urgency** — Creates time pressure or scarcity to drive immediate action.
   Example: "We're pulling this offer at midnight. Not 12:01. Midnight."
   Example: "Only 23 spots left for our March cohort."

**Scoring dimensions (rate each hook 1-10):**
- **Stopping Power**: How likely is this to make someone stop scrolling? (pattern break, shock value, visual language)
- **Relevance**: How well does this connect to the target persona's actual pain/desire?
- **Emotional Resonance**: How strongly does this trigger an emotional response?
- **Clarity**: How immediately understandable is this? (no jargon, no confusion)

**Requirements:**
- Generate at least 15 hooks, at most 20
- Cover ALL 8 psychological triggers (at least 1 hook per trigger)
- Distribute across multiple messaging angles from the strategy
- Distribute across multiple awareness stages
- Each hook should be 1-2 sentences max (ad hooks are short!)
- Hooks should feel native to ${strategy.brand.category || 'this'} category advertising
- Ground hooks in the brand's REAL messaging patterns from their existing ads
- Score honestly — not everything should be a 9 or 10

Respond with ONLY valid JSON in this exact format:
{
  "hooks": [
    {
      "text": "The actual hook copy (1-2 sentences max)",
      "trigger": "One of: Pattern Interrupt, Identity Call-Out, Pain Agitation, Curiosity Gap, Social Proof, Contrarian, Aspiration, Urgency",
      "messagingAngle": "Which messaging angle from the strategy this targets",
      "awarenessStage": "One of: Unaware, Problem-Aware, Solution-Aware, Product-Aware, Most-Aware",
      "scores": {
        "stoppingPower": 7,
        "relevance": 8,
        "emotionalResonance": 6,
        "clarity": 9
      }
    }
  ]
}

No markdown, no explanation, ONLY valid JSON.`;

  // ------------------------------------------------------------------
  // 4. Call Claude with retry on JSON parse failure
  // ------------------------------------------------------------------
  const hooksResult = await callClaudeWithRetry(prompt, hooksResponseSchema);

  // ------------------------------------------------------------------
  // 5. Update BrandStrategy
  // ------------------------------------------------------------------
  await prisma.brandStrategy.update({
    where: { id: strategyId },
    data: {
      hooks: hooksResult as object,
      completedSteps: 3,
    },
  });

  return Response.json({ hooks: hooksResult });
}

// ============================================================================
// Shared: Call Claude with JSON parse retry
// ============================================================================

async function callClaudeWithRetry<T>(
  prompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    const finalPrompt =
      attempt === 0
        ? prompt
        : `${prompt}\n\nIMPORTANT: Your previous response was not valid JSON. You MUST respond with valid JSON only. No markdown fences, no explanation, no commentary. Just the JSON object.`;

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: finalPrompt }],
      });

      const responseText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      const cleanJson = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanJson);
      const validated = schema.parse(parsed);
      return validated;
    } catch (err) {
      lastError = err;

      // If it's a Claude API error, throw immediately (no point retrying parse)
      if (err instanceof Anthropic.APIError) {
        throw err;
      }

      // Only retry on parse/validation failures
      if (attempt === 0) {
        console.warn(
          'Claude response parse/validation failed, retrying...',
          err instanceof Error ? err.message : err
        );
        continue;
      }
    }
  }

  console.error('Claude response parse failed after retry:', lastError);
  throw new Error('AI returned invalid response. Please try again.');
}
