import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isR2Configured } from '@/lib/r2';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Overall stats
    const [completed, pending, failed, downloading] = await Promise.all([
      prisma.adAsset.count({ where: { downloadStatus: 'completed' } }),
      prisma.adAsset.count({ where: { downloadStatus: 'pending' } }),
      prisma.adAsset.count({ where: { downloadStatus: 'failed' } }),
      prisma.adAsset.count({ where: { downloadStatus: 'downloading' } }),
    ]);

    const total = completed + pending + failed + downloading;

    // Storage size
    const storage = await prisma.adAsset.aggregate({
      where: { downloadStatus: 'completed' },
      _sum: { fileSizeBytes: true },
    });

    // Completed by type
    const byType = await prisma.adAsset.groupBy({
      by: ['assetType'],
      where: { downloadStatus: 'completed' },
      _count: true,
      _sum: { fileSizeBytes: true },
    });

    // Per-brand breakdown
    const brandsRaw = await prisma.$queryRaw<
      {
        brandId: string;
        pageName: string;
        completed: bigint;
        pending: bigint;
        failed: bigint;
        images: bigint;
        videos: bigint;
        sizeMB: number | null;
      }[]
    >`
      SELECT
        b.id AS "brandId",
        b."pageName",
        COUNT(*) FILTER (WHERE a."downloadStatus" = 'completed') AS completed,
        COUNT(*) FILTER (WHERE a."downloadStatus" = 'pending') AS pending,
        COUNT(*) FILTER (WHERE a."downloadStatus" = 'failed') AS failed,
        COUNT(*) FILTER (WHERE a."downloadStatus" = 'completed' AND a."assetType" = 'image') AS images,
        COUNT(*) FILTER (WHERE a."downloadStatus" = 'completed' AND a."assetType" = 'video') AS videos,
        ROUND(COALESCE(SUM(a."fileSizeBytes") FILTER (WHERE a."downloadStatus" = 'completed'), 0) / 1048576.0, 1) AS "sizeMB"
      FROM "AdAsset" a
      JOIN "AdLibraryAd" ad ON a."adId" = ad.id
      JOIN "AdLibraryBrand" b ON ad."brandId" = b.id
      GROUP BY b.id, b."pageName"
      ORDER BY completed DESC
    `;

    const brands = brandsRaw.map((b) => ({
      brandId: b.brandId,
      pageName: b.pageName,
      completed: Number(b.completed),
      pending: Number(b.pending),
      failed: Number(b.failed),
      images: Number(b.images),
      videos: Number(b.videos),
      sizeMB: Number(b.sizeMB || 0),
    }));

    return NextResponse.json({
      r2Configured: isR2Configured(),
      overview: {
        total,
        completed,
        pending,
        failed,
        downloading,
        pct: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
        storageMB: Math.round((storage._sum.fileSizeBytes || 0) / 1048576),
      },
      byType: byType.map((t) => ({
        type: t.assetType,
        count: t._count,
        sizeMB: Math.round((t._sum.fileSizeBytes || 0) / 1048576),
      })),
      brands,
    });
  } catch (error) {
    console.error('Asset stats error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
