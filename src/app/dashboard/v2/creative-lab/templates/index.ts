import { squareHero } from './square-hero';
import { squareMinimal } from './square-minimal';
import { storyProduct } from './story-product';
import { storyBold } from './story-bold';
import { landscapeCta } from './landscape-cta';
import { landscapeSplit } from './landscape-split';
import { portraitPromo } from './portrait-promo';
import { portraitElegant } from './portrait-elegant';
import type { TemplateDefinition } from './types';

// Re-export types
export type { TemplateLayer, TemplateDefinition, EditMap } from './types';

/** All available templates, ordered by format */
export const TEMPLATES: TemplateDefinition[] = [
  squareHero,
  squareMinimal,
  storyProduct,
  storyBold,
  landscapeCta,
  landscapeSplit,
  portraitPromo,
  portraitElegant,
];

/** Look up a template by its unique ID */
export function getTemplateById(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** Get all templates matching a given format (e.g. 'square', 'story') */
export function getTemplatesByFormat(format: string): TemplateDefinition[] {
  return TEMPLATES.filter((t) => t.format === format);
}
