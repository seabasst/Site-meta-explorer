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

const createSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name must be 100 characters or less'),
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

/**
 * GET /api/brand-profiles
 * List all profiles for authenticated user.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      // v2 dashboard is open access — return empty list for unauthenticated users
      // so onboarding prompt can check profile existence without auth
      return NextResponse.json({ profiles: [] });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ profiles: [] });
    }

    const profiles = await prisma.brandProfile.findMany({
      where: { userId: user.id },
      include: profileInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('[brand-profiles] GET error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/brand-profiles
 * Create a new brand profile.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if this is the user's first profile (auto-activate)
    const existingCount = await prisma.brandProfile.count({
      where: { userId: user.id },
    });

    // Handle Json field
    const refImages = data.referenceImages === null
      ? Prisma.JsonNull
      : data.referenceImages !== undefined
        ? (data.referenceImages as unknown as Prisma.InputJsonValue)
        : undefined;

    const profile = await prisma.brandProfile.create({
      data: {
        userId: user.id,
        name: data.name,
        brandVoice: data.brandVoice ?? undefined,
        missionStatement: data.missionStatement ?? undefined,
        positioning: data.positioning ?? undefined,
        painPoints: data.painPoints ?? [],
        demographics: data.demographics ?? [],
        interests: data.interests ?? [],
        logoUrl: data.logoUrl ?? undefined,
        logoKey: data.logoKey ?? undefined,
        primaryColor: data.primaryColor ?? undefined,
        secondaryColor: data.secondaryColor ?? undefined,
        accentColor: data.accentColor ?? undefined,
        referenceImages: refImages,
        isActive: existingCount === 0, // First profile is auto-active
      },
      include: profileInclude,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error('[brand-profiles] POST error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
