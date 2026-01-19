import { NextRequest, NextResponse } from 'next/server';
import { scrapeAdLibrary } from '@/lib/ad-library-scraper';

// Increase timeout to 60 seconds (requires Vercel Pro, Hobby is limited to 10s)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { adLibraryUrl, scrapeDemographics, maxDemographicAds } = await request.json();

    if (!adLibraryUrl || !adLibraryUrl.includes('facebook.com/ads/library')) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid Facebook Ad Library URL' },
        { status: 400 }
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const result = await scrapeAdLibrary(adLibraryUrl, !isProduction, {
      scrapeDemographics,
      maxDemographicAds,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to scrape Ad Library';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
