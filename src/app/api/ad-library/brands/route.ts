import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

type IngestionStatus = 'pending' | 'active' | 'paused' | 'failed';
type SortField = 'priority' | 'activeAdCount' | 'lastCheckedAt' | 'totalReach' | 'createdAt';
type SortOrder = 'asc' | 'desc';

interface BrandsQueryParams {
  page: number;
  limit: number;
  status?: IngestionStatus;
  category?: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  search?: string;
}

interface SerializedBrand {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  country: string | null;
  category: string | null;
  website: string | null;
  totalReach: string;
  activeAdCount: number;
  lastCheckedAt: Date | null;
  ingestionStatus: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

interface BrandsListResponse {
  brands: SerializedBrand[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// =============================================================================
// Helpers
// =============================================================================

function parseQueryParams(req: NextRequest): BrandsQueryParams {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

  const status = searchParams.get('status') as IngestionStatus | null;
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  const sortBy = (searchParams.get('sortBy') ?? 'priority') as SortField;
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as SortOrder;

  // Validate sortBy
  const validSortFields: SortField[] = ['priority', 'activeAdCount', 'lastCheckedAt', 'totalReach', 'createdAt'];
  const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'priority';

  // Validate sortOrder
  const finalSortOrder: SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    status: status && ['pending', 'active', 'paused', 'failed'].includes(status) ? status : undefined,
    category: category || undefined,
    sortBy: finalSortBy,
    sortOrder: finalSortOrder,
    search: search || undefined,
  };
}

function buildWhereClause(params: BrandsQueryParams): Prisma.AdLibraryBrandWhereInput {
  const where: Prisma.AdLibraryBrandWhereInput = {};

  if (params.status) {
    where.ingestionStatus = params.status;
  }

  if (params.category) {
    where.category = params.category;
  }

  if (params.search) {
    where.OR = [
      { pageName: { contains: params.search, mode: 'insensitive' } },
      { pageId: { contains: params.search, mode: 'insensitive' } },
      { website: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

function serializeBrand(brand: {
  id: string;
  pageId: string;
  pageName: string;
  profilePicUrl: string | null;
  country: string | null;
  category: string | null;
  website: string | null;
  totalReach: bigint;
  activeAdCount: number;
  lastCheckedAt: Date | null;
  ingestionStatus: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}): SerializedBrand {
  return {
    ...brand,
    totalReach: brand.totalReach.toString(),
  };
}

// =============================================================================
// GET /api/ad-library/brands
// List all Ad Library brands with pagination, filtering, and sorting
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const params = parseQueryParams(req);
    const where = buildWhereClause(params);

    // Run count and query in parallel for performance
    const [total, brands] = await Promise.all([
      prisma.adLibraryBrand.count({ where }),
      prisma.adLibraryBrand.findMany({
        where,
        orderBy: { [params.sortBy]: params.sortOrder },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
    ]);

    const totalPages = Math.ceil(total / params.limit);

    const response: BrandsListResponse = {
      brands: brands.map(serializeBrand),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/ad-library/brands] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch brands' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/ad-library/brands
// Create a new Ad Library brand
// =============================================================================

interface CreateBrandBody {
  pageId: string;
  pageName: string;
  profilePicUrl?: string;
  country?: string;
  category?: string;
  website?: string;
  totalReach?: number;
  activeAdCount?: number;
  priority?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBrandBody;

    // Validate required fields
    if (!body.pageId || typeof body.pageId !== 'string') {
      return NextResponse.json(
        { error: 'pageId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!body.pageName || typeof body.pageName !== 'string') {
      return NextResponse.json(
        { error: 'pageName is required and must be a string' },
        { status: 400 }
      );
    }

    // Check for existing brand with same pageId
    const existing = await prisma.adLibraryBrand.findUnique({
      where: { pageId: body.pageId },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Brand with this pageId already exists', existingId: existing.id },
        { status: 409 }
      );
    }

    // Create the brand
    const brand = await prisma.adLibraryBrand.create({
      data: {
        pageId: body.pageId,
        pageName: body.pageName,
        profilePicUrl: body.profilePicUrl ?? null,
        country: body.country ?? null,
        category: body.category ?? null,
        website: body.website ?? null,
        totalReach: BigInt(body.totalReach ?? 0),
        activeAdCount: body.activeAdCount ?? 0,
        priority: body.priority ?? 0,
        ingestionStatus: 'pending',
      },
    });

    return NextResponse.json({ brand: serializeBrand(brand) }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/ad-library/brands] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create brand' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH /api/ad-library/brands
// Bulk update brands (e.g., change status or priority)
// =============================================================================

interface BulkUpdateBody {
  ids: string[];
  updates: {
    ingestionStatus?: IngestionStatus;
    priority?: number;
    category?: string;
  };
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as BulkUpdateBody;

    // Validate
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: 'ids must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!body.updates || typeof body.updates !== 'object') {
      return NextResponse.json(
        { error: 'updates object is required' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Prisma.AdLibraryBrandUpdateInput = {};

    if (body.updates.ingestionStatus !== undefined) {
      const validStatuses = ['pending', 'active', 'paused', 'failed'];
      if (!validStatuses.includes(body.updates.ingestionStatus)) {
        return NextResponse.json(
          { error: `ingestionStatus must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updateData.ingestionStatus = body.updates.ingestionStatus;
    }

    if (body.updates.priority !== undefined) {
      if (typeof body.updates.priority !== 'number') {
        return NextResponse.json(
          { error: 'priority must be a number' },
          { status: 400 }
        );
      }
      updateData.priority = body.updates.priority;
    }

    if (body.updates.category !== undefined) {
      updateData.category = body.updates.category;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    // Perform bulk update
    const result = await prisma.adLibraryBrand.updateMany({
      where: { id: { in: body.ids } },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      updated: result.count,
    });
  } catch (error) {
    console.error('[PATCH /api/ad-library/brands] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update brands' },
      { status: 500 }
    );
  }
}
