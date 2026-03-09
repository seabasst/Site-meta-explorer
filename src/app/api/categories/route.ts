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
        _count: { select: { ads: true } },
      },
    });

    // Group by category
    const categoryMap = new Map<
      string,
      {
        brandCount: number;
        totalAds: number;
        totalActiveAds: number;
        totalReach: bigint;
        brands: string[];
      }
    >();

    for (const brand of brands) {
      const cat = brand.category!;
      const existing = categoryMap.get(cat) || {
        brandCount: 0,
        totalAds: 0,
        totalActiveAds: 0,
        totalReach: BigInt(0),
        brands: [],
      };

      existing.brandCount++;
      existing.totalAds += brand._count.ads;
      existing.totalActiveAds += brand.activeAdCount || 0;
      existing.totalReach += brand.totalReach || BigInt(0);
      existing.brands.push(brand.pageName);

      categoryMap.set(cat, existing);
    }

    // Only include categories that have ads
    const categories = Array.from(categoryMap.entries())
      .filter(([, stats]) => stats.totalAds > 0)
      .map(([category, stats]) => ({
        slug: category,
        label: formatCategoryLabel(category),
        brandCount: stats.brandCount,
        totalAds: stats.totalAds,
        totalActiveAds: stats.totalActiveAds,
        totalReach: Number(stats.totalReach),
        brands: stats.brands.slice(0, 6),
      }))
      .sort((a, b) => b.totalAds - a.totalAds);

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
