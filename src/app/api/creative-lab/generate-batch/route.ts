import { NextRequest } from 'next/server';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { BrandProfile } from '@prisma/client';

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
// Brand context builder
// ---------------------------------------------------------------------------

function buildBrandContext(profile: BrandProfile | null): string {
  if (!profile) return '';

  const parts: string[] = [];

  if (profile.brandVoice) {
    const voice = profile.brandVoice.slice(0, 100);
    parts.push(`brand voice: ${voice}`);
  }

  const colors: string[] = [];
  if (profile.primaryColor) colors.push(profile.primaryColor);
  if (profile.secondaryColor) colors.push(profile.secondaryColor);
  if (profile.accentColor) colors.push(profile.accentColor);
  if (colors.length > 0) {
    parts.push(`brand colors: ${colors.join(', ')}`);
  }

  if (parts.length === 0) return '';

  const context = parts.join(', ').slice(0, 200);
  return context + ', ';
}

// ---------------------------------------------------------------------------
// POST /api/creative-lab/generate-batch
// Generates a single image via Gemini (gemini-3.1-flash-image-preview).
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

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: 'GEMINI_API_KEY not configured' },
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
          const profile = await prisma.brandProfile.findFirst({
            where: { userId: session.user.id, isActive: true },
          });
          brandContext = buildBrandContext(profile);
        }
      } catch {
        // Non-blocking: proceed without brand context
      }
    }

    // ------------------------------------------------------------------
    // Build enhanced prompt
    // The prompt from Creative Director already includes the Visual Bible
    // prefix. We only add brand context if guidelines are available and
    // append the no-text safety instruction.
    // ------------------------------------------------------------------
    const enhancedPrompt = brandContext
      ? `${brandContext}${prompt}. No text, no words, no letters in the image.`
      : `${prompt}. No text, no words, no letters in the image.`;

    // ------------------------------------------------------------------
    // Generate image with Gemini
    // ------------------------------------------------------------------
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: enhancedPrompt,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // Extract the image from the response
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      return Response.json(
        { error: 'No response from Gemini' },
        { status: 500 }
      );
    }

    for (const part of parts) {
      if (part.inlineData?.data) {
        // Return as a data URL that the frontend can display directly
        const mimeType = part.inlineData.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`;
        return Response.json({ imageUrl: dataUrl });
      }
    }

    // If no image was returned, check for text (error/refusal)
    const textParts = parts.filter((p: { text?: string }) => p.text).map((p: { text?: string }) => p.text).join(' ');
    return Response.json(
      { error: textParts || 'Gemini did not return an image' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Generate batch error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Image generation failed' },
      { status: 500 }
    );
  }
}
