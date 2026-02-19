import { NextRequest, NextResponse } from 'next/server';
import {
  processPendingAssets,
  retryFailedAssets,
  getAssetStats,
} from '@/lib/asset-pipeline';
import { isR2Configured } from '@/lib/r2';

/**
 * GET /api/ad-library/assets
 * Get asset processing statistics.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const brandId = searchParams.get('brandId') || undefined;

  try {
    const stats = await getAssetStats(brandId);

    return NextResponse.json({
      r2Configured: isR2Configured(),
      stats,
    });
  } catch (error) {
    console.error('Failed to get asset stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ad-library/assets
 * Process pending assets (manual trigger).
 *
 * Body: { action: 'process' | 'retry', limit?: number, brandId?: string }
 */
export async function POST(req: NextRequest) {
  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error: 'R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL.',
      },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { action = 'process', limit = 50, brandId } = body;

    let result;
    if (action === 'retry') {
      result = await retryFailedAssets(limit);
    } else {
      result = await processPendingAssets(limit, brandId);
    }

    return NextResponse.json({
      success: true,
      action,
      ...result,
    });
  } catch (error) {
    console.error('Failed to process assets:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Processing failed' },
      { status: 500 }
    );
  }
}
