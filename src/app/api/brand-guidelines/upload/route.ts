import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { uploadToR2, deleteFromR2, extensionFromContentType } from '@/lib/r2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

/**
 * POST /api/brand-guidelines/upload
 * Upload a logo or reference image for brand guidelines.
 * FormData: file (File), type ('logo' | 'reference')
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const type = formData.get('type') as string | null;

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  if (!type || !['logo', 'reference'].includes(type)) {
    return NextResponse.json(
      { error: 'type must be "logo" or "reference"' },
      { status: 400 }
    );
  }

  // Validate file type
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PNG, JPEG, WebP, SVG' },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 4MB' },
      { status: 400 }
    );
  }

  const ext = extensionFromContentType(file.type);
  const buffer = Buffer.from(await file.arrayBuffer());

  let key: string;
  if (type === 'logo') {
    key = `brand-assets/${user.id}/logo${ext}`;

    // Clean up previous logo if it exists
    const existing = await prisma.brandGuidelines.findUnique({
      where: { userId: user.id },
      select: { logoKey: true },
    });

    if (existing?.logoKey) {
      try {
        await deleteFromR2(existing.logoKey);
      } catch (err) {
        console.error('Failed to delete old logo from R2:', err);
        // Continue with upload even if delete fails
      }
    }
  } else {
    key = `brand-assets/${user.id}/ref-${Date.now()}${ext}`;
  }

  try {
    const result = await uploadToR2(key, buffer, file.type);
    return NextResponse.json({ url: result.url, key: result.key });
  } catch (err) {
    console.error('R2 upload error:', err);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
