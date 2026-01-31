import { NextRequest, NextResponse } from 'next/server';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  // This route only works locally (Puppeteer + file cache).
  // On Vercel the resolve endpoint returns snapshot URLs directly.
  if (process.env.VERCEL) {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  const { uuid } = await params;

  if (!UUID_REGEX.test(uuid)) {
    return NextResponse.json({ error: 'Invalid UUID' }, { status: 400 });
  }

  // Dynamic imports to avoid pulling in Puppeteer on Vercel
  const fs = (await import('fs/promises')).default;
  const { getMediaByUuid } = await import('@/lib/media-cache');

  const media = await getMediaByUuid(uuid);
  if (!media) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const fileBuffer = await fs.readFile(media.filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': media.contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
