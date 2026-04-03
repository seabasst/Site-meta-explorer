/**
 * Brand Context Compiler for AI System Prompt Injection.
 *
 * Serializes a BrandProfileFull into XML-tagged sections under a character
 * budget (~2K tokens). Used by Hikaru chat and Creative Lab routes to make
 * AI responses brand-aware.
 */

import type { BrandProfileFull } from './brand-profile-types';

const MAX_CHARS = 7500; // ~1875 tokens, leaves buffer under 2K

interface CompileOptions {
  /** Hint about query type to prioritize relevant fields */
  queryHint?: 'creative' | 'strategy' | 'analysis' | 'general';
  /** Override max chars */
  maxChars?: number;
}

/**
 * Compile a BrandProfile into XML-tagged system prompt context.
 *
 * Priority order (highest first):
 * 1. Brand name (always included)
 * 2. Positioning
 * 3. Brand voice (truncated to 1500 chars)
 * 4. Target demographics
 * 5. Audience interests
 * 6. Customer pain points
 * 7. Mission statement
 * 8. Brand colors
 * 9. Competitors (max 5 names)
 *
 * Variable-length arrays are truncated to fit budget. Visual fields
 * (logoUrl, referenceImages) are excluded — they flow separately to
 * image-generation pipelines.
 */
export function compileBrandContext(
  profile: BrandProfileFull,
  options: CompileOptions = {}
): string {
  const { maxChars = MAX_CHARS } = options;
  const sections: string[] = [];
  let charCount = 0;

  function addSection(tag: string, content: string): boolean {
    const xml = `<${tag}>${content}</${tag}>`;
    if (charCount + xml.length > maxChars) return false;
    sections.push(xml);
    charCount += xml.length;
    return true;
  }

  // 1. Always included
  addSection('brand_name', profile.name);

  // 2. Positioning
  if (profile.positioning) {
    addSection('positioning', profile.positioning);
  }

  // 3. Brand voice (truncated)
  if (profile.brandVoice) {
    addSection('brand_voice', profile.brandVoice.slice(0, 1500));
  }

  // 4. Target demographics
  if (profile.demographics.length > 0) {
    addSection('target_demographics', profile.demographics.join(', '));
  }

  // 5. Audience interests
  if (profile.interests.length > 0) {
    addSection('audience_interests', profile.interests.join(', '));
  }

  // 6. Customer pain points
  if (profile.painPoints.length > 0) {
    addSection('customer_pain_points', profile.painPoints.join('; '));
  }

  // 7. Mission
  if (profile.missionStatement) {
    addSection('mission', profile.missionStatement);
  }

  // 8. Brand colors
  const colors = [
    profile.primaryColor && `primary: ${profile.primaryColor}`,
    profile.secondaryColor && `secondary: ${profile.secondaryColor}`,
    profile.accentColor && `accent: ${profile.accentColor}`,
  ].filter(Boolean);
  if (colors.length > 0) {
    addSection('brand_colors', colors.join(', '));
  }

  // 9. Competitors (max 5)
  if (profile.competitors.length > 0) {
    const competitorNames = profile.competitors
      .map((c) => c.adLibraryBrand.pageName)
      .slice(0, 5);
    addSection('competitors', competitorNames.join(', '));
  }

  if (sections.length === 0) return '';

  return `\n\n<brand_context>\n${sections.join('\n')}\n</brand_context>`;
}
