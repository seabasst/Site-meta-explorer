'use server';

import { fetchAllSitemapURLs } from '@/lib/sitemap-parser';
import { classifyURLs, ClassificationResult } from '@/lib/url-classifier';

export interface AnalysisResult {
  success: true;
  data: ClassificationResult;
  analyzedUrl: string;
  totalUrls: number;
}

export interface AnalysisError {
  success: false;
  error: string;
}

export type AnalyzeResponse = AnalysisResult | AnalysisError;

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function analyzeSitemap(url: string): Promise<AnalyzeResponse> {
  // Validate URL
  let normalizedUrl = url.trim();

  // Add https:// if no protocol specified
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  if (!isValidUrl(normalizedUrl)) {
    return {
      success: false,
      error: 'Please enter a valid URL (e.g., https://example.com)',
    };
  }

  try {
    // Fetch all URLs from sitemap
    const sitemapUrls = await fetchAllSitemapURLs(normalizedUrl);

    if (sitemapUrls.length === 0) {
      return {
        success: false,
        error: 'No URLs found in sitemap. The site may not have a publicly accessible sitemap.',
      };
    }

    // Classify URLs
    const classificationResult = classifyURLs(sitemapUrls);

    return {
      success: true,
      data: classificationResult,
      analyzedUrl: normalizedUrl,
      totalUrls: sitemapUrls.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return {
      success: false,
      error: message,
    };
  }
}
