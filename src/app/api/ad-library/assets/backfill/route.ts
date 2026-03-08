import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ad-library/assets/backfill
 * Create AdAsset records for ads that have a snapshotUrl but no assets.
 * Body: { limit?: number, brandId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 100, 500);
    const brandId = body.brandId || undefined;

    // Find ads with snapshotUrl but no assets
    const ads = await prisma.adLibraryAd.findMany({
      where: {
        snapshotUrl: { not: null },
        assets: { none: {} },
        ...(brandId ? { brandId } : {}),
      },
      select: { id: true, snapshotUrl: true, displayFormat: true },
      take: limit,
    });

    if (ads.length === 0) {
      return NextResponse.json({ created: 0, message: 'No ads without assets found' });
    }

    // Create asset records
    const created = await prisma.adAsset.createMany({
      data: ads.map((ad) => ({
        adId: ad.id,
        assetType: ad.displayFormat === 'video' ? 'video' : 'image',
        originalUrl: ad.snapshotUrl!,
        downloadStatus: 'pending',
        position: 0,
      })),
    });

    return NextResponse.json({
      created: created.count,
      adsChecked: ads.length,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
