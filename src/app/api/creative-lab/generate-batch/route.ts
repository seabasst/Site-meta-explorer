import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { BrandGuidelines } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const requestSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
  aspectRatio: z.string().min(1, 'aspectRatio is required'),
  useBrandGuidelines: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Brand context builder (mirrors /api/analyze/generate-image pattern)
// ---------------------------------------------------------------------------

function buildBrandContext(guidelines: BrandGuidelines | null): string {
  if (!guidelines) return '';

  const parts: string[] = [];

  if (guidelines.brandVoice) {
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

// ---------------------------------------------------------------------------
// POST /api/creative-lab/generate-batch
// Generates a single image via Replicate Flux Schnell.
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

    const { prompt, aspectRatio, useBrandGuidelines } = parsed.data;

    if (!process.env.REPLICATE_API_TOKEN) {
      return Response.json(
        { error: 'REPLICATE_API_TOKEN not configured' },
        { status: 500 }
      );
    }

    // ------------------------------------------------------------------
    // Optionally fetch brand context
    // ------------------------------------------------------------------
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
      } catch {
        // Non-blocking: proceed without brand context
      }
    }

    // ------------------------------------------------------------------
    // Build enhanced prompt
    // ------------------------------------------------------------------
    const enhancedPrompt = `Professional advertising creative, ${brandContext}high quality commercial photography, ${prompt}. No text, no words, no letters, clean composition`;

    // ------------------------------------------------------------------
    // Create Replicate prediction
    // ------------------------------------------------------------------
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

      if (createRes.status === 429) {
        return Response.json(
          { error: 'Rate limited, try again in a moment' },
          { status: 429 }
        );
      }

      return Response.json(
        { error: 'Failed to start image generation' },
        { status: 500 }
      );
    }

    const prediction = await createRes.json();

    // ------------------------------------------------------------------
    // Poll for completion
    // ------------------------------------------------------------------
    let result = prediction;
    let attempts = 0;
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(result.urls.get, {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
      });

      if (!pollRes.ok) {
        if (pollRes.status === 429) {
          return Response.json(
            { error: 'Rate limited, try again in a moment' },
            { status: 429 }
          );
        }
        // Continue polling on transient errors
        attempts++;
        continue;
      }

      result = await pollRes.json();
      attempts++;
    }

    if (result.status === 'failed') {
      return Response.json(
        { error: 'Image generation failed' },
        { status: 500 }
      );
    }

    if (result.status !== 'succeeded') {
      return Response.json(
        { error: 'Image generation timed out' },
        { status: 504 }
      );
    }

    return Response.json({ imageUrl: result.output[0] });
  } catch (error) {
    console.error('Generate batch error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
