import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// =============================================================================
// Types
// =============================================================================

type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface JobsQueryParams {
  page: number;
  limit: number;
  status?: JobStatus;
  brandId?: string;
}

interface SerializedJob {
  id: string;
  brandId: string;
  brandName: string;
  brandPageId: string;
  jobType: string;
  status: string;
  adsFetched: number;
  adsCreated: number;
  adsUpdated: number;
  assetsQueued: number;
  assetsDownloaded: number;
  assetsFailed: number;
  errorMessage: string | null;
  errorsJson: unknown;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

interface JobsListResponse {
  jobs: SerializedJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
  };
}

// =============================================================================
// Helpers
// =============================================================================

function parseQueryParams(req: NextRequest): JobsQueryParams {
  const { searchParams } = new URL(req.url);

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

  const status = searchParams.get('status') as JobStatus | null;
  const brandId = searchParams.get('brandId');

  return {
    page,
    limit,
    status: status && ['queued', 'running', 'completed', 'failed'].includes(status) ? status : undefined,
    brandId: brandId || undefined,
  };
}

function buildWhereClause(params: JobsQueryParams): Prisma.IngestionJobWhereInput {
  const where: Prisma.IngestionJobWhereInput = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.brandId) {
    where.brandId = params.brandId;
  }

  return where;
}

// =============================================================================
// GET /api/ad-library/jobs
// List all ingestion jobs with pagination and filtering
// =============================================================================

// =============================================================================
// POST /api/ad-library/jobs
// Perform actions on jobs (cleanup stale, etc.)
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const { action } = body;

    if (action === 'cleanup-stale') {
      const result = await prisma.ingestionJob.updateMany({
        where: { status: 'running' },
        data: {
          status: 'failed',
          errorMessage: 'Job terminated - stale running state',
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${result.count} stale jobs`,
        count: result.count,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[POST /api/ad-library/jobs] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to perform action' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/ad-library/jobs
// List all ingestion jobs with pagination and filtering
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const params = parseQueryParams(req);
    const where = buildWhereClause(params);

    // Run queries in parallel
    const [total, jobs, stats] = await Promise.all([
      prisma.ingestionJob.count({ where }),
      prisma.ingestionJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          brand: {
            select: {
              pageName: true,
              pageId: true,
            },
          },
        },
      }),
      // Get status counts
      prisma.ingestionJob.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const totalPages = Math.ceil(total / params.limit);

    // Process stats
    const statusCounts = stats.reduce(
      (acc, item) => {
        acc[item.status as JobStatus] = item._count.status;
        return acc;
      },
      { completed: 0, failed: 0, running: 0, queued: 0 } as Record<JobStatus, number>
    );

    const response: JobsListResponse = {
      jobs: jobs.map((job) => ({
        id: job.id,
        brandId: job.brandId,
        brandName: job.brand.pageName,
        brandPageId: job.brand.pageId,
        jobType: job.jobType,
        status: job.status,
        adsFetched: job.adsFetched,
        adsCreated: job.adsCreated,
        adsUpdated: job.adsUpdated,
        assetsQueued: job.assetsQueued,
        assetsDownloaded: job.assetsDownloaded,
        assetsFailed: job.assetsFailed,
        errorMessage: job.errorMessage,
        errorsJson: job.errorsJson,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      })),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1,
      },
      stats: {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        ...statusCounts,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/ad-library/jobs] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
