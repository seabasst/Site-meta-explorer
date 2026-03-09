import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params;
    const { searchParams } = new URL(request.url);
    const weeks = parseInt(searchParams.get('weeks') || '12');
    const metric = searchParams.get('metric') || 'activeAds'; // activeAds, totalReach, estSpend

    // Get brands in this category
    const brands = await prisma.adLibraryBrand.findMany({
      where: { category: { equals: category, mode: 'insensitive' } },
      select: { id: true, pageName: true },
    });

    if (brands.length === 0) {
      return Response.json({ error: 'No brands found' }, { status: 404 });
    }

    const brandIds = brands.map((b) => b.id);
    const brandMap = new Map(brands.map((b) => [b.id, b.pageName]));

    // Get snapshots for the last N weeks
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - weeks * 7);

    const snapshots = await prisma.sovSnapshot.findMany({
      where: {
        brandId: { in: brandIds },
        weekStart: { gte: cutoff },
      },
      orderBy: { weekStart: 'asc' },
    });

    // Build timeline: { week: string, brand1: value, brand2: value, ... }
    const weekMap = new Map<string, Record<string, number>>();

    for (const snap of snapshots) {
      const weekKey = snap.weekStart.toISOString().split('T')[0];
      const brandName = brandMap.get(snap.brandId) || 'Unknown';

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, { week: 0 }); // placeholder
      }

      const entry = weekMap.get(weekKey)!;

      let value: number;
      switch (metric) {
        case 'totalReach':
          value = Number(snap.totalReach);
          break;
        case 'estSpend':
          value = snap.estSpend;
          break;
        case 'newAds':
          value = snap.newAdsCount;
          break;
        case 'videoCount':
          value = snap.videoCount;
          break;
        default:
          value = snap.activeAds;
      }

      entry[brandName] = value;
    }

    // Convert to array and calculate share of voice percentages
    const timeline = Array.from(weekMap.entries()).map(([week, data]) => {
      const { ...brandValues } = data;
      delete brandValues.week;
      const total = Object.values(brandValues).reduce((s, v) => s + v, 0);

      const sovEntry: Record<string, number | string> = { week };
      const pctEntry: Record<string, number | string> = { week };

      for (const [brand, val] of Object.entries(brandValues)) {
        sovEntry[brand] = val;
        pctEntry[brand] = total > 0 ? Math.round((val / total) * 1000) / 10 : 0;
      }

      return { absolute: sovEntry, percentage: pctEntry, total };
    });

    // Latest week summary
    const latest = timeline[timeline.length - 1];
    const brandNames = brands.map((b) => b.pageName);

    return Response.json({
      category,
      metric,
      weeks: timeline.length,
      brands: brandNames,
      timeline: timeline.map((t) => t.absolute),
      timelinePercentage: timeline.map((t) => t.percentage),
      latestTotal: latest?.total || 0,
    });
  } catch (error) {
    console.error('SoV error:', error);
    return Response.json({ error: 'Failed to fetch share of voice data' }, { status: 500 });
  }
}
