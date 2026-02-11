import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { batchFetchPages } from '@/lib/batch-fetch';
import { Prisma } from '@prisma/client';

/**
 * POST /api/benchmarks - Create a new benchmark report
 *
 * Body: { name: string, urls: string[], baselineIndex: number }
 * - urls: 2-6 Facebook Ad Library URLs
 * - baselineIndex: Which URL is the baseline (0-indexed)
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, urls, baselineIndex } = body as {
      name: string;
      urls: string[];
      baselineIndex: number;
    };

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(urls) || urls.length < 2 || urls.length > 6) {
      return NextResponse.json(
        { error: 'Must provide 2-6 Ad Library URLs' },
        { status: 400 }
      );
    }

    if (typeof baselineIndex !== 'number' || baselineIndex < 0 || baselineIndex >= urls.length) {
      return NextResponse.json(
        { error: 'Invalid baselineIndex' },
        { status: 400 }
      );
    }

    // Fetch all pages with rate limiting
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Facebook API not configured' },
        { status: 500 }
      );
    }

    const results = await batchFetchPages(urls, accessToken);

  // Check if baseline succeeded
  const baselineUrl = urls[baselineIndex];
  const baselineResult = results.find(r => r.url === baselineUrl);
  if (!baselineResult?.success) {
    return NextResponse.json(
      { error: 'Baseline brand failed to fetch', details: baselineResult?.error },
      { status: 400 }
    );
  }

  // Filter to successful results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length < 2) {
    return NextResponse.json(
      { error: 'Need at least 2 brands (1 baseline + 1 competitor)', failed },
      { status: 400 }
    );
  }

  // Create benchmark report with brands in a transaction
  const report = await prisma.$transaction(async (tx) => {
    const newReport = await tx.benchmarkReport.create({
      data: {
        name: name.trim(),
        userId: session.user!.id!,
      },
    });

    await tx.benchmarkBrand.createMany({
      data: successful.map(r => ({
        facebookPageId: r.pageId,
        pageName: r.pageName,
        adLibraryUrl: r.url,
        isBaseline: r.url === baselineUrl,
        benchmarkId: newReport.id,
        // Snapshot metrics
        totalAdsFound: r.snapshot?.totalAdsFound ?? null,
        activeAdsCount: r.snapshot?.activeAdsCount ?? null,
        totalReach: r.snapshot?.totalReach ?? null,
        avgReachPerAd: r.snapshot?.avgReachPerAd ?? null,
        estimatedSpendUsd: r.snapshot?.estimatedSpendUsd ?? null,
        videoPercentage: r.snapshot?.videoPercentage ?? null,
        imagePercentage: r.snapshot?.imagePercentage ?? null,
        carouselPercentage: r.snapshot?.carouselPercentage ?? null,
        dominantGender: r.snapshot?.dominantGender ?? null,
        dominantAgeRange: r.snapshot?.dominantAgeRange ?? null,
        demographicsJson: r.snapshot?.demographicsJson ?? Prisma.JsonNull,
      })),
    });

    // Fetch brands to return
    const brands = await tx.benchmarkBrand.findMany({
      where: { benchmarkId: newReport.id },
    });

    return { ...newReport, brands };
  });

  // Serialize response (convert BigInt to string)
  const serializedBrands = report.brands.map(b => ({
    ...b,
    totalReach: b.totalReach?.toString() ?? null,
  }));

  return NextResponse.json({
    report: {
      id: report.id,
      name: report.name,
      createdAt: report.createdAt,
      brands: serializedBrands,
    },
    failed: failed.map(f => ({ url: f.url, error: f.error })),
  });
  } catch (error) {
    console.error('Benchmark creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create benchmark' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/benchmarks - List user's benchmark reports
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reports = await prisma.benchmarkReport.findMany({
    where: { userId: session.user.id },
    include: { brands: true },
    orderBy: { createdAt: 'desc' },
  });

  // Serialize BigInt fields
  const serializedReports = reports.map(report => ({
    ...report,
    brands: report.brands.map(b => ({
      ...b,
      totalReach: b.totalReach?.toString() ?? null,
    })),
  }));

  return NextResponse.json({ reports: serializedReports });
}
