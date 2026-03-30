import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    const page = Math.max(1, parseInt(sp.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '24')));
    const search = sp.get('search')?.trim() || '';
    const brandId = sp.get('brandId') || '';
    const sortBy = sp.get('sortBy') || 'reach';
    const sortOrder = (sp.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const minBrands = parseInt(sp.get('minBrands') || '0');
    const minReach = parseInt(sp.get('minReach') || '0');
    const country = sp.get('country') || '';
    const category = sp.get('category') || '';

    // Build where clause — partnership conditions are collected then merged
    const where: Record<string, unknown> = {};
    const partnershipConditions: Record<string, unknown>[] = [];

    if (search) {
      where.pageName = { contains: search, mode: 'insensitive' };
    }

    if (minBrands > 0) {
      where.brandCount = { gte: minBrands };
    }

    if (minReach > 0) {
      where.totalReach = { gte: minReach };
    }

    if (country) {
      partnershipConditions.push({ partnerships: { some: { brand: { country } } } });
    }

    if (category) {
      partnershipConditions.push({ partnerships: { some: { brand: { category } } } });
    }

    if (brandId) {
      partnershipConditions.push({ partnerships: { some: { brandId } } });
    }

    if (partnershipConditions.length === 1) {
      Object.assign(where, partnershipConditions[0]);
    } else if (partnershipConditions.length > 1) {
      where.AND = partnershipConditions;
    }

    // Sort mapping
    const orderByMap: Record<string, Record<string, string>> = {
      reach: { totalReach: sortOrder },
      ads: { totalAds: sortOrder },
      brands: { brandCount: sortOrder },
      name: { pageName: sortOrder },
    };
    const orderBy = orderByMap[sortBy] || orderByMap.reach;

    const [creators, total] = await Promise.all([
      prisma.adCreator.findMany({
        where: where as any,
        include: {
          partnerships: {
            include: {
              brand: {
                select: {
                  pageId: true,
                  pageName: true,
                  profilePicUrl: true,
                  category: true,
                  country: true,
                },
              },
            },
            orderBy: { totalReach: 'desc' },
          },
        },
        orderBy: orderBy as any,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.adCreator.count({ where: where as any }),
    ]);

    // Get available filter options from brands that have creator partnerships
    const brandsWithPartnerships = await prisma.adLibraryBrand.findMany({
      where: {
        creatorPartnerships: { some: {} },
      },
      select: { id: true, pageId: true, pageName: true, category: true, country: true },
      orderBy: { pageName: 'asc' },
    });

    const countries = [...new Set(
      brandsWithPartnerships.map((b) => b.country).filter(Boolean) as string[],
    )].sort();

    const categories = [...new Set(
      brandsWithPartnerships.map((b) => b.category).filter(Boolean) as string[],
    )].sort();

    const brands = brandsWithPartnerships.map((b) => ({
      id: b.id,
      pageId: b.pageId,
      name: b.pageName,
    }));

    // Summary stats
    const stats = await prisma.adCreator.aggregate({
      _count: true,
      _sum: { totalReach: true, totalAds: true },
    });

    return NextResponse.json({
      creators: creators.map((c) => ({
        id: c.id,
        pageId: c.pageId,
        pageName: c.pageName,
        totalAds: c.totalAds,
        totalReach: c.totalReach,
        brandCount: c.brandCount,
        reachPerAd: c.totalAds > 0 ? Math.round(c.totalReach / c.totalAds) : 0,
        partnerships: c.partnerships.map((p) => ({
          brandPageId: p.brand.pageId,
          brandName: p.brand.pageName,
          brandProfilePic: p.brand.profilePicUrl,
          brandCategory: p.brand.category,
          brandCountry: p.brand.country,
          adCount: p.adCount,
          totalReach: p.totalReach,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: {
        countries,
        categories,
        brands,
      },
      summary: {
        totalCreators: stats._count,
        totalReach: Number(stats._sum.totalReach || 0),
        totalAds: stats._sum.totalAds || 0,
      },
    });
  } catch (error) {
    console.error('Creators API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
