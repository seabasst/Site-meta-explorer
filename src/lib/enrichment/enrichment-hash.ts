// =============================================================================
// Enrichment Input Hash
// =============================================================================
// Computes a SHA-256 hash of enrichment input data for change detection.
// If the hash matches the stored enrichmentHash on a BrandProfile, we skip
// the LLM call (input data hasn't changed, output would be the same).

import { createHash } from "crypto";

export interface EnrichmentHashInput {
  classificationSummary: Record<string, Record<string, number>>;
  adCount: number;
  topAdBodies: string[];
}

/**
 * Compute a 16-char hex hash of the enrichment input data.
 * Uses JSON.stringify with sorted keys for deterministic serialization.
 */
export function computeEnrichmentHash(data: EnrichmentHashInput): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}
