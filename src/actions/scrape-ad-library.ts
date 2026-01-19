'use server';

import { scrapeAdLibrary, AdLibraryResponse } from '@/lib/ad-library-scraper';

export async function scrapeAdLibraryAction(
  adLibraryUrl: string,
  scrapeDemographics?: boolean,
  maxDemographicAds?: number
): Promise<AdLibraryResponse> {
  // Validate URL
  if (!adLibraryUrl.includes('facebook.com/ads/library')) {
    return {
      success: false,
      error: 'Please provide a valid Facebook Ad Library URL',
    };
  }

  // Only enable debug mode in development (writes to /tmp which may cause issues in production)
  const isProduction = process.env.NODE_ENV === 'production';
  return await scrapeAdLibrary(adLibraryUrl, !isProduction, {
    scrapeDemographics,
    maxDemographicAds,
  });
}
