import { NextRequest, NextResponse } from 'next/server';
import { processPendingAssets, getAssetStats } from '@/lib/asset-pipeline';
import { isR2Configured } from '@/lib/r2';

const CRON_SECRET = process.env.CRON_SECRET;
const ASSETS_PER_RUN = 100; // Process 100 assets per cron run

/**
 * GET /api/ad-library/cron/assets
 * Cron job to process pending ad assets.
 * Called by Vercel Cron on schedule.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({
      message: 'R2 not configured, skipping asset processing',
      r2Configured: false,
    });
  }

  try {
    // Get current stats
    const statsBefore = await getAssetStats();

    if (statsBefore.pending === 0) {
      return NextResponse.json({
        message: 'No pending assets to process',
        stats: statsBefore,
      });
    }

    console.log(`Asset cron: Processing up to ${ASSETS_PER_RUN} assets (${statsBefore.pending} pending)`);

    // Process assets
    const result = await processPendingAssets(ASSETS_PER_RUN);

    // Get updated stats
    const statsAfter = await getAssetStats();

    return NextResponse.json({
      message: `Processed ${result.processed} assets`,
      succeeded: result.succeeded,
      failed: result.failed,
      stats: statsAfter,
    });
  } catch (error) {
    console.error('Asset cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}
