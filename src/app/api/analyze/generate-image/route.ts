import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { BrandGuidelines } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Build a compact brand context string from guidelines for prompt injection.
 * Capped to ~200 chars to avoid degrading Flux Schnell output quality.
 */
function buildBrandContext(guidelines: BrandGuidelines | null): string {
  if (!guidelines) return '';

  const parts: string[] = [];

  if (guidelines.brandVoice) {
    // Truncate voice to first 100 chars
    const voice = guidelines.brandVoice.slice(0, 100);
    parts.push(`brand voice: ${voice}`);
  }

  const colors: string[] = [];
  if (guidelines.primaryColor) colors.push(guidelines.primaryColor);
  if (guidelines.secondaryColor) colors.push(guidelines.secondaryColor);
  if (guidelines.accentColor) colors.push(guidelines.accentColor);
  if (colors.length > 0) {
    parts.push(`brand colors: ${colors.join(', ')}`);
  }

  if (parts.length === 0) return '';

  // Cap total to ~200 chars
  const context = parts.join(', ').slice(0, 200);
  return context + ', ';
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { prompt, aspectRatio, brandGuidelines: useBrandGuidelines } = await request.json();

    if (!prompt) {
      return Response.json({ error: 'prompt required' }, { status: 400 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return Response.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    // Optionally fetch brand context when flag is true
    let brandContext = '';
    if (useBrandGuidelines) {
      try {
        const session = await auth();
        if (session?.user?.id) {
          const guidelines = await prisma.brandGuidelines.findUnique({
            where: { userId: session.user.id },
          });
          brandContext = buildBrandContext(guidelines);
        }
      } catch (err) {
        // Non-blocking: if auth/DB fails, proceed without brand context
        console.error('Failed to fetch brand guidelines:', err);
      }
    }

    // Enhance prompt for ad creative quality
    const enhancedPrompt = `Professional advertising creative, ${brandContext}high quality commercial photography, ${prompt}. No text, no words, no letters, clean composition`;

    // Create prediction
    const createRes = await fetch(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            prompt: enhancedPrompt,
            num_outputs: 1,
            aspect_ratio: aspectRatio || '1:1',
            output_format: 'webp',
            output_quality: 90,
          },
        }),
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      console.error('Replicate create error:', err);
      return Response.json({ error: 'Failed to start image generation' }, { status: 500 });
    }

    const prediction = await createRes.json();

    // Poll for completion
    let result = prediction;
    let attempts = 0;
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(result.urls.get, {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
      });
      result = await pollRes.json();
      attempts++;
    }

    if (result.status === 'failed') {
      return Response.json({ error: 'Image generation failed' }, { status: 500 });
    }

    if (result.status !== 'succeeded') {
      return Response.json({ error: 'Image generation timed out' }, { status: 504 });
    }

    return Response.json({ imageUrl: result.output[0] });
  } catch (error) {
    console.error('Generate image error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
