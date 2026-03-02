import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// Admin email(s) - in production, use a proper admin system
const ADMIN_EMAILS = ['demo@example.com', 'sebastian@kirimediagroup.com'];

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/roadmap/[id] - Update request status (admin only)
 * Body: { status: string, adminNotes?: string }
 */
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isAdmin(session.user.email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { status, adminNotes } = body as {
      status?: string;
      adminNotes?: string;
    };

    const validStatuses = ['pending', 'planned', 'in_progress', 'completed', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      );
    }

    // Check if request exists
    const existing = await prisma.roadmapRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // If approving a brand request, create AdLibraryBrand
    const shouldCreateBrand =
      existing.type === 'brand' &&
      status === 'planned' &&
      existing.status === 'pending' &&
      existing.pageId;

    const updated = await prisma.$transaction(async (tx) => {
      // Update request status
      const request = await tx.roadmapRequest.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(adminNotes !== undefined && { adminNotes }),
        },
      });

      // Create AdLibraryBrand when approving a brand request
      if (shouldCreateBrand && existing.pageId) {
        // Check if brand already exists
        const existingBrand = await tx.adLibraryBrand.findUnique({
          where: { pageId: existing.pageId },
        });

        if (!existingBrand) {
          await tx.adLibraryBrand.create({
            data: {
              pageId: existing.pageId,
              pageName: existing.title,
              ingestionStatus: 'pending',
              priority: 1, // Give user-requested brands higher priority
            },
          });
        }
      }

      return request;
    });

    return NextResponse.json({
      request: {
        id: updated.id,
        status: updated.status,
        adminNotes: updated.adminNotes,
      },
    });
  } catch (error) {
    console.error('Error updating roadmap request:', error);
    return NextResponse.json(
      { error: 'Failed to update request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roadmap/[id] - Delete request (admin or owner only)
 */
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Find the request
    const existing = await prisma.roadmapRequest.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Only admin or owner can delete
    const canDelete = isAdmin(session.user.email) || existing.userId === session.user.id;
    if (!canDelete) {
      return NextResponse.json({ error: 'Not authorized to delete this request' }, { status: 403 });
    }

    await prisma.roadmapRequest.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting roadmap request:', error);
    return NextResponse.json(
      { error: 'Failed to delete request' },
      { status: 500 }
    );
  }
}
