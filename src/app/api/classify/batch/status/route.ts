import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/classify/batch/status?jobId=<id>
 * Check the status and progress of a classification batch job.
 *
 * Returns: { job, progress, isComplete }
 */
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json(
      { error: "jobId query parameter is required" },
      { status: 400 }
    );
  }

  const job = await prisma.classificationJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }

  const progress =
    job.totalAds > 0
      ? (job.classifiedAds + job.failedAds + job.skippedAds) / job.totalAds
      : 0;

  const isComplete = job.status === "completed" || job.status === "failed";

  return NextResponse.json({ job, progress, isComplete });
}
