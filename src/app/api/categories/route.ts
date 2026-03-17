import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get all categories with brand counts and aggregate stats
    const brands = await prisma.adLibraryBrand.findMany({
      where: { category: { not: null } },
      select: {
        category: true,
        pageName: true,
        activeAdCount: true,
        totalReach: true,
        ingestionStatus: true,
        _count: { select: { ads: true } },
      },
    });

    // Group by category
    const categoryMap = new Map<
      string,
      {
        brandCount: number;
        brandsIngested: number;
        totalActiveAds: number;
        totalReach: bigint;
        brands: string[];
      }
    >();

    for (const brand of brands) {
      const cat = brand.category!;
      const existing = categoryMap.get(cat) || {
        brandCount: 0,
        brandsIngested: 0,
        totalActiveAds: 0,
        totalReach: BigInt(0),
        brands: [],
      };

      existing.brandCount++;
      if (brand.ingestionStatus === 'active' || brand.ingestionStatus === 'completed') {
        existing.brandsIngested++;
      }
      existing.totalActiveAds += brand.activeAdCount || 0;
      existing.totalReach += brand.totalReach || BigInt(0);
      existing.brands.push(brand.pageName);

      categoryMap.set(cat, existing);
    }

    // Only include categories that have ingested brands
    const categories = Array.from(categoryMap.entries())
      .filter(([, stats]) => stats.brandsIngested > 0)
      .map(([category, stats]) => ({
        slug: category.toLowerCase().replace(/\s+/g, '_'),
        label: formatCategoryLabel(category),
        brandCount: stats.brandCount,
        brandsIngested: stats.brandsIngested,
        ingestionPct: Math.round((stats.brandsIngested / stats.brandCount) * 100),
        totalActiveAds: stats.totalActiveAds,
        totalReach: Number(stats.totalReach),
        brands: stats.brands.slice(0, 6),
      }))
      .sort((a, b) => b.totalActiveAds - a.totalActiveAds);

    return Response.json(categories);
  } catch (error) {
    console.error('Categories error:', error);
    return Response.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

function formatCategoryLabel(slug: string): string {
  return slug
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
