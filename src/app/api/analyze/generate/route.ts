import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { templateId, variables } = await request.json();

    if (!templateId || !variables) {
      return Response.json({ error: 'templateId and variables required' }, { status: 400 });
    }

    const template = await prisma.adTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    // Generate polished ad copy from template + user variables
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are an expert ad copywriter. Generate polished ad copy based on this template and brand details.

TEMPLATE:
- Name: ${template.name}
- Angle: ${template.messagingAngle}
- Tone: ${template.visualStyle}
- Headline formula: ${template.headlineFormula}
- Body formula: ${template.bodyFormula}
- CTA: ${template.ctaText}

BRAND DETAILS:
${JSON.stringify(variables, null, 2)}

Generate 3 variations of ad copy. For each variation, provide:
1. Headline (short, punchy)
2. Primary text (body copy, 2-4 sentences)
3. Description (one line under the image)
4. CTA button text
5. Image prompt (a detailed prompt for an AI image generator to create the ad visual — describe the scene, style, mood, colors, subjects. Do NOT include any text/words in the image. Focus on photography style, lighting, composition.)

Return JSON:
{
  "variations": [
    {
      "headline": "...",
      "primaryText": "...",
      "description": "...",
      "ctaButton": "...",
      "toneNote": "brief note on this variation's angle",
      "imagePrompt": "detailed image generation prompt for this specific ad variation"
    }
  ],
  "imageryDirection": "what the visual should show (1-2 sentences)",
  "targetingTip": "suggested audience targeting (1 sentence)"
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
    const result = JSON.parse(jsonStr);

    return Response.json({
      template: {
        id: template.id,
        name: template.name,
        messagingAngle: template.messagingAngle,
        colorSuggestions: template.colorSuggestions,
        imageryNotes: template.imageryNotes,
        layoutNotes: template.layoutNotes,
        formatRecommendation: template.formatRecommendation,
      },
      ...result,
    });
  } catch (error) {
    console.error('Generate error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
