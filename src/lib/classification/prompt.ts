// =============================================================================
// Classification Prompt Builder
// =============================================================================
// Builds the system prompt for ad classification from TAXONOMY.
// Dynamically interpolates category definitions and values so the prompt
// stays in sync with taxonomy changes without manual editing.

import { TAXONOMY, CATEGORY_KEYS, type CategoryKey } from "./taxonomy";

// ---------------------------------------------------------------------------
// Value descriptions — explain WHEN to use each value (beyond the label)
// ---------------------------------------------------------------------------
const VALUE_DESCRIPTIONS: Record<CategoryKey, Record<string, string>> = {
  assetType: {
    ugc: "Shot on phone or webcam by a real person (not an actor in a studio). Raw, authentic feel.",
    studio:
      "Professionally shot with lighting, set design, or cinema-quality cameras. High production value.",
    "graphic-design":
      "Created in a design tool (Figma, Canva, Photoshop). Flat graphics, illustrations, or motion graphics without live footage.",
    stock:
      "Uses clearly recognizable stock footage or stock photography. Generic, not brand-specific.",
    "screen-capture":
      "Screen recording of an app, website, or software. Includes product walkthroughs.",
    "ai-generated":
      "Visuals created by AI tools (Midjourney, DALL-E, Runway). Synthetic look or explicitly stated.",
    editorial:
      "Styled like a news article, magazine feature, or press release. Authority/credibility framing.",
    mixed:
      "Combines multiple production types (e.g., UGC clips intercut with graphic overlays).",
  },
  visualFormat: {
    "talking-head":
      "Person speaking directly to camera as the primary visual element.",
    "product-demo":
      "Product is shown in use — features, functionality, or results demonstrated.",
    testimonial:
      "Customer or user sharing their experience/results. Can be video or text-based.",
    lifestyle:
      "Shows the product in a real-life context or aspirational setting. Focus on the life, not the product.",
    "before-after":
      "Side-by-side or sequential comparison showing transformation or improvement.",
    unboxing:
      "Reveals product packaging, contents, or first impressions upon receipt.",
    tutorial:
      "Step-by-step instructions on how to use the product or achieve a result.",
    skit: "Scripted scene with characters, dialogue, or a narrative arc. Entertainment-driven.",
    slideshow:
      "Multiple frames, cards, or images presented in sequence. Includes carousel-style formats.",
    "text-overlay":
      "Text is the primary visual element, animated or static over minimal background. Kinetic typography.",
    "split-screen":
      "Screen divided to show two perspectives, comparisons, or simultaneous views.",
    other: "Does not fit any of the above formats.",
  },
  hookTactic: {
    question:
      "Opens with a question to the viewer (e.g., 'Struggling with acne?').",
    "bold-claim":
      "Leads with a strong, attention-grabbing statement (e.g., 'This changed my life').",
    statistic:
      "Opens with a number, data point, or research finding to establish credibility.",
    "pain-point":
      "Immediately names a problem the viewer is likely experiencing.",
    "curiosity-gap":
      "Teases information without revealing it (e.g., 'The one thing dermatologists won't tell you').",
    "social-proof":
      "Opens with reviews, ratings, follower counts, or 'everyone is using this' framing.",
    controversy:
      "Starts with a polarizing opinion or hot take to provoke engagement.",
    "how-to":
      "Opens with a promise to teach something (e.g., 'How to get clear skin in 7 days').",
    "direct-address":
      "Speaks directly to a specific audience segment (e.g., 'Hey busy moms!').",
    storytelling:
      "Begins with a narrative setup (e.g., 'Last month I was broke...').",
    other: "Hook style does not match any of the above.",
  },
  messagingAngle: {
    "price-value":
      "Emphasizes cost savings, deals, affordability, or ROI. Money is the core argument.",
    "problem-solution":
      "Names a specific problem then presents the product as the fix.",
    aspirational:
      "Sells a vision of who you could become or the life you could have.",
    educational:
      "Teaches something useful; the product is positioned as enabling knowledge/skill.",
    "social-proof":
      "Centers on what others think — reviews, testimonials, popularity, celebrity endorsement.",
    "urgency-scarcity":
      "Creates time pressure or limited availability (e.g., 'Only 3 left', 'Sale ends tonight').",
    emotional:
      "Targets feelings — nostalgia, fear, joy, belonging — rather than rational arguments.",
    comparison:
      "Directly or indirectly compares to competitors or alternatives.",
    authority:
      "Uses expert endorsement, certifications, clinical studies, or professional credentials.",
    community:
      "Emphasizes belonging to a group, movement, or shared identity.",
    other: "Messaging approach does not match any of the above.",
  },
  awarenessStage: {
    unaware:
      "Viewer doesn't know they have a problem. Ad must create awareness of the need first.",
    "problem-aware":
      "Viewer knows the problem but not the solution. Ad names and agitates the pain.",
    "solution-aware":
      "Viewer knows solutions exist but hasn't chosen one. Ad differentiates this solution.",
    "product-aware":
      "Viewer knows this specific product. Ad reinforces benefits, overcomes objections.",
    "most-aware":
      "Viewer is ready to buy, just needs a final push. Ad focuses on offer/CTA/urgency.",
  },
  creativeMechanic: {
    "before-after":
      "Shows a transformation — the state before using the product vs. after.",
    listicle:
      "Presents information as a numbered or bulleted list (e.g., '5 reasons to try...').",
    reaction:
      "Shows someone reacting to the product, result, or experience. Surprise/delight focus.",
    "day-in-life":
      "Follows someone through their routine, weaving the product into daily life.",
    challenge:
      "Framed as a test, dare, or competition (e.g., '7-day challenge', 'Can it survive this?').",
    transformation:
      "Documents a journey or change over time (weight loss, home renovation, skill building).",
    "process-reveal":
      "Shows how something is made, built, or done behind the scenes.",
    review:
      "Structured as a product review with pros/cons, rating, or verdict.",
    other: "Creative structure does not match any of the above.",
  },
  offerType: {
    discount:
      "Explicit percentage or dollar discount (e.g., '30% off', 'Save $50').",
    "free-trial":
      "Offers a free trial period, freemium tier, or money-back guarantee.",
    bundle:
      "Multiple products or services packaged together at a combined price.",
    "limited-time":
      "Offer has an explicit deadline or countdown (flash sale, seasonal deadline).",
    evergreen:
      "No special offer — the ad promotes the product at its standard price/terms.",
    seasonal:
      "Tied to a holiday, season, or cultural moment (Black Friday, Summer, Valentine's).",
    giveaway:
      "Free product, contest entry, or sweepstakes. Engagement-driven.",
    "no-offer":
      "Ad is purely brand/awareness — no commercial proposition at all.",
  },
  intendedAudience: {
    broad:
      "Mass market appeal, no specific demographic or interest targeting signals.",
    "niche-interest":
      "Targets a specific hobby, interest, or subculture (e.g., trail runners, plant parents).",
    "demographic-specific":
      "Clearly targets an age group, gender, profession, or life stage.",
    retargeting:
      "Speaks to people who already interacted — references past visits, cart abandonment, etc.",
    lookalike:
      "Broad-ish but signals a persona match (lifestyle cues without explicit retargeting).",
    "competitor-audience":
      "Directly calls out competitors or targets people using rival products.",
    other: "Targeting intent is unclear or does not match above categories.",
  },
};

// ---------------------------------------------------------------------------
// Build category section for the prompt
// ---------------------------------------------------------------------------
function buildCategorySection(key: CategoryKey): string {
  const category = TAXONOMY[key];
  const descriptions = VALUE_DESCRIPTIONS[key];
  const lines = [`### ${key}`, `${category.description}`, "", "Values:"];
  for (const value of category.values) {
    const desc =
      descriptions[value] ||
      (category.labels as Record<string, string>)[value];
    lines.push(`- \`${value}\`: ${desc}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Few-shot examples
// ---------------------------------------------------------------------------
const FEW_SHOT_EXAMPLES = [
  {
    description:
      "Studio product demo — Nike running shoe ad with athlete in professional setting",
    input: {
      brandName: "Nike",
      category: "Sportswear",
      body: "Introducing the Air Zoom Pegasus 41. Engineered for speed, built for comfort. Every stride feels lighter.",
      title: "Run faster. Go further.",
      ctaText: "Shop Now",
      displayFormat: "video",
    },
    output: {
      assetType: "studio",
      visualFormat: "product-demo",
      hookTactic: "bold-claim",
      messagingAngle: "aspirational",
      awarenessStage: "product-aware",
      creativeMechanic: "process-reveal",
      offerType: "evergreen",
      intendedAudience: "niche-interest",
      hookScore: 7,
      conceptCluster: "performance-running",
      confidence: 0.9,
    },
  },
  {
    description:
      "UGC testimonial — skincare brand with before/after results from real customer",
    input: {
      brandName: "CeraVe",
      category: "Skincare",
      body: "I tried everything for my acne. Dermatologists, expensive creams, nothing worked. Then my friend recommended CeraVe and within 3 weeks my skin completely cleared up. See my results!",
      title: "Real results, real people",
      ctaText: "Try It Free",
      displayFormat: "video",
    },
    output: {
      assetType: "ugc",
      visualFormat: "testimonial",
      hookTactic: "pain-point",
      messagingAngle: "social-proof",
      awarenessStage: "solution-aware",
      creativeMechanic: "before-after",
      offerType: "free-trial",
      intendedAudience: "demographic-specific",
      hookScore: 8,
      conceptCluster: "acne-transformation",
      confidence: 0.92,
    },
  },
  {
    description:
      "Graphic design with discount — SaaS flash sale with bold typography and countdown",
    input: {
      brandName: "Notion",
      category: "Productivity Software",
      body: "Flash sale: 50% off Notion Plus. Offer ends midnight. Stop juggling 10 apps. One workspace for docs, projects, and wikis.",
      title: "50% OFF — Today Only",
      ctaText: "Claim Offer",
      displayFormat: "image",
    },
    output: {
      assetType: "graphic-design",
      visualFormat: "text-overlay",
      hookTactic: "bold-claim",
      messagingAngle: "urgency-scarcity",
      awarenessStage: "most-aware",
      creativeMechanic: "listicle",
      offerType: "limited-time",
      intendedAudience: "broad",
      hookScore: 6,
      conceptCluster: "saas-flash-sale",
      confidence: 0.88,
    },
  },
  {
    description:
      "Lifestyle skit — DTC wellness brand showing a day-in-the-life morning routine",
    input: {
      brandName: "AG1",
      category: "Health & Wellness",
      body: "POV: You finally found a morning routine that actually sticks. One scoop, 75 vitamins and minerals, and you're out the door feeling like a new person.",
      title: undefined,
      ctaText: "Get Your First Bag Free",
      displayFormat: "video",
    },
    output: {
      assetType: "ugc",
      visualFormat: "skit",
      hookTactic: "direct-address",
      messagingAngle: "aspirational",
      awarenessStage: "problem-aware",
      creativeMechanic: "day-in-life",
      offerType: "free-trial",
      intendedAudience: "broad",
      hookScore: 7,
      conceptCluster: "morning-routine",
      confidence: 0.85,
    },
  },
  {
    description:
      "Text-overlay listicle — supplement brand listing 5 benefits with bold text cards",
    input: {
      brandName: "Ritual",
      category: "Supplements",
      body: "5 reasons women over 30 are switching to Ritual: 1) No synthetic fillers 2) Third-party tested 3) Delayed-release capsules 4) Traceable ingredients 5) Made for real absorption, not just label claims.",
      title: "Why 1M+ women switched",
      ctaText: "Learn More",
      displayFormat: "video",
    },
    output: {
      assetType: "graphic-design",
      visualFormat: "text-overlay",
      hookTactic: "social-proof",
      messagingAngle: "educational",
      awarenessStage: "solution-aware",
      creativeMechanic: "listicle",
      offerType: "evergreen",
      intendedAudience: "demographic-specific",
      hookScore: 8,
      conceptCluster: "supplement-benefits",
      confidence: 0.91,
    },
  },
];

// ---------------------------------------------------------------------------
// Build the full system prompt
// ---------------------------------------------------------------------------
export function buildClassificationPrompt(): string {
  const categorySections = CATEGORY_KEYS.map((key) =>
    buildCategorySection(key)
  ).join("\n\n");

  const exampleSections = FEW_SHOT_EXAMPLES.map((ex, i) => {
    const inputLines = Object.entries(ex.input)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n");
    const outputJson = JSON.stringify(ex.output, null, 2);
    return `**Example ${i + 1}: ${ex.description}**

Input:
${inputLines}

Output:
\`\`\`json
${outputJson}
\`\`\``;
  }).join("\n\n");

  return `You are an expert ad creative analyst. Your job is to classify Facebook/Instagram ad creatives into a structured taxonomy.

You will receive information about an ad (brand name, category, ad copy, title, CTA, display format) and optionally an image or video thumbnail. Classify the ad across all 8 categories below.

## Classification Categories

${categorySections}

## Output Format

Return a JSON object with exactly these fields:
- One field for each of the 8 categories above (use the exact category key names)
- \`hookScore\`: integer 1-10 rating the scroll-stopping power of the hook
- \`conceptCluster\`: 2-3 word lowercase hyphenated label for the core concept
- \`confidence\`: float 0.0-1.0 representing your classification confidence

## Few-Shot Examples

${exampleSections}

## Classification Rules

1. **Every field is required.** Pick the BEST match from the allowed values for each category.
2. Use \`"other"\` only when no value fits at all. Prefer a close match over "other".
3. **hookScore scale:** 1-3 = weak/generic hook, 4-6 = decent attention-getter, 7-10 = strong scroll-stopper.
4. **conceptCluster:** Reuse the SAME label for ads with the same core concept. Keep labels lowercase, hyphenated, 2-3 words (e.g., "morning-routine", "acne-transformation", "saas-flash-sale").
5. **confidence:** Be honest. 0.5 = guessing, 0.7 = reasonable, 0.9+ = very confident. Lower confidence when ad text is ambiguous or image context is missing.
6. When both text and visual signals are available, weigh them equally. When only text is available, note lower confidence.
7. Classify based on the PRIMARY intent — if an ad uses multiple tactics, pick the dominant one.`;
}

// ---------------------------------------------------------------------------
// Build user message for a single ad
// ---------------------------------------------------------------------------
export function buildAdContext(ad: {
  brandName?: string;
  category?: string;
  body?: string;
  title?: string;
  ctaText?: string;
  displayFormat?: string;
}): string {
  const lines: string[] = ["Classify this ad:"];

  if (ad.brandName) lines.push(`Brand: ${ad.brandName}`);
  if (ad.category) lines.push(`Category: ${ad.category}`);
  if (ad.displayFormat) lines.push(`Format: ${ad.displayFormat}`);
  if (ad.title) lines.push(`Title: ${ad.title}`);
  if (ad.body) lines.push(`Ad copy: ${ad.body}`);
  if (ad.ctaText) lines.push(`CTA: ${ad.ctaText}`);

  return lines.join("\n");
}
