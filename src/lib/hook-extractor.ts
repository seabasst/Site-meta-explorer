/**
 * Hook Extractor
 *
 * Pure functions for extracting, normalizing, and grouping ad creative hooks.
 * A "hook" is the opening sentence of an ad's creative body text.
 */

// Emoji regex covering common Unicode emoji ranges
const EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2700}-\u{27BF}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}]/gu;

export interface RawAdHook {
  adId: string;
  hookText: string;
  euTotalReach: number;
}

export interface HookGroupData {
  hookText: string;
  normalizedText: string;
  frequency: number;
  totalReach: number;
  avgReachPerAd: number;
  adIds: string[];
}

/**
 * Extract the opening hook (first sentence) from ad creative text.
 *
 * Strategy:
 * 1. Try regex for first sentence ending with . ! ? (min 10 chars to avoid splitting on "3.5" or "U.S.")
 * 2. Fallback: first line (up to 150 chars)
 * 3. Last resort: truncate to 100 chars
 */
export function extractHook(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  // Try to find first sentence (ending with . ! ?)
  // The (?:\s|$) after punctuation ensures we don't split on "3.5" or "U.S."
  const sentenceMatch = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  if (sentenceMatch && sentenceMatch[1].length >= 10) {
    return sentenceMatch[1].trim();
  }

  // Fallback: first line (ads often use line breaks as separators)
  const firstLine = trimmed.split(/\n/)[0].trim();
  if (firstLine.length > 0 && firstLine.length <= 150) {
    return firstLine;
  }

  // Last resort: truncate
  return trimmed.slice(0, 100).trim();
}

/**
 * Normalize a hook for grouping: lowercase, strip emojis, strip punctuation,
 * collapse whitespace, trim. Keeps numbers and letters.
 */
export function normalizeHook(text: string): string {
  return text
    .toLowerCase()
    .replace(EMOJI_REGEX, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Group raw ad hooks by normalized text.
 *
 * - Skips hooks where normalized length < 5 (filters garbage)
 * - Keeps first hookText as display text
 * - Computes frequency, totalReach, avgReachPerAd
 * - Sorts by totalReach descending
 */
export function groupHooks(hooks: RawAdHook[]): HookGroupData[] {
  const groups = new Map<
    string,
    {
      hookText: string;
      adIds: string[];
      totalReach: number;
    }
  >();

  for (const hook of hooks) {
    const normalized = normalizeHook(hook.hookText);
    if (normalized.length < 5) continue;

    const existing = groups.get(normalized);
    if (existing) {
      existing.adIds.push(hook.adId);
      existing.totalReach += hook.euTotalReach;
    } else {
      groups.set(normalized, {
        hookText: hook.hookText,
        adIds: [hook.adId],
        totalReach: hook.euTotalReach,
      });
    }
  }

  return Array.from(groups.entries())
    .map(([normalizedText, data]) => ({
      hookText: data.hookText,
      normalizedText,
      frequency: data.adIds.length,
      totalReach: data.totalReach,
      avgReachPerAd:
        data.adIds.length > 0 ? data.totalReach / data.adIds.length : 0,
      adIds: data.adIds,
    }))
    .sort((a, b) => b.totalReach - a.totalReach);
}

/**
 * Convenience function: extract and group hooks from raw Facebook ad data.
 *
 * Processes ALL elements in ad_creative_bodies[] (not just [0]).
 * Deduplicates hooks within a single ad (same normalized text from different creative body variants).
 * Returns grouped hooks sorted by totalReach descending.
 */
export function extractHooksFromAds(
  ads: Array<{
    id: string;
    ad_creative_bodies?: string[];
    eu_total_reach?: number;
  }>
): HookGroupData[] {
  const rawHooks: RawAdHook[] = [];

  for (const ad of ads) {
    const bodies = ad.ad_creative_bodies || [];
    const seenNormalized = new Set<string>();

    for (const body of bodies) {
      const hookText = extractHook(body);
      if (!hookText) continue;

      const normalized = normalizeHook(hookText);
      if (normalized.length >= 5 && !seenNormalized.has(normalized)) {
        seenNormalized.add(normalized);
        rawHooks.push({
          adId: ad.id,
          hookText,
          euTotalReach: ad.eu_total_reach ?? 0,
        });
      }
    }
  }

  return groupHooks(rawHooks);
}
