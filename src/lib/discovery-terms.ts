// Shared brand-discovery search terms (EU + Nordic DTC / e-commerce focus).
// Consumed by the daily discover cron (src/app/api/ad-library/cron/discover)
// AND the CLI sweeper (scripts/discover-brands.ts --all). Keep it dependency-free
// (a plain array) so both the Next runtime and the tsx script can import it.
//
// This is the ceiling on brand supply: more distinct terms → more distinct
// advertisers found. Extend freely — duplicates across languages are fine,
// dedup happens by page_id downstream.

export const SEARCH_TERMS: string[] = [
  // ── Activewear / fitness ────────────────────────────────────────────────
  'activewear', 'gym leggings', 'running shoes', 'sportswear', 'yoga wear',
  'workout clothes', 'compression wear', 'sports bra', 'training shorts',
  'fitness apparel', 'athleisure', 'cycling kit', 'gym accessories',
  'resistance bands', 'dumbbells', 'home gym', 'protein shaker', 'yoga mat',
  // ── Beauty / skincare / cosmetics ───────────────────────────────────────
  'skincare', 'serum', 'makeup', 'haircare', 'perfume', 'natural cosmetics',
  'moisturizer', 'sunscreen', 'retinol', 'vitamin c serum', 'face mask',
  'cleanser', 'eye cream', 'lip balm', 'nail polish', 'fragrance',
  'beard care', 'mens grooming', 'hair growth', 'shampoo bar', 'body lotion',
  'self tan', 'lash serum', 'korean skincare', 'clean beauty', 'makeup brushes',
  // ── Supplements / health ────────────────────────────────────────────────
  'supplements', 'protein powder', 'vitamins', 'collagen', 'greens powder',
  'creatine', 'pre workout', 'magnesium', 'omega 3', 'probiotics',
  'ashwagandha', 'electrolytes', 'meal replacement', 'nootropics', 'sleep aid',
  'hair vitamins', 'multivitamin', 'gut health', 'protein bar',
  // ── Food / beverage ─────────────────────────────────────────────────────
  'coffee subscription', 'specialty tea', 'craft snacks', 'meal kit', 'organic food',
  'protein snacks', 'energy drink', 'kombucha', 'oat milk', 'hot sauce',
  'chocolate', 'granola', 'olive oil', 'spice blends', 'matcha',
  'non alcoholic', 'craft beer', 'natural wine', 'sparkling water',
  // ── Fashion / apparel ───────────────────────────────────────────────────
  'sustainable fashion', 'linen clothing', 'sneakers', 'denim', 'swimwear', 'lingerie',
  'loungewear', 'knitwear', 'basics tshirt', 'workwear', 'outerwear',
  'raincoat', 'wool coat', 'dresses', 'mens shirts', 'silk pajamas',
  'shapewear', 'socks subscription', 'vintage clothing', 'plus size fashion',
  'maternity wear', 'modest fashion', 'streetwear', 'cashmere',
  // ── Jewelry / accessories ───────────────────────────────────────────────
  'jewelry', 'watches', 'sunglasses', 'leather bags', 'backpacks',
  'gold necklace', 'engagement rings', 'minimalist jewelry', 'wallets',
  'belts', 'scarves', 'hats', 'travel bags', 'laptop bags',
  // ── Home / interior ─────────────────────────────────────────────────────
  'home decor', 'wall art', 'furniture', 'bedding', 'candles', 'kitchenware', 'rugs',
  'linen bedding', 'sofa', 'lighting', 'ceramics', 'planters',
  'kitchen knives', 'cookware', 'coffee maker', 'air purifier', 'towels',
  'storage', 'wall shelves', 'mirror', 'dining table', 'office chair',
  // ── Pets ────────────────────────────────────────────────────────────────
  'pet food', 'dog accessories', 'dog food', 'cat food', 'dog toys',
  'pet supplements', 'dog bed', 'cat litter', 'pet grooming', 'dog leash',
  // ── Baby / kids ─────────────────────────────────────────────────────────
  'baby products', 'kids clothing', 'toys', 'baby carrier', 'stroller',
  'baby skincare', 'nursing', 'cloth diapers', 'wooden toys', 'kids shoes',
  'educational toys', 'baby monitor',
  // ── Electronics / tech ──────────────────────────────────────────────────
  'headphones', 'smart home', 'phone accessories', 'gaming gear', 'earbuds',
  'phone case', 'smart watch', 'portable charger', 'bluetooth speaker',
  'mechanical keyboard', 'webcam', 'ring light', 'drone', 'e reader',
  'robot vacuum', 'security camera', 'smart lighting',
  // ── Outdoor / sport ─────────────────────────────────────────────────────
  'outdoor gear', 'cycling', 'hiking equipment', 'camping', 'ski gear',
  'running gear', 'golf', 'tennis', 'climbing gear', 'fishing gear',
  'paddleboard', 'trail running', 'water bottle', 'cooler', 'tent',
  // ── Wellness / lifestyle ────────────────────────────────────────────────
  'mattress', 'skincare devices', 'electric toothbrush', 'eyewear',
  'blue light glasses', 'weighted blanket', 'essential oils', 'massage gun',
  'meditation app', 'period care', 'menstrual cup', 'sexual wellness',
  'cbd', 'reusable', 'sustainable living', 'water filter',
  // ── Swedish ─────────────────────────────────────────────────────────────
  'träningskläder', 'hudvård', 'kosttillskott', 'barnkläder', 'möbler', 'smycken',
  'sminkning', 'parfym', 'hundmat', 'inredning', 'sängkläder', 'solglasögon',
  'proteinpulver', 'schampo', 'badkläder', 'underkläder', 'klockor', 'ryggsäck',
  // ── German ──────────────────────────────────────────────────────────────
  'sportbekleidung', 'hautpflege', 'nahrungsergänzung', 'kinderkleidung', 'möbel',
  'schmuck', 'parfüm', 'hundefutter', 'bettwäsche', 'sonnenbrille', 'kosmetik',
  'proteinpulver', 'kerzen', 'sneaker', 'unterwäsche', 'rucksack', 'uhren',
  // ── French ──────────────────────────────────────────────────────────────
  'vêtements de sport', 'soin de la peau', 'compléments alimentaires', 'bijoux',
  'meubles', 'parfum', 'maquillage', 'lingerie', 'baskets', 'décoration',
  'soin cheveux', 'lunettes de soleil', 'sac à dos', 'montres', 'bougies',
  // ── Dutch ───────────────────────────────────────────────────────────────
  'sportkleding', 'huidverzorging', 'supplementen', 'sieraden', 'meubels',
  'parfum', 'zonnebril', 'ondergoed', 'sneakers', 'kaarsen',
  // ── Italian / Spanish ───────────────────────────────────────────────────
  'abbigliamento sportivo', 'cura della pelle', 'integratori', 'gioielli', 'profumo',
  'ropa deportiva', 'cuidado de la piel', 'suplementos', 'joyería', 'perfume',
  'maquillaje', 'gafas de sol', 'zapatillas', 'muebles',
  // ── Danish / Norwegian / Finnish / Polish ───────────────────────────────
  'træningstøj', 'hudpleje', 'kosttilskud', 'smykker', 'møbler',
  'treningsklær', 'hudpleie', 'kosttilskudd', 'smykker', 'solbriller',
  'urheiluvaatteet', 'ihonhoito', 'ravintolisät', 'korut', 'huonekalut',
  'odzież sportowa', 'pielęgnacja skóry', 'suplementy', 'biżuteria', 'meble',
];
