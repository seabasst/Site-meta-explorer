import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // First, search local database for brands we've already ingested
    const localBrands = await prisma.adLibraryBrand.findMany({
      where: {
        OR: [
          { pageName: { contains: q, mode: 'insensitive' } },
          { pageId: { contains: q } },
        ],
        activeAdCount: { gt: 0 }, // Only show brands with ads
      },
      select: {
        pageId: true,
        pageName: true,
        activeAdCount: true,
        profilePicUrl: true,
        category: true,
      },
      orderBy: { activeAdCount: 'desc' },
      take: 10,
    });

    // If we found local results, return them (marked as local)
    if (localBrands.length > 0) {
      const results = localBrands.map((brand) => ({
        pageId: brand.pageId,
        pageName: brand.pageName,
        adCount: brand.activeAdCount,
        iconUrl: brand.profilePicUrl || `https://graph.facebook.com/${brand.pageId}/picture?type=square`,
        category: brand.category || null,
        source: 'local',
      }));

      console.log(`[search-pages] Found ${results.length} local results for "${q}"`);
      return NextResponse.json({ results, source: 'local' });
    }

    // No local results, fall back to Facebook API
    console.log(`[search-pages] No local results for "${q}", trying Facebook API`);

    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN1 || process.env.FACEBOOK_ACCESS_TOKEN;
    if (!accessToken) {
      // Return empty results instead of error if no token
      return NextResponse.json({ results: [], source: 'none' });
    }
    // Search across multiple large markets for broader coverage
    const countries = ['SE', 'NO', 'DK', 'FI', 'DE', 'GB', 'FR', 'NL'];  // Nordic + major EU
    const fetches = countries.map((country) => {
      const params = new URLSearchParams({
        access_token: accessToken,
        search_terms: q,
        ad_reached_countries: JSON.stringify([country]),
        ad_type: 'ALL',
        ad_active_status: 'ALL',
        fields: 'id,page_id,page_name',
        limit: '50',
      });
      return fetch(`https://graph.facebook.com/v19.0/ads_archive?${params}`);
    });

    const responses = await Promise.all(fetches);
    const allData: Array<{ page_id: string; page_name: string }> = [];

    for (const res of responses) {
      const json = await res.json();
      if (json.error) {
        console.error('[search-pages] Facebook API error:', json.error);
        continue;
      }
      if (json.data) {
        allData.push(...json.data);
      }
    }

    // Count ads per page and deduplicate
    const pageMap = new Map<string, { pageName: string; adCount: number }>();

    for (const item of allData) {
      if (!item.page_id) continue;
      const existing = pageMap.get(item.page_id);
      if (existing) {
        existing.adCount++;
      } else {
        pageMap.set(item.page_id, {
          pageName: item.page_name ?? `Page ${item.page_id}`,
          adCount: 1,
        });
      }
    }

    const unique = Array.from(pageMap.entries()).map(([pageId, { pageName, adCount }]) => ({
      pageId,
      pageName,
      adCount,
      iconUrl: `https://graph.facebook.com/${pageId}/picture?type=square`,
    }));

    // Sort: exact match first, then starts-with, then contains, then by ad count
    const lowerQ = q.toLowerCase();
    unique.sort((a, b) => {
      const aName = a.pageName.toLowerCase();
      const bName = b.pageName.toLowerCase();
      const aExact = aName === lowerQ;
      const bExact = bName === lowerQ;
      if (aExact !== bExact) return aExact ? -1 : 1;
      const aStarts = aName.startsWith(lowerQ);
      const bStarts = bName.startsWith(lowerQ);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      const aContains = aName.includes(lowerQ);
      const bContains = bName.includes(lowerQ);
      if (aContains !== bContains) return aContains ? -1 : 1;
      return b.adCount - a.adCount;
    });

    const results = unique.slice(0, 10).map(r => ({ ...r, category: null, source: 'api' }));

    return NextResponse.json({ results, source: 'api' });
  } catch (error) {
    console.error('[search-pages] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
