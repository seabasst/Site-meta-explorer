import { NextRequest, NextResponse } from 'next/server';
import { sendDailyReport } from '@/lib/daily-report';

// =============================================================================
// GET /api/ad-library/cron/daily-report
//
// Manual/debug trigger for the daily ingestion Slack report. The report now
// runs inside the always-on Fly worker (scripts/ingest-worker.ts), so this is
// no longer scheduled in vercel.json — kept so the report can be fired on demand.
// Report logic lives in src/lib/daily-report.ts. Needs SLACK_WEBHOOK_URL.
// =============================================================================

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await sendDailyReport();
  if (!result.posted) {
    return NextResponse.json({ error: result.reason }, { status: result.reason?.includes('not set') ? 503 : 502 });
  }
  const { report } = result;
  return NextResponse.json({
    posted: true,
    totalAds: report?.totalAds,
    activeAds: report?.activeAds,
    new24hTotal: report?.new24hTotal,
    brandsWithNewAds: report?.brandsWithNewAds,
    topVelocity: report?.topVelocity ?? null,
  });
}
