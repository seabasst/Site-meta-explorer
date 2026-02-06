import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/benchmarks/[id] - Get a single benchmark report
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const report = await prisma.benchmarkReport.findUnique({
    where: { id },
    include: { brands: true },
  });

  if (!report) {
    return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 });
  }

  // Verify ownership
  if (report.userId !== session.user.id) {
    return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 });
  }

  // Serialize BigInt fields
  const serializedBrands = report.brands.map(b => ({
    ...b,
    totalReach: b.totalReach?.toString() ?? null,
  }));

  return NextResponse.json({
    report: {
      id: report.id,
      name: report.name,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      brands: serializedBrands,
    },
  });
}
