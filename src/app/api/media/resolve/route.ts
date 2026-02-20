import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const IS_VERCEL = !!process.env.VERCEL;
const USE_R2_ONLY = process.env.USE_R2_ONLY === 'true';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adId, snapshotUrl } = body;

    if (!adId || !snapshotUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing adId or snapshotUrl' },
        { status: 400 },
      );
    }

    // First, check if we have this asset stored in R2
    const asset = await prisma.adAsset.findFirst({
      where: {
        ad: { adId: adId },
        downloadStatus: 'completed',
        storedUrl: { not: null },
      },
      select: {
        storedUrl: true,
        assetType: true,
      },
    });

    if (asset?.storedUrl) {
      return NextResponse.json({
        success: true,
        mediaUrl: asset.storedUrl,
        mediaType: asset.assetType === 'video' ? 'video' : 'image',
      });
    }

    // If R2-only mode or on Vercel, return snapshot URL as fallback
    if (USE_R2_ONLY || IS_VERCEL) {
      return NextResponse.json({
        success: true,
        mediaUrl: snapshotUrl,
        mediaType: 'snapshot',
      });
    }

    // Locally: use Puppeteer to extract and cache media
    const { getOrCacheMedia } = await import('@/lib/media-cache');
    const entry = await getOrCacheMedia(adId, snapshotUrl);

    if (!entry) {
      return NextResponse.json({ success: false });
    }

    return NextResponse.json({
      success: true,
      mediaUrl: `/api/media/${entry.uuid}`,
      mediaType: entry.mediaType,
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
