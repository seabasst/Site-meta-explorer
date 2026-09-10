import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  submitBatchClassification,
  estimateBatchCostUsd,
} from "@/lib/classification/classify-batch";
import { planClassificationRun } from "@/lib/classification/plan-run";

// =============================================================================
// GET /api/ad-library/cron/classify-submit
//
// The missing half of the classification pipeline. classify-poll only harvests
// results from batches that already exist; nothing was creating those batches,
// so nothing had been classified since 2026-05-12. This submits them.
//
// Every run is bounded by a per-run ad cap AND a daily USD budget, because
// the backlog is ~1.6M ads and grows ~75k/day.
//
// Scheduled 02:00, two hours ahead of classify-poll at 04:00. The project is
// on a Vercel Hobby plan, which permits at most one invocation per day per
// cron (a more frequent expression fails the deployment), so a batch that
// takes longer than those two hours is harvested the following night.
// =============================================================================

export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Deliberately conservative: this spends money unattended, so the default is
// a floor to raise once the scope is decided, not a guess at the right rate.
// 2 000 ads/night is ~$2.70/night at the estimate in classify-batch.ts.
const MAX_ADS_PER_RUN = num(process.env.CLASSIFY_ADS_PER_RUN, 2_000);
const MAX_BRANDS_PER_RUN = num(process.env.CLASSIFY_BRANDS_PER_RUN, 5);
const DAILY_BUDGET_USD = num(process.env.CLASSIFY_DAILY_BUDGET_USD, 10);
// Don't pile new batches on top of a backlog the poller hasn't drained.
const MAX_ACTIVE_JOBS = num(process.env.CLASSIFY_MAX_ACTIVE_JOBS, 10);

export async function GET(req: NextRequest) {
  // Fail CLOSED, unlike the read-only crons which allow an unset secret.
  // This endpoint spends money, so an unauthenticated call must never run it.
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to submit paid batches" },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeJobs = await prisma.classificationJob.count({
      where: { status: { in: ["queued", "processing"] } },
    });
    if (activeJobs >= MAX_ACTIVE_JOBS) {
      return NextResponse.json({
        submitted: 0,
        skipReason: "poller-behind",
        activeJobs,
      });
    }

    // USD already committed by jobs created today. Actual spend is only logged
    // when a batch completes, so committed estimates are what bounds ordering.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const committed = await prisma.classificationJob.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { estimatedCostUsd: true },
    });
    const committedUsdToday = committed._sum.estimatedCostUsd ?? 0;

    // Brands with unclassified ads and no job in flight, biggest backlog first.
    const rows = await prisma.$queryRaw<
      Array<{ brandId: string; unclassified: bigint }>
    >`
      SELECT a."brandId" AS "brandId", COUNT(*) AS unclassified
      FROM "AdLibraryAd" a
      WHERE NOT EXISTS (SELECT 1 FROM "AdClassification" c WHERE c."adId" = a.id)
        AND NOT EXISTS (
          SELECT 1 FROM "ClassificationJob" j
          WHERE j."brandId" = a."brandId" AND j.status IN ('queued', 'processing')
        )
      GROUP BY a."brandId"
      ORDER BY COUNT(*) DESC
      LIMIT ${MAX_BRANDS_PER_RUN}
    `;

    const plan = planClassificationRun({
      candidates: rows.map((r) => ({
        brandId: r.brandId,
        unclassified: Number(r.unclassified),
      })),
      committedUsdToday,
      budgetUsd: DAILY_BUDGET_USD,
      maxAdsPerRun: MAX_ADS_PER_RUN,
      maxBrandsPerRun: MAX_BRANDS_PER_RUN,
    });

    if (plan.brands.length === 0) {
      return NextResponse.json({
        submitted: 0,
        skipReason: plan.skipReason,
        committedUsdToday: Number(committedUsdToday.toFixed(4)),
        budgetUsd: DAILY_BUDGET_USD,
      });
    }

    // Submit each brand independently — one failure must not block the rest.
    const results = [];
    for (const b of plan.brands) {
      const job = await prisma.classificationJob.create({
        data: {
          brandId: b.brandId,
          status: "queued",
          totalAds: b.take,
          estimatedCostUsd: b.estimatedUsd,
        },
      });
      try {
        const batchId = await submitBatchClassification(job.id, b.take);
        results.push({ brandId: b.brandId, jobId: job.id, ads: b.take, batchId });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submission failed";
        await prisma.classificationJob.update({
          where: { id: job.id },
          data: { status: "failed", errorMessage: message },
        });
        console.error(`classify-submit: brand ${b.brandId} failed:`, err);
        results.push({ brandId: b.brandId, jobId: job.id, error: message });
      }
    }

    const submitted = results.filter((r) => !("error" in r)).length;
    return NextResponse.json({
      submitted,
      failed: results.length - submitted,
      ads: plan.totalAds,
      estimatedUsd: estimateBatchCostUsd(plan.totalAds),
      committedUsdToday: Number(committedUsdToday.toFixed(4)),
      budgetUsd: DAILY_BUDGET_USD,
      results,
    });
  } catch (error) {
    console.error("classify-submit cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Submission failed" },
      { status: 500 }
    );
  }
}
