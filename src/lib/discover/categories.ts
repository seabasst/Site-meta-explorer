// AdLibraryBrand.category is free text entered at ingestion time, so the raw
// column has dozens of near-duplicate values (e.g. "fashion", "Fashion Retail",
// "Premium Fashion", "Women's Fashion E-com" are all fashion). Without this,
// /analyze's category search and reports silently exclude brands that are
// clearly the same industry but were typed slightly differently.
//
// This is a curated grouping over the *current* data, not a formal taxonomy —
// unmapped values fall back to their own single-value bucket, so nothing
// disappears when a brand is categorized with a string we haven't seen yet.

interface CanonicalCategory {
  slug: string;
  label: string;
  aliases: string[];
}

const CANONICAL_CATEGORIES: CanonicalCategory[] = [
  {
    slug: 'fashion',
    label: 'Fashion & Apparel',
    aliases: [
      'fashion',
      'fashion retail',
      'fashion e-com',
      'premium fashion',
      'sustainable fashion',
      "women's fashion",
      "women's fashion e-com",
      "men's fashion",
      "men's shirts",
      "children's fashion",
      'equestrian fashion',
      'outdoor fashion',
      'watches/fashion',
      'eyewear/fashion',
      'garment care',
    ],
  },
  {
    slug: 'sports-activewear',
    label: 'Sports & Activewear',
    aliases: [
      'activewear',
      'outdoor/activewear',
      'sports fashion',
      'sports/golf retail',
      'sports retail',
      'outdoor/sports e-com',
      'bicycles',
    ],
  },
  {
    slug: 'beauty',
    label: 'Beauty',
    aliases: ['beauty', 'beauty e-com', 'beauty retail'],
  },
  {
    slug: 'accessories-jewelry',
    label: 'Accessories & Jewelry',
    aliases: ['accessories', "hats/accessories", 'phone accessories', 'jewelry', 'watches/jewelry', 'hair extensions'],
  },
  {
    slug: 'health-wellness',
    label: 'Health & Wellness',
    aliases: ['health', 'fitness', 'longevity', 'health & wellness'],
  },
  {
    slug: 'pharmacy',
    label: 'Pharmacy',
    aliases: ['pharmacy retail', 'pharmacy e-com'],
  },
  {
    slug: 'home-living',
    label: 'Home & Living',
    aliases: [
      'home',
      'home-improvement',
      'diy/home retail',
      'home decor e-com',
      'home/discount retail',
      'kitchen/home retail',
      'furniture retail',
      'rugs e-com',
    ],
  },
  {
    slug: 'kids-baby',
    label: 'Kids & Baby',
    aliases: ['kids', 'baby', 'baby products', "children's e-com"],
  },
  {
    slug: 'food-beverage',
    label: 'Food & Beverage',
    aliases: ['food_and_beverage', 'fast_food', 'energy drink'],
  },
  {
    slug: 'tech-electronics',
    label: 'Tech & Electronics',
    aliases: ['tech', 'electronics retail', 'electronics e-com'],
  },
  {
    slug: 'general-retail',
    label: 'General Retail & Marketplaces',
    aliases: [
      'e-commerce',
      'marketplace e-com',
      'department store',
      'second-hand e-com',
      'books/e-commerce',
      'grocery retail',
      'pet retail',
    ],
  },
  { slug: 'airline', label: 'Airlines', aliases: ['airline'] },
  { slug: 'car_rental', label: 'Car Rental', aliases: ['car_rental'] },
  { slug: 'real-estate', label: 'Real Estate', aliases: ['real-estate'] },
  { slug: 'non-profit', label: 'Non-Profit', aliases: ['non-profit'] },
];

const ALIAS_TO_CANONICAL = new Map<string, CanonicalCategory>();
for (const cat of CANONICAL_CATEGORIES) {
  for (const alias of cat.aliases) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase().trim(), cat);
  }
}

export interface ResolvedCategory {
  slug: string;
  label: string;
}

/**
 * Maps a raw AdLibraryBrand.category string to its canonical grouping.
 * Falls back to a slugified version of the raw value when it isn't in the
 * curated alias list, so nothing is silently dropped.
 */
export function resolveCategory(raw: string): ResolvedCategory {
  const canonical = ALIAS_TO_CANONICAL.get(raw.toLowerCase().trim());
  if (canonical) return { slug: canonical.slug, label: canonical.label };
  return { slug: raw.toLowerCase().replace(/\s+/g, '_'), label: raw };
}

/**
 * Given every distinct raw category string present in the DB, returns the
 * raw values that belong to a given canonical (or fallback) slug.
 */
export function rawValuesForSlug(slug: string, distinctRawCategories: string[]): string[] {
  return distinctRawCategories.filter((raw) => resolveCategory(raw).slug === slug);
}
