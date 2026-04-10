/**
 * Step 1: Visual Bible Generator
 *
 * Analyzes brand reference images, logo, and color palette using Gemini's
 * vision capabilities. Produces a reusable "visual bible" — a structured
 * description of the brand's visual identity that can be prepended to any
 * image generation prompt to maintain brand consistency.
 */

import { GoogleGenAI } from '@google/genai';

export interface VisualBibleInput {
  referenceImages: { url: string; name?: string }[];
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  brandVoice?: string | null;
  brandName: string;
}

export interface VisualBible {
  photographyStyle: string;
  lightingDirection: string;
  colorPalette: string;
  compositionRules: string;
  moodAndTone: string;
  textureAndMaterials: string;
  modelAndStyling: string;
  doNots: string;
  fullPromptPrefix: string;
}

const SYSTEM_PROMPT = `You are a senior visual brand strategist. Your job is to analyze a brand's visual identity from their reference images and produce a "Visual Bible" — a reusable prompt prefix that ensures every AI-generated image stays on-brand.

Analyze the provided images carefully. Look for:
- Photography style (editorial, lifestyle, studio, candid, flat-lay, etc.)
- Lighting (natural, studio, golden hour, high-key, low-key, moody, etc.)
- Color palette in practice (not just the hex codes — how colors are actually used, dominant tones, warmth/coolness)
- Composition patterns (centered, rule of thirds, negative space, close-up vs wide, etc.)
- Mood and emotional tone (minimal, luxurious, playful, rugged, clinical, warm, etc.)
- Textures and materials that appear (concrete, linen, marble, skin, nature, etc.)
- Human subjects if present (styling, demographics, poses, expressions)
- What the brand clearly avoids (based on what's absent)

Return a JSON object with these exact keys:
{
  "photographyStyle": "2-3 sentences describing the core photography style",
  "lightingDirection": "1-2 sentences on lighting approach",
  "colorPalette": "2-3 sentences on how colors are used in practice (include the provided hex codes but describe the feel)",
  "compositionRules": "2-3 sentences on composition patterns",
  "moodAndTone": "2-3 sentences on the emotional atmosphere",
  "textureAndMaterials": "1-2 sentences on recurring textures/surfaces",
  "modelAndStyling": "1-2 sentences on human subjects (or 'No human subjects in reference imagery' if none)",
  "doNots": "2-3 things the brand clearly avoids based on the visual identity",
  "fullPromptPrefix": "A single dense paragraph (4-6 sentences) that combines ALL of the above into a reusable image generation prefix. This is the most important field — it should be specific enough that any image generated with this prefix looks like it belongs to this brand. Start with the photography style, then layer in lighting, colors, composition, mood, and styling."
}

Return ONLY valid JSON, no markdown.`;

export async function generateVisualBible(
  input: VisualBibleInput
): Promise<VisualBible> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // Build the content parts: images first, then text context
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  // Download and encode reference images
  const imageUrls = [
    ...(input.logoUrl ? [{ url: input.logoUrl, label: 'Brand logo' }] : []),
    ...input.referenceImages.map((img) => ({
      url: img.url,
      label: img.name || 'Reference image',
    })),
  ];

  for (const img of imageUrls.slice(0, 8)) {
    try {
      const res = await fetch(img.url);
      if (!res.ok) continue;
      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const contentType = res.headers.get('content-type') || 'image/jpeg';
      parts.push({
        inlineData: {
          mimeType: contentType,
          data: base64,
        },
      });
    } catch {
      // Skip images that fail to download
    }
  }

  if (parts.length === 0) {
    // No images available — return a generic visual bible based on text only
    return buildFallbackBible(input);
  }

  // Add text context
  const colorInfo = [
    input.primaryColor && `Primary: ${input.primaryColor}`,
    input.secondaryColor && `Secondary: ${input.secondaryColor}`,
    input.accentColor && `Accent: ${input.accentColor}`,
  ]
    .filter(Boolean)
    .join(', ');

  parts.push({
    text: `Brand: ${input.brandName}
${colorInfo ? `Brand colors: ${colorInfo}` : ''}
${input.brandVoice ? `Brand voice: ${input.brandVoice}` : ''}

Analyze these ${parts.length} brand images and create the Visual Bible JSON.`,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: parts,
    config: {
      systemInstruction: SYSTEM_PROMPT,
    },
  });

  const text = response.candidates?.[0]?.content?.parts
    ?.filter((p): p is { text: string } => 'text' in p && !!p.text)
    .map((p) => p.text)
    .join('');

  if (!text) {
    return buildFallbackBible(input);
  }

  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean) as VisualBible;
}

function buildFallbackBible(input: VisualBibleInput): VisualBible {
  const colors = [input.primaryColor, input.secondaryColor, input.accentColor]
    .filter(Boolean)
    .join(', ');

  return {
    photographyStyle: 'Clean, professional commercial photography.',
    lightingDirection: 'Soft, even studio lighting with natural highlights.',
    colorPalette: colors
      ? `Brand colors (${colors}) used as accent tones against neutral backgrounds.`
      : 'Neutral tones with occasional brand color accents.',
    compositionRules: 'Centered subjects with generous negative space. Clean and uncluttered.',
    moodAndTone: input.brandVoice || 'Professional, approachable, modern.',
    textureAndMaterials: 'Clean surfaces, minimal texture.',
    modelAndStyling: 'No specific model direction available.',
    doNots: 'Avoid cluttered compositions, neon colors, low-quality textures.',
    fullPromptPrefix: `Professional commercial photography for ${input.brandName}. Clean, modern aesthetic with soft studio lighting. ${colors ? `Incorporate brand colors (${colors}) subtly.` : ''} Centered composition with generous negative space. No text or words in the image.`,
  };
}
