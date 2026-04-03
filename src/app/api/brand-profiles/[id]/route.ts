import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

const referenceImageSchema = z.object({
  url: z.string().url(),
  key: z.string(),
  name: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  brandVoice: z.string().max(2000).optional().nullable(),
  missionStatement: z.string().max(1000).optional().nullable(),
  positioning: z.string().max(2000).optional().nullable(),
  painPoints: z.array(z.string().max(200)).max(20).optional(),
  demographics: z.array(z.string().max(100)).max(20).optional(),
  interests: z.array(z.string().max(100)).max(30).optional(),
  logoUrl: z.string().url().optional().nullable(),
  logoKey: z.string().optional().nullable(),
  primaryColor: z.string().regex(hexColorRegex, 'Invalid hex color').optional().nullable(),
  secondaryColor: z.string().regex(hexColorRegex, 'Invalid hex color').optional().nullable(),
  accentColor: z.string().regex(hexColorRegex, 'Invalid hex color').optional().nullable(),
  referenceImages: z.array(referenceImageSchema).max(10).optional().nullable(),
  isActive: z.boolean().optional(),
});

/** Include clause for full profile with competitors */
const profileInclude = {
  competitors: {
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
    orderBy: { createdAt: 'asc' as const },
  },
};

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/brand-profiles/[id]
 * Get a single brand profile by ID.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const profile = await prisma.brandProfile.findUnique({
      where: { id },
      include: profileInclude,
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[brand-profiles] GET [id] error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * PUT /api/brand-profiles/[id]
 * Update a brand profile.
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existing = await prisma.brandProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // If setting this profile as active, deactivate all others for this user
    if (data.isActive === true) {
      await prisma.brandProfile.updateMany({
        where: { userId: user.id, id: { not: id } },
        data: { isActive: false },
      });
    }

    // Handle Json field (referenceImages)
    const refImages = data.referenceImages === null
      ? Prisma.JsonNull
      : data.referenceImages !== undefined
        ? (data.referenceImages as unknown as Prisma.InputJsonValue)
        : undefined;

    const profile = await prisma.brandProfile.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.brandVoice !== undefined && { brandVoice: data.brandVoice }),
        ...(data.missionStatement !== undefined && { missionStatement: data.missionStatement }),
        ...(data.positioning !== undefined && { positioning: data.positioning }),
        ...(data.painPoints !== undefined && { painPoints: data.painPoints }),
        ...(data.demographics !== undefined && { demographics: data.demographics }),
        ...(data.interests !== undefined && { interests: data.interests }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.logoKey !== undefined && { logoKey: data.logoKey }),
        ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
        ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor }),
        ...(data.accentColor !== undefined && { accentColor: data.accentColor }),
        ...(refImages !== undefined && { referenceImages: refImages }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: profileInclude,
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[brand-profiles] PUT [id] error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/brand-profiles/[id]
 * Delete a brand profile and cascade-delete its competitors.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify ownership
    const existing = await prisma.brandProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const wasActive = existing.isActive;

    // Delete profile (competitors cascade-deleted by Prisma)
    await prisma.brandProfile.delete({ where: { id } });

    // If the deleted profile was active, activate the most recent remaining one
    if (wasActive) {
      const mostRecent = await prisma.brandProfile.findFirst({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
      });
      if (mostRecent) {
        await prisma.brandProfile.update({
          where: { id: mostRecent.id },
          data: { isActive: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[brand-profiles] DELETE [id] error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
