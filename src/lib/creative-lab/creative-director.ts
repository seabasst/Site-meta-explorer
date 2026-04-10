/**
 * Step 2: Creative Director
 *
 * Takes the Visual Bible + diversity analysis gaps + brand context and produces
 * specific ad creative briefs. Each brief includes a full image generation prompt
 * that concatenates the visual bible prefix with the specific ad direction.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { VisualBible } from './visual-bible';

const client = new Anthropic();

export interface CreativeDirectorInput {
  brandName: string;
  category: string | null;
  visualBible: VisualBible;
  diversityScores: Record<string, number>;
  distribution: Record<string, Record<string, number>> | null;
  andromedaMetrics: {
    avgRefreshRate: number;
    stalePercentage: number;
    hookQualityAvg: number;
    uniqueConcepts: number;
    funnelAwareness: number;
    funnelConsideration: number;
    funnelConversion: number;
  };
  brandVoice: string | null;
  brandAudience: string[];
  totalAdsAnalyzed: number;
}

export interface AdCreativeBrief {
  pillar: string;
  reasoning: string;
  format: string;
  aspectRatio: string;
  tone: string;
  visualStyle: string;
  journeyPhase: string;
  copyAngle: string;
  imagePrompt: string;
  priority: 'high' | 'medium' | 'low';
}

const SYSTEM_PROMPT = `You are an elite Creative Director at a top-tier performance marketing agency. You specialize in Meta Ads creative strategy and have deep expertise in Andromeda (Meta's ad delivery algorithm).

Your job: Take a brand's Visual Bible (their established visual identity) and their creative diversity gaps, then produce specific ad creative briefs that:
1. Fill the identified gaps in their creative strategy
2. Stay PERFECTLY on-brand by following the Visual Bible
3. Optimize for Andromeda's preference for creative diversity

CRITICAL RULES:
- Every imagePrompt MUST start with the Visual Bible prefix — this ensures brand consistency
- Then add the specific scene/concept direction for this particular ad
- Image prompts should be highly specific: describe the exact scene, subjects, actions, camera angle, and mood
- Never include text, words, or letters in image prompts
- Each ad should feel like it belongs to the same brand but explores a DIFFERENT creative territory
- Prioritize the weakest scoring dimensions first`;

export async function generateCreativeBriefs(
  input: CreativeDirectorInput
): Promise<AdCreativeBrief[]> {
  // Identify gaps: categories scoring below 60
  const gapCategories = Object.entries(input.diversityScores)
    .filter(([key, score]) => key !== 'overall' && score < 60)
    .sort((a, b) => a[1] - b[1])
    .map(([category, score]) => `${category}: ${score}/100`);

  const userPrompt = `**BRAND:** ${input.brandName}
**CATEGORY:** ${input.category || 'Unknown'}
**TOTAL ADS ANALYZED:** ${input.totalAdsAnalyzed}

---

**VISUAL BIBLE (the brand's established visual identity — ALL image prompts must follow this):**

${input.visualBible.fullPromptPrefix}

Additional visual notes:
- Photography: ${input.visualBible.photographyStyle}
- Lighting: ${input.visualBible.lightingDirection}
- Colors: ${input.visualBible.colorPalette}
- Composition: ${input.visualBible.compositionRules}
- Mood: ${input.visualBible.moodAndTone}
- Avoid: ${input.visualBible.doNots}

---

**DIVERSITY SCORES (0-100, lower = bigger gap to fill):**
${JSON.stringify(input.diversityScores, null, 2)}

**GAP CATEGORIES (below 60):**
${gapCategories.length > 0 ? gapCategories.join('\n') : 'No major gaps (all above 60)'}

**DISTRIBUTION DATA:**
${input.distribution ? JSON.stringify(input.distribution, null, 2) : 'Not available'}

**ANDROMEDA METRICS:**
- Refresh rate: ${input.andromedaMetrics.avgRefreshRate} new ads/week
- Stale ads: ${input.andromedaMetrics.stalePercentage}%
- Hook quality avg: ${input.andromedaMetrics.hookQualityAvg}/10
- Unique concepts: ${input.andromedaMetrics.uniqueConcepts}
- Funnel: ${input.andromedaMetrics.funnelAwareness}% awareness / ${input.andromedaMetrics.funnelConsideration}% consideration / ${input.andromedaMetrics.funnelConversion}% conversion

${input.brandVoice ? `**BRAND VOICE:** ${input.brandVoice}` : ''}
${input.brandAudience.length > 0 ? `**TARGET AUDIENCE:** ${input.brandAudience.join(', ')}` : ''}

---

Generate 5-7 ad creative briefs. Each MUST address a specific gap or weakness.

For each brief, return:
- pillar: which dimension this addresses
- reasoning: 1 sentence explaining WHY this fills a gap (user-facing)
- format: ad format (static-image, video, carousel, reel, story)
- aspectRatio: (1:1, 9:16, 4:5, 16:9)
- tone: emotional tone
- visualStyle: visual approach
- journeyPhase: funnel stage (awareness, consideration, conversion)
- copyAngle: 1 sentence describing the copy direction
- imagePrompt: MUST start with the Visual Bible prefix, then add the specific scene direction. 4-6 sentences total. Be extremely specific about the scene, subjects, props, camera angle, and mood. No text in images.
- priority: high (biggest gaps), medium, or low

Return ONLY a valid JSON array. No markdown.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const responseText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const clean = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean) as AdCreativeBrief[];
}
