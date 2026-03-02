import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFacebookAds,
  fetchAdsByPageUrl,
  extractPageIdFromUrl,
  EU_COUNTRIES,
  type FacebookAdResult,
  type FacebookApiResult,
} from '@/lib/facebook-api';
import { auth } from '@/auth';
import { getSubscriptionStatus } from '@/lib/subscription';
import { getTierFromStatus, getMaxDepth, type TierName } from '@/lib/tiers';
import { prisma } from '@/lib/prisma';

/**
 * Search for ads in the local database.
 * Returns null if brand not found or no ads available.
 * Returns { localResult, pageId } for further processing.
 */
async function searchLocalDatabase(
  pageId?: string,
  searchTerms?: string,
  limit: number = 100
): Promise<{ result: FacebookApiResult; foundPageId: string } | null> {
  try {
    // Find brand by pageId or by name search
    let brand = null;

    if (pageId) {
      brand = await prisma.adLibraryBrand.findUnique({
        where: { pageId },
        include: {
          ads: {
            where: { isActive: true },
            take: limit,
            orderBy: { startDate: 'desc' },
            include: { assets: true },
          },
        },
      });
    }

    // If no pageId or not found, try searching by name
    if (!brand && searchTerms) {
      brand = await prisma.adLibraryBrand.findFirst({
        where: {
          pageName: {
            contains: searchTerms,
            mode: 'insensitive',
          },
        },
        include: {
          ads: {
            where: { isActive: true },
            take: limit,
            orderBy: { startDate: 'desc' },
            include: { assets: true },
          },
        },
      });
    }

    // No brand found or no ads
    if (!brand || brand.ads.length === 0) {
      return null;
    }

    // Transform local DB ads to FacebookAdResult format
    const ads: FacebookAdResult[] = brand.ads.map((ad) => {
      // Determine media type from assets or displayFormat
      let mediaType: 'video' | 'image' | 'carousel' | 'unknown' = 'unknown';
      if (ad.displayFormat) {
        if (ad.displayFormat === 'video') mediaType = 'video';
        else if (ad.displayFormat === 'image') mediaType = 'image';
        else if (ad.displayFormat === 'carousel' || ad.displayFormat === 'dpa') mediaType = 'carousel';
      } else if (ad.assets.length > 0) {
        const hasVideo = ad.assets.some(a => a.assetType === 'video');
        const hasMultiple = ad.assets.filter(a => a.assetType === 'image').length > 1;
        if (hasVideo) mediaType = 'video';
        else if (hasMultiple) mediaType = 'carousel';
        else mediaType = 'image';
      }

      return {
        adId: ad.adId,
        adArchiveId: ad.adId,
        pageId: brand.pageId,
        pageName: brand.pageName,
        startedRunning: ad.startDate?.toISOString() || null,
        stoppedRunning: ad.endDate?.toISOString() || null,
        isActive: ad.isActive,
        creativeBody: ad.body,
        linkTitle: ad.title,
        linkCaption: ad.caption,
        linkUrl: ad.linkUrl,
        snapshotUrl: ad.snapshotUrl,
        euTotalReach: ad.reachEstimate || 0,
        mediaType,
        demographics: null, // Not stored in local DB
        targeting: {
          ageMin: null,
          ageMax: null,
          gender: 'all',
          locations: [],
        },
        beneficiary: null,
        payer: null,
      };
    });

    // Calculate media breakdown
    const mediaTypeBreakdown = {
      video: ads.filter(a => a.mediaType === 'video').length,
      image: ads.filter(a => a.mediaType === 'image').length,
      carousel: ads.filter(a => a.mediaType === 'carousel').length,
      unknown: ads.filter(a => a.mediaType === 'unknown').length,
      videoPercentage: 0,
      imagePercentage: 0,
      carouselPercentage: 0,
    };

    if (ads.length > 0) {
      mediaTypeBreakdown.videoPercentage = (mediaTypeBreakdown.video / ads.length) * 100;
      mediaTypeBreakdown.imagePercentage = (mediaTypeBreakdown.image / ads.length) * 100;
      mediaTypeBreakdown.carouselPercentage = (mediaTypeBreakdown.carousel / ads.length) * 100;
    }

    return {
      result: {
        success: true,
        pageId: brand.pageId,
        pageName: brand.pageName,
        ads,
        rawAdBodies: ads.map(a => ({
          id: a.adId,
          ad_creative_bodies: a.creativeBody ? [a.creativeBody] : [],
          eu_total_reach: a.euTotalReach,
        })),
        totalAdsFound: ads.length,
        aggregatedDemographics: null,
        mediaTypeBreakdown,
        productAnalysis: null,
        spendAnalysis: null,
        metadata: {
          apiVersion: 'local-db',
          countries: ['ALL'],
          fetchedAt: new Date().toISOString(),
        },
      },
      foundPageId: brand.pageId,
    };
  } catch (error) {
    console.error('[LocalDB] Search error:', error);
    return null;
  }
}

/**
 * Fetch demographics from Facebook API for a specific page.
 * Uses a small sample of ads to get demographic data efficiently.
 */
async function fetchDemographicsOnly(
  pageId: string,
  accessToken: string,
  countries: string[]
): Promise<FacebookApiResult['aggregatedDemographics']> {
  try {
    // Fetch a small sample with demographics field
    const result = await fetchFacebookAds({
      accessToken,
      pageId,
      countries,
      limit: 50, // Small sample is enough for demographics
      activeStatus: 'ACTIVE',
    });

    if (result.success) {
      return result.aggregatedDemographics;
    }
    return null;
  } catch (error) {
    console.error('[Demographics] Fetch error:', error);
    return null;
  }
}

export const maxDuration = 60; // Increased for fetching more ads

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let {
      adLibraryUrl,
      pageId,
      searchTerms,
      countries = [...EU_COUNTRIES, 'GB'],
      limit = 100,  // Default to free tier limit
      activeStatus = 'ACTIVE',
    } = body;
    const { dateMin, dateMax } = body;

    // --- TIER ENFORCEMENT ---
    // Get user's tier from session
    const session = await auth();
    let tier: TierName = 'free';

    if (session?.user?.email) {
      const status = await getSubscriptionStatus(session.user.email);
      tier = getTierFromStatus(status);
    }

    // Cap limit to tier maximum
    const maxAllowed = getMaxDepth(tier);
    if (limit > maxAllowed) {
      console.log(`[Tier] Capped limit from ${limit} to ${maxAllowed} for ${tier} tier`);
      limit = maxAllowed;
    }
    // --- END TIER ENFORCEMENT ---

    // Validate that at least one search method is provided
    if (!adLibraryUrl && !pageId && !searchTerms) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide adLibraryUrl, pageId, or searchTerms',
        },
        { status: 400 }
      );
    }

    // Extract pageId from URL if provided
    let effectivePageId = pageId;
    if (adLibraryUrl && !effectivePageId) {
      effectivePageId = extractPageIdFromUrl(adLibraryUrl);
    }

    // Try local database first
    const localData = await searchLocalDatabase(effectivePageId || undefined, searchTerms, limit);

    if (localData) {
      console.log(`[LocalDB] Found ${localData.result.ads.length} ads for ${localData.result.pageName}`);

      // Try to fetch fresh demographics from API (in parallel with response)
      const accessToken = body.accessToken || process.env.FACEBOOK_ACCESS_TOKEN11 || process.env.FACEBOOK_ACCESS_TOKEN1;

      if (accessToken) {
        // Fetch demographics for the found brand
        const demographics = await fetchDemographicsOnly(
          localData.foundPageId,
          accessToken,
          countries
        );

        if (demographics) {
          console.log(`[LocalDB] Enriched with demographics: ${demographics.adsWithDemographics} ads`);
          return NextResponse.json({
            ...localData.result,
            aggregatedDemographics: demographics,
            source: 'local+demographics',
          });
        }
      }

      // Return local data without demographics if API unavailable
      return NextResponse.json({
        ...localData.result,
        source: 'local',
      });
    }

    // Fall back to Facebook API - now we need the token
    console.log('[LocalDB] No local data found, falling back to Facebook API');

    const accessToken = body.accessToken || process.env.FACEBOOK_ACCESS_TOKEN1;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Facebook access token is required. Set FACEBOOK_ACCESS_TOKEN environment variable or pass accessToken in request body.',
        },
        { status: 400 }
      );
    }

    let result;

    if (adLibraryUrl) {
      // Extract page ID from URL and fetch
      result = await fetchAdsByPageUrl(adLibraryUrl, accessToken, {
        countries,
        limit,
        activeStatus,
        dateMin,
        dateMax,
      });
    } else {
      // Direct API call with pageId or searchTerms
      result = await fetchFacebookAds({
        accessToken,
        pageId,
        searchTerms,
        countries,
        limit,
        activeStatus,
        dateMin,
        dateMax,
      });
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      ...result,
      source: 'api',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch from Facebook API';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// GET endpoint for simple queries
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const pageId = searchParams.get('pageId');
  const searchTerms = searchParams.get('searchTerms') || searchParams.get('q');
  const countries = searchParams.get('countries')?.split(',') || [...EU_COUNTRIES, 'GB'];
  let limit = parseInt(searchParams.get('limit') || '25', 10);

  // --- TIER ENFORCEMENT ---
  const session = await auth();
  let tier: TierName = 'free';

  if (session?.user?.email) {
    const status = await getSubscriptionStatus(session.user.email);
    tier = getTierFromStatus(status);
  }

  const maxAllowed = getMaxDepth(tier);
  if (limit > maxAllowed) {
    console.log(`[Tier] GET: Capped limit from ${limit} to ${maxAllowed} for ${tier} tier`);
    limit = maxAllowed;
  }
  // --- END TIER ENFORCEMENT ---

  if (!pageId && !searchTerms) {
    return NextResponse.json(
      {
        success: false,
        error: 'Please provide pageId or searchTerms (q) query parameter',
      },
      { status: 400 }
    );
  }

  // Try local database first
  const localData = await searchLocalDatabase(pageId || undefined, searchTerms || undefined, limit);

  if (localData) {
    console.log(`[LocalDB] GET: Found ${localData.result.ads.length} ads for ${localData.result.pageName}`);

    // Try to fetch fresh demographics from API
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN11 || process.env.FACEBOOK_ACCESS_TOKEN1;

    if (accessToken) {
      const demographics = await fetchDemographicsOnly(
        localData.foundPageId,
        accessToken,
        countries
      );

      if (demographics) {
        console.log(`[LocalDB] GET: Enriched with demographics: ${demographics.adsWithDemographics} ads`);
        return NextResponse.json({
          ...localData.result,
          aggregatedDemographics: demographics,
          source: 'local+demographics',
        });
      }
    }

    // Return local data without demographics if API unavailable
    return NextResponse.json({
      ...localData.result,
      source: 'local',
    });
  }

  // Fall back to Facebook API - now we need the token
  console.log('[LocalDB] GET: No local data found, falling back to Facebook API');

  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN1;

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: 'FACEBOOK_ACCESS_TOKEN environment variable is not set',
      },
      { status: 500 }
    );
  }

  const result = await fetchFacebookAds({
    accessToken,
    pageId: pageId || undefined,
    searchTerms: searchTerms || undefined,
    countries,
    limit,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({
    ...result,
    source: 'api',
  });
}
