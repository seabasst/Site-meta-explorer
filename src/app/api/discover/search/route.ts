import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCategory } from '@/lib/discover/categories';

export const dynamic = 'force-dynamic';

// Powers the /analyze search box: given a query, suggest matching brands and
// matching categories. With no query, returns the top brands/categories so
// the page has something useful to show before the user types anything.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';

  try {
    const [brands, categoryRows] = await Promise.all([
      prisma.adLibraryBrand.findMany({
        where: q
          ? { pageName: { contains: q, mode: 'insensitive' } }
          : { ingestionStatus: 'active' },
        select: {
          pageId: true,
          pageName: true,
          profilePicUrl: true,
          category: true,
          country: true,
          activeAdCount: true,
        },
        orderBy: { activeAdCount: 'desc' },
        take: q ? 8 : 6,
      }),
      // Raw category is free text with many near-duplicates (e.g. "fashion" /
      // "Fashion Retail" / "Premium Fashion"), so pull every matching raw
      // value uncapped and merge them into canonical groups below rather
      // than capping at the DB level, which would drop small aliases.
      prisma.adLibraryBrand.groupBy({
        by: ['category'],
        where: {
          category: q ? { contains: q, mode: 'insensitive' } : { not: null },
        },
        _count: { _all: true },
        _sum: { activeAdCount: true },
      }),
    ]);

    const grouped = new Map<string, { slug: string; label: string; brandCount: number; totalActiveAds: number }>();
    for (const row of categoryRows) {
      if (!row.category) continue;
      const { slug, label } = resolveCategory(row.category);
      const existing = grouped.get(slug) ?? { slug, label, brandCount: 0, totalActiveAds: 0 };
      existing.brandCount += row._count._all;
      existing.totalActiveAds += row._sum.activeAdCount ?? 0;
      grouped.set(slug, existing);
    }

    const categories = Array.from(grouped.values())
      .sort((a, b) => b.totalActiveAds - a.totalActiveAds)
      .slice(0, q ? 5 : 8);

    return Response.json({ brands, categories });
  } catch (error) {
    console.error('Discover search error:', error);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
