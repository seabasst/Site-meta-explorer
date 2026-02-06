/**
 * Batch Fetch Utility
 *
 * Fetches multiple ad library pages with rate limiting to avoid hitting Facebook API limits.
 * Uses sequential batching with delays between batches.
 */

import { fetchAdsByPageUrl, extractPageIdFromUrl, EU_COUNTRIES } from './facebook-api';
import { fetchWithRetry } from './retry';
import { buildSnapshotFromApiResult, type SnapshotData } from './snapshot-builder';

export interface BatchFetchResult {
  url: string;
  pageId: string;
  pageName: string;
  success: boolean;
  snapshot?: SnapshotData;
  error?: string;
}

export interface BatchFetchOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
}

/**
 * Fetch multiple ad library pages with rate limiting.
 *
 * @param urls - Array of Facebook Ad Library URLs to fetch
 * @param accessToken - Facebook API access token
 * @param options - Batch configuration options
 * @returns Array of results for each URL (success or failure)
 */
export async function batchFetchPages(
  urls: string[],
  accessToken: string,
  options: BatchFetchOptions = {}
): Promise<BatchFetchResult[]> {
  const {
    batchSize = 2,
    delayBetweenBatches = 2000
  } = options;

  const results: BatchFetchResult[] = [];

  // Process in batches to stay under rate limits
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    // Use Promise.allSettled so one failure doesn't stop others
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const pageId = extractPageIdFromUrl(url);
        if (!pageId) {
          throw new Error('Invalid URL - could not extract page ID');
        }

        // Wrap in retry with exponential backoff
        const result = await fetchWithRetry(
          () => fetchAdsByPageUrl(url, accessToken, {
            countries: EU_COUNTRIES,
            limit: 500, // Pro tier depth
          }),
          { maxRetries: 2, baseDelay: 2000 }
        );

        if (!result.success) {
          throw new Error(result.error);
        }

        // Build snapshot from successful result
        const snapshot = buildSnapshotFromApiResult(result);

        return {
          url,
          pageId,
          pageName: result.pageName || '',
          snapshot,
        };
      })
    );

    // Map results for this batch
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const url = batch[j];
      const pageId = extractPageIdFromUrl(url) || '';

      if (result.status === 'fulfilled') {
        results.push({
          url,
          pageId: result.value.pageId,
          pageName: result.value.pageName,
          success: true,
          snapshot: result.value.snapshot,
        });
      } else {
        results.push({
          url,
          pageId,
          pageName: '',
          success: false,
          error: result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
        });
      }
    }

    // Delay before next batch (except for last batch)
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}
