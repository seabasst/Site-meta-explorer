import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// GET /api/genome/avatar/[pageId]
//
// Redirects to the page's current Facebook profile picture. The picture edge is
// public (no token, so no Ad Library quota), but its CDN URLs are signed and
// expire after ~4 days, so they can't be stored: resolve on request and let the
// CDN hold the redirect for a day. 404 for default silhouettes or failures, and
// the page falls back to a monogram.
// =============================================================================

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  if (!/^\d{5,20}$/.test(pageId)) return new NextResponse(null, { status: 404 });

  const res = await fetch(`https://graph.facebook.com/v22.0/${pageId}/picture?type=large&redirect=false`)
    .then((r) => r.json())
    .catch(() => null);
  const pic = res?.data as { url?: string; is_silhouette?: boolean } | undefined;

  if (!pic?.url || pic.is_silhouette) {
    // A silhouette is a real answer worth caching; a failed lookup is retried soon.
    const maxAge = pic?.is_silhouette ? 86400 : 300;
    return new NextResponse(null, { status: 404, headers: { 'Cache-Control': `public, s-maxage=${maxAge}` } });
  }
  return NextResponse.redirect(pic.url, {
    status: 302,
    headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=86400' },
  });
}
