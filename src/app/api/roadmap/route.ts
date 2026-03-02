import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/roadmap - List roadmap requests
 * Query params: type (brand|feature), status, sort (upvotes|newest)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // brand | feature | null (all)
    const status = searchParams.get('status'); // pending | planned | in_progress | completed | rejected
    const sort = searchParams.get('sort') || 'upvotes'; // upvotes | newest

    const where: {
      type?: string;
      status?: string;
    } = {};

    if (type) where.type = type;
    if (status) where.status = status;

    const requests = await prisma.roadmapRequest.findMany({
      where,
      orderBy: sort === 'newest'
        ? { createdAt: 'desc' }
        : { upvoteCount: 'desc' },
      include: {
        upvotes: {
          select: { userId: true },
        },
      },
    });

    // Get current user to check which requests they've upvoted
    const session = await auth();
    const userId = session?.user?.id;

    const serialized = requests.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      pageUrl: r.pageUrl,
      status: r.status,
      upvoteCount: r.upvoteCount,
      userEmail: r.userEmail,
      createdAt: r.createdAt.toISOString(),
      hasUpvoted: userId ? r.upvotes.some((u) => u.userId === userId) : false,
      isOwner: userId === r.userId,
    }));

    return NextResponse.json({ requests: serialized });
  } catch (error) {
    console.error('Error fetching roadmap requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roadmap - Submit a new request
 * Body: { type: 'brand' | 'feature', title: string, description?: string, pageUrl?: string }
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { type, title, description, pageUrl } = body as {
      type: 'brand' | 'feature';
      title: string;
      description?: string;
      pageUrl?: string;
    };

    // Validate type
    if (!type || !['brand', 'feature'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "brand" or "feature"' },
        { status: 400 }
      );
    }

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title must be 200 characters or less' },
        { status: 400 }
      );
    }

    // For brand requests, pageUrl is required
    if (type === 'brand' && !pageUrl) {
      return NextResponse.json(
        { error: 'Facebook page URL is required for brand requests' },
        { status: 400 }
      );
    }

    // Extract page ID from URL if present
    let pageId: string | null = null;
    if (pageUrl) {
      const match = pageUrl.match(/view_all_page_id=(\d+)/);
      pageId = match ? match[1] : null;
    }

    // Create the request with initial upvote from submitter
    const request = await prisma.$transaction(async (tx) => {
      const newRequest = await tx.roadmapRequest.create({
        data: {
          type,
          title: title.trim(),
          description: description?.trim() || null,
          pageUrl: pageUrl?.trim() || null,
          pageId,
          userId: session.user!.id!,
          userEmail: session.user!.email!,
          upvoteCount: 1, // Start with 1 upvote (submitter's)
        },
      });

      // Auto-upvote by submitter
      await tx.roadmapUpvote.create({
        data: {
          requestId: newRequest.id,
          userId: session.user!.id!,
        },
      });

      return newRequest;
    });

    return NextResponse.json({
      request: {
        id: request.id,
        type: request.type,
        title: request.title,
        description: request.description,
        pageUrl: request.pageUrl,
        status: request.status,
        upvoteCount: request.upvoteCount,
        createdAt: request.createdAt.toISOString(),
        hasUpvoted: true,
        isOwner: true,
      },
    });
  } catch (error) {
    console.error('Error creating roadmap request:', error);
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    );
  }
}
