import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ad-library/filters
 * Returns available filter options for the ad library.
 */
export async function GET() {
  try {
    const [categories, formats] = await Promise.all([
      prisma.adLibraryBrand.groupBy({
        by: ['category'],
        _count: true,
        where: { category: { not: null } },
        orderBy: { _count: { category: 'desc' } },
      }),
      prisma.adLibraryAd.groupBy({
        by: ['displayFormat'],
        _count: true,
        where: { displayFormat: { not: null } },
        orderBy: { _count: { displayFormat: 'desc' } },
      }),
    ]);

    return NextResponse.json({
      categories: categories.map((c) => ({
        value: c.category!,
        count: c._count,
      })),
      formats: formats.map((f) => ({
        value: f.displayFormat!,
        count: f._count,
      })),
      daysActiveRanges: [
        { label: 'Last 7 days', min: 0, max: 7 },
        { label: '7–30 days', min: 7, max: 30 },
        { label: '30–90 days', min: 30, max: 90 },
        { label: '90–180 days', min: 90, max: 180 },
        { label: '180+ days', min: 180, max: undefined },
      ],
    });
  } catch (error) {
    console.error('Filters error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
