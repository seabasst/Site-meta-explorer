// =============================================================================
// Classification Taxonomy - 8 Categories
// =============================================================================
// Single source of truth for all classification categories, values, and labels.
// Used by: Zod schemas, Prisma validation, LLM prompts, UI display.
// Do NOT modify values without bumping schemaVersion on AdClassification.

export const TAXONOMY = {
  assetType: {
    values: [
      "ugc",
      "studio",
      "graphic-design",
      "stock",
      "screen-capture",
      "ai-generated",
      "editorial",
      "mixed",
    ] as const,
    labels: {
      ugc: "UGC / User-Generated",
      studio: "Studio / High Production",
      "graphic-design": "Graphic Design",
      stock: "Stock Footage/Photography",
      "screen-capture": "Screen Capture / Recording",
      "ai-generated": "AI-Generated",
      editorial: "Editorial / Press Style",
      mixed: "Mixed / Hybrid",
    } as const,
    description:
      "The production method and visual quality tier of the creative asset",
  },

  visualFormat: {
    values: [
      "talking-head",
      "product-demo",
      "testimonial",
      "lifestyle",
      "before-after",
      "unboxing",
      "tutorial",
      "skit",
      "slideshow",
      "text-overlay",
      "split-screen",
      "other",
    ] as const,
    labels: {
      "talking-head": "Talking Head",
      "product-demo": "Product Demo",
      testimonial: "Testimonial",
      lifestyle: "Lifestyle",
      "before-after": "Before & After",
      unboxing: "Unboxing",
      tutorial: "Tutorial / How-To",
      skit: "Skit / Scripted",
      slideshow: "Slideshow / Carousel",
      "text-overlay": "Text Overlay / Kinetic",
      "split-screen": "Split Screen",
      other: "Other",
    } as const,
    description: "The creative execution style and visual presentation format",
  },

  hookTactic: {
    values: [
      "question",
      "bold-claim",
      "statistic",
      "pain-point",
      "curiosity-gap",
      "social-proof",
      "controversy",
      "how-to",
      "direct-address",
      "storytelling",
      "other",
    ] as const,
    labels: {
      question: "Question",
      "bold-claim": "Bold Claim",
      statistic: "Statistic / Data",
      "pain-point": "Pain Point",
      "curiosity-gap": "Curiosity Gap",
      "social-proof": "Social Proof",
      controversy: "Controversy / Hot Take",
      "how-to": "How-To / Tutorial",
      "direct-address": "Direct Address",
      storytelling: "Storytelling",
      other: "Other",
    } as const,
    description:
      "How the first line or opening second grabs viewer attention",
  },

  messagingAngle: {
    values: [
      "price-value",
      "problem-solution",
      "aspirational",
      "educational",
      "social-proof",
      "urgency-scarcity",
      "emotional",
      "comparison",
      "authority",
      "community",
      "other",
    ] as const,
    labels: {
      "price-value": "Price / Value",
      "problem-solution": "Problem-Solution",
      aspirational: "Aspirational",
      educational: "Educational",
      "social-proof": "Social Proof",
      "urgency-scarcity": "Urgency / Scarcity",
      emotional: "Emotional",
      comparison: "Comparison",
      authority: "Authority / Expert",
      community: "Community",
      other: "Other",
    } as const,
    description: "The primary persuasion strategy used in the ad messaging",
  },

  awarenessStage: {
    values: [
      "unaware",
      "problem-aware",
      "solution-aware",
      "product-aware",
      "most-aware",
    ] as const,
    labels: {
      unaware: "Unaware",
      "problem-aware": "Problem Aware",
      "solution-aware": "Solution Aware",
      "product-aware": "Product Aware",
      "most-aware": "Most Aware",
    } as const,
    description:
      "Where the target audience sits in the Schwartz awareness funnel",
  },

  creativeMechanic: {
    values: [
      "before-after",
      "listicle",
      "reaction",
      "day-in-life",
      "challenge",
      "transformation",
      "process-reveal",
      "review",
      "other",
    ] as const,
    labels: {
      "before-after": "Before & After",
      listicle: "Listicle / List",
      reaction: "Reaction",
      "day-in-life": "Day in the Life",
      challenge: "Challenge",
      transformation: "Transformation",
      "process-reveal": "Process Reveal",
      review: "Review",
      other: "Other",
    } as const,
    description: "The structural storytelling technique used in the creative",
  },

  offerType: {
    values: [
      "discount",
      "free-trial",
      "bundle",
      "limited-time",
      "evergreen",
      "seasonal",
      "giveaway",
      "no-offer",
    ] as const,
    labels: {
      discount: "Discount / Sale",
      "free-trial": "Free Trial",
      bundle: "Bundle / Package",
      "limited-time": "Limited Time Offer",
      evergreen: "Evergreen",
      seasonal: "Seasonal / Holiday",
      giveaway: "Giveaway / Contest",
      "no-offer": "No Offer",
    } as const,
    description: "The commercial proposition or incentive presented in the ad",
  },

  intendedAudience: {
    values: [
      "broad",
      "niche-interest",
      "demographic-specific",
      "retargeting",
      "lookalike",
      "competitor-audience",
      "other",
    ] as const,
    labels: {
      broad: "Broad / Mass Market",
      "niche-interest": "Niche Interest",
      "demographic-specific": "Demographic Specific",
      retargeting: "Retargeting",
      lookalike: "Lookalike",
      "competitor-audience": "Competitor Audience",
      other: "Other",
    } as const,
    description: "The inferred targeting intent based on ad content and style",
  },
} as const;

// ---------------------------------------------------------------------------
// Derived types — one per category
// ---------------------------------------------------------------------------
export type AssetType = (typeof TAXONOMY.assetType.values)[number];
export type VisualFormat = (typeof TAXONOMY.visualFormat.values)[number];
export type HookTactic = (typeof TAXONOMY.hookTactic.values)[number];
export type MessagingAngle = (typeof TAXONOMY.messagingAngle.values)[number];
export type AwarenessStage = (typeof TAXONOMY.awarenessStage.values)[number];
export type CreativeMechanic =
  (typeof TAXONOMY.creativeMechanic.values)[number];
export type OfferType = (typeof TAXONOMY.offerType.values)[number];
export type IntendedAudience =
  (typeof TAXONOMY.intendedAudience.values)[number];

// ---------------------------------------------------------------------------
// Category keys for iteration
// ---------------------------------------------------------------------------
export const CATEGORY_KEYS = [
  "assetType",
  "visualFormat",
  "hookTactic",
  "messagingAngle",
  "awarenessStage",
  "creativeMechanic",
  "offerType",
  "intendedAudience",
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];
