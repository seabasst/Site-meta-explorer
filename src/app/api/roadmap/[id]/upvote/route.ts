import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/roadmap/[id]/upvote - Toggle upvote on a request
 * Returns: { upvoted: boolean, upvoteCount: number }
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    // Check if request exists
    const request = await prisma.roadmapRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Check if user already upvoted
    const existingUpvote = await prisma.roadmapUpvote.findUnique({
      where: {
        requestId_userId: {
          requestId: id,
          userId,
        },
      },
    });

    if (existingUpvote) {
      // Remove upvote
      await prisma.$transaction([
        prisma.roadmapUpvote.delete({
          where: { id: existingUpvote.id },
        }),
        prisma.roadmapRequest.update({
          where: { id },
          data: { upvoteCount: { decrement: 1 } },
        }),
      ]);

      const updated = await prisma.roadmapRequest.findUnique({
        where: { id },
        select: { upvoteCount: true },
      });

      return NextResponse.json({
        upvoted: false,
        upvoteCount: updated?.upvoteCount ?? 0,
      });
    } else {
      // Add upvote
      await prisma.$transaction([
        prisma.roadmapUpvote.create({
          data: {
            requestId: id,
            userId,
          },
        }),
        prisma.roadmapRequest.update({
          where: { id },
          data: { upvoteCount: { increment: 1 } },
        }),
      ]);

      const updated = await prisma.roadmapRequest.findUnique({
        where: { id },
        select: { upvoteCount: true },
      });

      return NextResponse.json({
        upvoted: true,
        upvoteCount: updated?.upvoteCount ?? 1,
      });
    }
  } catch (error) {
    console.error('Error toggling upvote:', error);
    return NextResponse.json(
      { error: 'Failed to toggle upvote' },
      { status: 500 }
    );
  }
}
