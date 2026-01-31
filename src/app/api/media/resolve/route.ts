import { NextRequest, NextResponse } from 'next/server';
import { getOrCacheMedia } from '@/lib/media-cache';

const IS_VERCEL = !!process.env.VERCEL;

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

    // On Vercel, Puppeteer + local file cache won't work.
    // Return the snapshot URL directly so the client can render it in an iframe.
    if (IS_VERCEL) {
      return NextResponse.json({
        success: true,
        mediaUrl: snapshotUrl,
        mediaType: 'snapshot',
      });
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
