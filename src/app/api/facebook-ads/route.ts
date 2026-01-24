import { NextRequest, NextResponse } from 'next/server';
import {
  fetchFacebookAds,
  fetchAdsByPageUrl,
  extractPageIdFromUrl,
} from '@/lib/facebook-api';

export const maxDuration = 60; // Increased for fetching more ads

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      adLibraryUrl,
      pageId,
      searchTerms,
      countries = ['NL'],
      limit = 1000,
    } = body;

    // Get access token from environment or request
    const accessToken = body.accessToken || process.env.FACEBOOK_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Facebook access token is required. Set FACEBOOK_ACCESS_TOKEN environment variable or pass accessToken in request body.',
        },
        { status: 400 }
      );
    }

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

    let result;

    if (adLibraryUrl) {
      // Extract page ID from URL and fetch
      result = await fetchAdsByPageUrl(adLibraryUrl, accessToken, {
        countries,
        limit,
      });
    } else {
      // Direct API call with pageId or searchTerms
      result = await fetchFacebookAds({
        accessToken,
        pageId,
        searchTerms,
        countries,
        limit,
      });
    }

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
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
  const countries = searchParams.get('countries')?.split(',') || ['NL'];
  const limit = parseInt(searchParams.get('limit') || '25', 10);

  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: 'FACEBOOK_ACCESS_TOKEN environment variable is not set',
      },
      { status: 500 }
    );
  }

  if (!pageId && !searchTerms) {
    return NextResponse.json(
      {
        success: false,
        error: 'Please provide pageId or searchTerms (q) query parameter',
      },
      { status: 400 }
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

  return NextResponse.json(result);
}
