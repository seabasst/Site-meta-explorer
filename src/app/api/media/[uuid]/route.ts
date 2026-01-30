import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { getMediaByUuid } from '@/lib/media-cache';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params;

  if (!UUID_REGEX.test(uuid)) {
    return NextResponse.json({ error: 'Invalid UUID' }, { status: 400 });
  }

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
