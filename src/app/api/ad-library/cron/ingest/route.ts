import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  tokenManager,
  processBrand,
  sleep,
  BRANDS_PER_RUN,
  CRON_SECRET,
  isNumericPageId,
} from '@/lib/ingestion/ingest-core';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!tokenManager.hasTokens()) {
    return NextResponse.json({ error: 'No Facebook access tokens configured (set FACEBOOK_ACCESS_TOKENS or FACEBOOK_ACCESS_TOKEN)' }, { status: 500 });
  }

  try {
    // Brands to process each run:
    //   (a) never fully ingested yet  → ingestionStatus in ('pending','failed')
    //   (b) active brands whose WEEKLY re-check is due → catches newly-launched
    //       ads on brands we already track. Without this, 'active' brands are
    //       never revisited and the pipeline goes dormant after the backfill.
    // Overdue accounts (oldest / never-checked lastCheckedAt) are queued first.
    const REFRESH_AFTER_DAYS = 7;
    const staleBefore = new Date(Date.now() - REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000);

    const brands = await prisma.adLibraryBrand.findMany({
      where: {
        failCount: { lt: 3 }, // Skip brands that failed too many times
        OR: [
          { ingestionStatus: { in: ['pending', 'failed'] } },
          { ingestionStatus: 'active', lastCheckedAt: null },
          { ingestionStatus: 'active', lastCheckedAt: { lt: staleBefore } },
        ],
      },
      orderBy: [
        { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
        { priority: 'desc' },
      ],
      take: BRANDS_PER_RUN,
    });

    if (brands.length === 0) {
      return NextResponse.json({
        message: 'No brands due for ingestion or weekly refresh',
        processed: 0,
        tokenStatus: tokenManager.getStatusSummary(),
      });
    }

    console.log(`Cron: Processing ${brands.length} brands (using ${tokenManager.getTotalTokens()} token(s))`);

    const results = [];
    for (const brand of brands) {
      const result = await processBrand(brand.id, brand.pageId, brand.pageName);
      results.push(result);

      // Wait between brands to avoid rate limits
      if (brands.indexOf(brand) < brands.length - 1) {
        await sleep(15000); // 15 second pause between brands
      }
    }

    return NextResponse.json({
      message: `Processed ${brands.length} brands`,
      tokenStatus: tokenManager.getStatusSummary(),
      results,
    });
  } catch (error) {
    console.error('Cron ingestion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingestion failed' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ad-library/cron/ingest
 * Manual trigger for ingestion
 *
 * Body options:
 * - { brandIds: string[] } - Process specific brands by ID
 * - { dcongressOnly: true } - Process only D-Congress brands (priority=100)
 * - { limit: number } - Override the number of brands to process (max 20)
 * - { checkStatus: true } - Just check token status without processing
 * - { resetTokens: true } - Reset all token states (use after updating tokens)
 * - {} - Process next pending brands (same as cron)
 */
export async function POST(req: NextRequest) {
  if (!tokenManager.hasTokens()) {
    return NextResponse.json(
      { error: 'No Facebook access tokens configured' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { brandIds, dcongressOnly, limit: requestedLimit, checkStatus, resetTokens, numericIdsOnly } = body as {
      brandIds?: string[];
      dcongressOnly?: boolean;
      limit?: number;
      checkStatus?: boolean;
      resetTokens?: boolean;
      numericIdsOnly?: boolean;
    };

    // Just check token status
    if (checkStatus) {
      return NextResponse.json({
        message: 'Token status check',
        tokenStatus: tokenManager.getStatusSummary(),
      });
    }

    // Reset token states (useful after updating tokens in .env)
    if (resetTokens) {
      tokenManager.resetStates();
      return NextResponse.json({
        message: 'Token states reset successfully',
        tokenStatus: tokenManager.getStatusSummary(),
      });
    }

    const limit = Math.min(requestedLimit || BRANDS_PER_RUN, 20); // Cap at 20

    let brands;

    if (brandIds && brandIds.length > 0) {
      // Process specific brands
      brands = await prisma.adLibraryBrand.findMany({
        where: { id: { in: brandIds } },
        take: limit,
      });
    } else if (dcongressOnly) {
      // Process D-Congress brands only (priority=100)
      brands = await prisma.adLibraryBrand.findMany({
        where: {
          priority: 100,
          OR: [
            { ingestionStatus: { in: ['pending', 'failed'] } },
            { activeAdCount: 0 }, // Also re-process brands with no ads
          ],
          failCount: { lt: 3 },
        },
        orderBy: { priority: 'desc' },
        take: limit,
      });
    } else {
      // Default: process next pending brands
      brands = await prisma.adLibraryBrand.findMany({
        where: {
          ingestionStatus: { in: ['pending', 'failed'] },
          failCount: { lt: 3 },
        },
        orderBy: { priority: 'desc' },
        take: limit,
      });
    }

    // Filter to only numeric pageIds if requested (skip brands that would use search_terms)
    if (numericIdsOnly) {
      const beforeCount = brands.length;
      brands = brands.filter(b => isNumericPageId(b.pageId));
      if (beforeCount !== brands.length) {
        console.log(`Filtered to ${brands.length} brands with numeric pageIds (skipped ${beforeCount - brands.length} non-numeric)`);
      }
    }

    if (brands.length === 0) {
      return NextResponse.json({
        message: 'No brands to process',
        processed: 0,
        tokenStatus: tokenManager.getStatusSummary(),
      });
    }

    console.log(`Manual trigger: Processing ${brands.length} brands (using ${tokenManager.getTotalTokens()} token(s))`);

    const results = [];
    for (const brand of brands) {
      // Reset status to pending if we're re-processing
      if (brand.ingestionStatus === 'active' && brand.activeAdCount === 0) {
        await prisma.adLibraryBrand.update({
          where: { id: brand.id },
          data: { ingestionStatus: 'pending' },
        });
      }

      const result = await processBrand(brand.id, brand.pageId, brand.pageName);
      results.push(result);

      // Wait between brands to avoid rate limits
      if (brands.indexOf(brand) < brands.length - 1) {
        await sleep(15000); // 15 second pause for manual triggers (faster than cron)
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      message: `Processed ${brands.length} brands (${successful} successful, ${failed} failed)`,
      tokenStatus: tokenManager.getStatusSummary(),
      results,
    });
  } catch (error) {
    console.error('Manual ingestion error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ingestion failed' },
      { status: 500 }
    );
  }
}
