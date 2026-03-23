import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

const updateSchema = z.object({
  brandVoice: z.string().max(2000).optional().nullable(),
  missionStatement: z.string().max(1000).optional().nullable(),
  demographics: z.array(z.string().max(100)).max(20).optional(),
  interests: z.array(z.string().max(100)).max(30).optional(),
  primaryColor: z.string().regex(hexColorRegex, 'Invalid hex color').optional().nullable(),
  secondaryColor: z.string().regex(hexColorRegex, 'Invalid hex color').optional().nullable(),
  accentColor: z.string().regex(hexColorRegex, 'Invalid hex color').optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  logoKey: z.string().optional().nullable(),
  referenceImages: z.array(z.object({
    url: z.string().url(),
    key: z.string(),
    name: z.string().optional(),
  })).max(10).optional().nullable(),
});

/**
 * GET /api/brand-guidelines
 * Fetch the current user's brand guidelines.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const guidelines = await prisma.brandGuidelines.findUnique({
    where: { userId: user.id },
  });

  return NextResponse.json({ guidelines });
}

/**
 * PUT /api/brand-guidelines
 * Create or update the current user's brand guidelines.
 */
export async function PUT(request: NextRequest) {
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

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Prisma Json fields need special null handling
  const refImagesCreate = data.referenceImages === null
    ? Prisma.JsonNull
    : data.referenceImages !== undefined
      ? (data.referenceImages as unknown as Prisma.InputJsonValue)
      : undefined;

  const refImagesUpdate = data.referenceImages === null
    ? Prisma.JsonNull
    : data.referenceImages !== undefined
      ? (data.referenceImages as unknown as Prisma.InputJsonValue)
      : undefined;

  const guidelines = await prisma.brandGuidelines.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      brandVoice: data.brandVoice ?? undefined,
      missionStatement: data.missionStatement ?? undefined,
      demographics: data.demographics ?? [],
      interests: data.interests ?? [],
      primaryColor: data.primaryColor ?? undefined,
      secondaryColor: data.secondaryColor ?? undefined,
      accentColor: data.accentColor ?? undefined,
      logoUrl: data.logoUrl ?? undefined,
      logoKey: data.logoKey ?? undefined,
      referenceImages: refImagesCreate,
    },
    update: {
      ...(data.brandVoice !== undefined && { brandVoice: data.brandVoice }),
      ...(data.missionStatement !== undefined && { missionStatement: data.missionStatement }),
      ...(data.demographics !== undefined && { demographics: data.demographics }),
      ...(data.interests !== undefined && { interests: data.interests }),
      ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
      ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor }),
      ...(data.accentColor !== undefined && { accentColor: data.accentColor }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.logoKey !== undefined && { logoKey: data.logoKey }),
      ...(refImagesUpdate !== undefined && { referenceImages: refImagesUpdate }),
    },
  });

  return NextResponse.json({ guidelines });
}
