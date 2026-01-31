import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Facebook access token not configured' },
      { status: 500 },
    );
  }

  try {
    // Search across multiple large markets for broader coverage
    const countries = ['US', 'GB', 'NL', 'DE', 'FR'];
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

    const results = unique.slice(0, 10);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[search-pages] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
