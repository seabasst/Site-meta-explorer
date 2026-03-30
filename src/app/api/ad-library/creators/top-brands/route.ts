import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const groups = await prisma.creatorPartnership.groupBy({
      by: ['brandId'],
      _sum: { adCount: true, totalReach: true },
      _count: true,
      orderBy: { _sum: { adCount: 'desc' } },
      take: 10,
    });

    const brandIds = groups.map((g) => g.brandId);
    const brands = await prisma.adLibraryBrand.findMany({
      where: { id: { in: brandIds } },
      select: { id: true, pageId: true, pageName: true },
    });
    const brandMap = new Map(brands.map((b) => [b.id, b]));

    const result = groups
      .map((g) => {
        const brand = brandMap.get(g.brandId);
        if (!brand) return null;
        return {
          brandId: brand.id,
          brandPageId: brand.pageId,
          brandName: brand.pageName,
          partnershipAds: g._sum.adCount || 0,
          creatorCount: g._count,
          totalReach: Number(g._sum.totalReach || 0),
        };
      })
      .filter(Boolean);

    return NextResponse.json({ brands: result });
  } catch (error) {
    console.error('Top partnership brands error:', error);
    return NextResponse.json({ brands: [] });
  }
}
