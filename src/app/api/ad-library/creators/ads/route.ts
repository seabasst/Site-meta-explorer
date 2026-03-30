import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const creatorId = sp.get('creatorId');

    if (!creatorId) {
      return NextResponse.json({ error: 'creatorId required' }, { status: 400 });
    }

    const partnerships = await prisma.creatorPartnership.findMany({
      where: { creatorId },
      select: {
        metaAdIds: true,
        snapshotUrls: true,
        mediaUrls: true,
        mediaTypes: true,
        adBodies: true,
        adTitles: true,
        brand: {
          select: { pageId: true, pageName: true, profilePicUrl: true },
        },
      },
    });

    // Build ads list — one entry per ad with its media
    const ads = partnerships.flatMap((p) =>
      p.metaAdIds.map((adId, i) => ({
        adId,
        snapshotUrl: p.snapshotUrls[i] || null,
        mediaUrl: p.mediaUrls[i] || null,
        mediaType: (p.mediaTypes[i] as 'image' | 'video') || 'image',
        body: p.adBodies[i] || null,
        title: p.adTitles[i] || null,
        brandName: p.brand.pageName,
        brandPageId: p.brand.pageId,
        brandProfilePic: p.brand.profilePicUrl,
      }))
    );

    return NextResponse.json({ ads });
  } catch (error) {
    console.error('Creator ads error:', error);
    return NextResponse.json({
      ads: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
