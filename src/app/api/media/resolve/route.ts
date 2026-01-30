import { NextRequest, NextResponse } from 'next/server';
import { getOrCacheMedia } from '@/lib/media-cache';

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
