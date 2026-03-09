import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get all brands in this category with their ad stats
    const brands = await prisma.adLibraryBrand.findMany({
      where: { category: { equals: slug, mode: 'insensitive' } },
      select: {
        id: true,
        pageName: true,
        pageId: true,
        country: true,
        activeAdCount: true,
        totalReach: true,
        demographicsJson: true,
        _count: { select: { ads: true } },
      },
      orderBy: { totalReach: 'desc' },
    });

    if (brands.length === 0) {
      return Response.json({ error: `No brands found in category "${slug}"` }, { status: 404 });
    }

    // Get detailed stats for each brand
    const brandStats = await Promise.all(
      brands.map(async (brand) => {
        const [formatCounts, reachStats, recentAds] = await Promise.all([
          // Format distribution
          prisma.adLibraryAd.groupBy({
            by: ['displayFormat'],
            where: { brandId: brand.id },
            _count: true,
          }),
          // Spend & reach aggregates
          prisma.adLibraryAd.aggregate({
            where: { brandId: brand.id, isActive: true },
            _sum: { reachEstimate: true, spendLower: true, spendUpper: true },
            _avg: { reachEstimate: true },
            _count: true,
          }),
          // Most recent ads for ad age calculation
          prisma.adLibraryAd.findMany({
            where: { brandId: brand.id, isActive: true, startDate: { not: null } },
            select: { startDate: true },
            orderBy: { startDate: 'desc' },
            take: 100,
          }),
        ]);

        // Calculate format percentages
        const totalAds = brand._count.ads;
        const formats: Record<string, number> = {};
        for (const f of formatCounts) {
          formats[f.displayFormat || 'unknown'] = f._count;
        }
        const videoPct = totalAds > 0 ? ((formats['video'] || 0) / totalAds) * 100 : 0;
        const imagePct = totalAds > 0 ? ((formats['image'] || 0) / totalAds) * 100 : 0;
        const carouselPct = totalAds > 0 ? ((formats['carousel'] || 0) / totalAds) * 100 : 0;

        // Average ad age
        const now = Date.now();
        const adAges = recentAds
          .filter((a) => a.startDate)
          .map((a) => (now - a.startDate!.getTime()) / (1000 * 60 * 60 * 24));
        const avgAdAge = adAges.length > 0 ? adAges.reduce((s, a) => s + a, 0) / adAges.length : 0;

        // Estimated spend (average of lower and upper bounds)
        const spendLower = reachStats._sum.spendLower || 0;
        const spendUpper = reachStats._sum.spendUpper || 0;
        const estSpend = (spendLower + spendUpper) / 2;

        return {
          id: brand.id,
          name: brand.pageName,
          pageId: brand.pageId,
          country: brand.country,
          totalAds,
          activeAds: reachStats._count,
          totalReach: Number(brand.totalReach || 0),
          avgReachPerAd: Math.round(Number(reachStats._avg.reachEstimate) || 0),
          estSpend,
          videoPct: Math.round(videoPct),
          imagePct: Math.round(imagePct),
          carouselPct: Math.round(carouselPct),
          avgAdAgeDays: Math.round(avgAdAge),
          formats,
        };
      })
    );

    // Category-level aggregates
    const totalAds = brandStats.reduce((s, b) => s + b.totalAds, 0);
    const totalActiveAds = brandStats.reduce((s, b) => s + b.activeAds, 0);
    const totalReach = brandStats.reduce((s, b) => s + b.totalReach, 0);
    const avgReach = brandStats.length > 0 ? totalReach / brandStats.length : 0;
    const totalSpend = brandStats.reduce((s, b) => s + b.estSpend, 0);

    return Response.json({
      slug,
      label: formatCategoryLabel(slug),
      brandCount: brands.length,
      totalAds,
      totalActiveAds,
      totalReach,
      avgReach: Math.round(avgReach),
      totalSpend,
      brands: brandStats,
    });
  } catch (error) {
    console.error('Category detail error:', error);
    return Response.json({ error: 'Failed to fetch category details' }, { status: 500 });
  }
}

function formatCategoryLabel(slug: string): string {
  return slug
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
