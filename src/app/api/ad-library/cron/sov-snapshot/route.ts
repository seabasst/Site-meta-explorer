import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300;

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: NextRequest) {
  // Verify cron secret — fail-closed. Missing CRON_SECRET = 401, never bypass.
  const authHeader = request.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const weekStart = getWeekStart(new Date());
    console.log(`SoV snapshot for week: ${weekStart.toISOString().split('T')[0]}`);

    const brands = await prisma.adLibraryBrand.findMany({
      where: {
        ingestionStatus: { in: ['active', 'completed'] },
        category: { not: null },
      },
      select: { id: true, pageName: true, category: true },
    });

    let created = 0;
    let skipped = 0;

    for (const brand of brands) {
      const existing = await prisma.sovSnapshot.findUnique({
        where: { brandId_weekStart: { brandId: brand.id, weekStart } },
      });
      if (existing) {
        skipped++;
        continue;
      }

      const [activeCount, formatCounts, reachData, newAds, spendData] = await Promise.all([
        prisma.adLibraryAd.count({
          where: { brandId: brand.id, isActive: true },
        }),
        prisma.adLibraryAd.groupBy({
          by: ['displayFormat'],
          where: { brandId: brand.id, isActive: true },
          _count: true,
        }),
        prisma.adLibraryAd.aggregate({
          where: { brandId: brand.id, isActive: true },
          _sum: { reachEstimate: true },
        }),
        prisma.adLibraryAd.count({
          where: {
            brandId: brand.id,
            startDate: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.adLibraryAd.aggregate({
          where: { brandId: brand.id, isActive: true },
          _sum: { spendLower: true, spendUpper: true },
        }),
      ]);

      const formats: Record<string, number> = {};
      for (const f of formatCounts) {
        formats[f.displayFormat || 'unknown'] = f._count;
      }

      const spendLower = spendData._sum.spendLower || 0;
      const spendUpper = spendData._sum.spendUpper || 0;

      await prisma.sovSnapshot.create({
        data: {
          brandId: brand.id,
          weekStart,
          activeAds: activeCount,
          totalReach: BigInt(reachData._sum.reachEstimate || 0),
          estSpend: (spendLower + spendUpper) / 2,
          videoCount: formats['video'] || 0,
          imageCount: formats['image'] || 0,
          carouselCount: formats['carousel'] || 0,
          newAdsCount: newAds,
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      week: weekStart.toISOString().split('T')[0],
      brands: brands.length,
      created,
      skipped,
    });
  } catch (error) {
    console.error('SoV snapshot error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
