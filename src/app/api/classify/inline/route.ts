import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { classifySingleAd } from '@/lib/classification/classify-single';
import { logApiCost } from '@/lib/classification/cost-tracker';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/classify/inline
 * Classify unclassified ads for a brand synchronously (direct API calls).
 * Much faster than the batch API for small sets — ideal for interactive analysis.
 *
 * Body: { brandId: string, limit?: number }
 * Returns: { classified: number, failed: number, alreadyClassified: number }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { brandId, limit = 30 } = await req.json();

    if (!brandId) {
      return NextResponse.json({ error: 'brandId is required' }, { status: 400 });
    }

    const brand = await prisma.adLibraryBrand.findUnique({
      where: { id: brandId },
      select: { id: true, pageName: true, category: true },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Find unclassified ads
    const ads = await prisma.adLibraryAd.findMany({
      where: { brandId, classification: null },
      select: {
        id: true,
        adId: true,
        body: true,
        title: true,
        ctaText: true,
        displayFormat: true,
        assets: {
          where: { assetType: 'image', downloadStatus: 'completed' },
          take: 1,
          select: { storedUrl: true },
        },
      },
      orderBy: { startDate: 'desc' },
      take: Math.min(limit, 50),
    });

    const alreadyClassified = await prisma.adClassification.count({
      where: { ad: { brandId } },
    });

    if (ads.length === 0) {
      return NextResponse.json({
        classified: 0,
        failed: 0,
        alreadyClassified,
        message: 'All ads already classified',
      });
    }

    // Classify in parallel batches of 5 to avoid rate limits
    let classified = 0;
    let failed = 0;
    let totalInput = 0;
    let totalOutput = 0;
    const batchSize = 5;

    for (let i = 0; i < ads.length; i += batchSize) {
      const batch = ads.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (ad) => {
          const result = await classifySingleAd({
            adId: ad.adId,
            brandName: brand.pageName,
            category: brand.category ?? undefined,
            body: ad.body ?? undefined,
            title: ad.title ?? undefined,
            ctaText: ad.ctaText ?? undefined,
            displayFormat: ad.displayFormat ?? undefined,
            imageUrl: ad.assets[0]?.storedUrl ?? undefined,
          });

          // Store classification
          await prisma.adClassification.create({
            data: {
              adId: ad.id,
              ...result.classification,
              classifiedBy: 'haiku-4.5',
              classificationSource: ad.assets[0]?.storedUrl ? 'vision' : 'text',
              schemaVersion: 1,
            },
          });

          return result.usage;
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          classified++;
          totalInput += r.value.input_tokens;
          totalOutput += r.value.output_tokens;
        } else {
          failed++;
          console.error('Inline classification failed:', r.reason);
        }
      }
    }

    // Log cost (fire-and-forget)
    logApiCost({
      model: 'claude-haiku-4-5-20251001',
      operation: 'classify-inline',
      inputTokens: totalInput,
      outputTokens: totalOutput,
      brandId,
    }).catch(() => {});

    return NextResponse.json({
      classified,
      failed,
      alreadyClassified: alreadyClassified + classified,
      total: ads.length,
    });
  } catch (error) {
    console.error('Inline classification error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Classification failed' },
      { status: 500 }
    );
  }
}
