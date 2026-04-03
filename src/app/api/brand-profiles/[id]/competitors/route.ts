import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const MAX_COMPETITORS = 10;

const linkSchema = z.object({
  adLibraryBrandId: z.string().min(1, 'adLibraryBrandId is required'),
  notes: z.string().max(500).optional().nullable(),
});

const unlinkSchema = z.object({
  competitorId: z.string().min(1, 'competitorId is required'),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Helper: verify auth and profile ownership, returns { user, profile } or error response */
async function verifyOwnership(profileId: string) {
  const session = await auth();
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) };
  }

  const profile = await prisma.brandProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) };
  }
  if (profile.userId !== user.id) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { user, profile };
}

/**
 * POST /api/brand-profiles/[id]/competitors
 * Link a competitor brand to a profile.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const result = await verifyOwnership(id);
    if ('error' in result) return result.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = linkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { adLibraryBrandId, notes } = parsed.data;

    // Validate the AdLibraryBrand exists
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { id: adLibraryBrandId },
    });
    if (!brand) {
      return NextResponse.json(
        { error: 'AdLibraryBrand not found' },
        { status: 404 }
      );
    }

    // Check max competitors limit
    const currentCount = await prisma.brandCompetitor.count({
      where: { profileId: id },
    });
    if (currentCount >= MAX_COMPETITORS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_COMPETITORS} competitors per profile` },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await prisma.brandCompetitor.findUnique({
      where: { profileId_adLibraryBrandId: { profileId: id, adLibraryBrandId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'This competitor is already linked to this profile' },
        { status: 409 }
      );
    }

    const competitor = await prisma.brandCompetitor.create({
      data: {
        profileId: id,
        adLibraryBrandId,
        notes: notes ?? null,
      },
      include: {
        adLibraryBrand: {
          select: {
            id: true,
            pageId: true,
            pageName: true,
            profilePicUrl: true,
          },
        },
      },
    });

    return NextResponse.json({ competitor }, { status: 201 });
  } catch (error) {
    console.error('[brand-profiles] POST competitors error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/brand-profiles/[id]/competitors
 * Unlink a competitor from a profile.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const result = await verifyOwnership(id);
    if ('error' in result) return result.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = unlinkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { competitorId } = parsed.data;

    // Verify the competitor belongs to this profile
    const competitor = await prisma.brandCompetitor.findUnique({
      where: { id: competitorId },
    });
    if (!competitor) {
      return NextResponse.json({ error: 'Competitor link not found' }, { status: 404 });
    }
    if (competitor.profileId !== id) {
      return NextResponse.json({ error: 'Competitor does not belong to this profile' }, { status: 403 });
    }

    await prisma.brandCompetitor.delete({ where: { id: competitorId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[brand-profiles] DELETE competitors error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
