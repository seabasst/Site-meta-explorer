import { NextRequest, NextResponse } from 'next/server';
import { sendDailyReport, sendWeeklyReport } from '@/lib/daily-report';

// =============================================================================
// GET /api/ad-library/cron/daily-report[?type=weekly]
//
// Manual/debug trigger for the ingestion Slack reports. Both reports now run
// inside the always-on Fly worker (scripts/ingest-worker.ts), so this is no
// longer scheduled in vercel.json — kept so a report can be fired on demand.
// Report logic lives in src/lib/daily-report.ts. Needs SLACK_WEBHOOK_URL.
// =============================================================================

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const weekly = req.nextUrl.searchParams.get('type') === 'weekly';
  const result = weekly ? await sendWeeklyReport() : await sendDailyReport();
  if (!result.posted) {
    return NextResponse.json({ error: result.reason }, { status: result.reason?.includes('not set') ? 503 : 502 });
  }
  return NextResponse.json({ posted: true, type: weekly ? 'weekly' : 'daily', ...result.report });
}
