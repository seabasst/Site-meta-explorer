// =============================================================================
// Message Routing: Claude (instant) vs Manus (deep research)
// =============================================================================
// Pure keyword matching. Do NOT use LLM classification -- it adds latency
// and cost to every message.

export const DEEP_RESEARCH_KEYWORDS = [
  'deep research',
  'deep dive',
  'comprehensive analysis',
  'full report',
  'detailed report',
  'in-depth',
  'website analysis',
  'brand audit',
  'market research',
  'competitive landscape',
  'industry report',
  'crawl',
  'scrape website',
  'analyze website',
  'enrichment from website',
  'auto-populate from url',
] as const;

/**
 * Decide whether a message should be routed to Manus (async deep research)
 * or stay with Claude (instant streaming).
 *
 * Returns true if:
 * - The deep research toggle is on, OR
 * - The message contains any deep research keyword (case-insensitive)
 */
export function shouldRouteToManus(
  message: string,
  deepResearchToggle: boolean
): boolean {
  if (deepResearchToggle) return true;

  const lower = message.toLowerCase();
  return DEEP_RESEARCH_KEYWORDS.some((kw) => lower.includes(kw));
}
