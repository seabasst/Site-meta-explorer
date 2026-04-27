import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processBatchResults } from "@/lib/classification/classify-batch";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/ad-library/cron/classify-poll
 * Cron job that polls active batch classification jobs and processes completed results.
 * Runs every 5 minutes via Vercel Cron.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret — fail-closed. Missing CRON_SECRET = 401, never bypass.
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all active batch jobs with an Anthropic batch ID
    const activeJobs = await prisma.classificationJob.findMany({
      where: {
        status: "processing",
        anthropicBatchId: { not: null },
      },
    });

    if (activeJobs.length === 0) {
      return NextResponse.json({
        message: "No active batch jobs",
        processed: 0,
      });
    }

    console.log(
      `Classify-poll cron: Processing ${activeJobs.length} active batch job(s)`
    );

    // Process each job independently (failure in one should not block others)
    const results: Array<{
      jobId: string;
      status: string;
      error?: string;
    }> = [];

    for (const job of activeJobs) {
      try {
        const result = await processBatchResults(job.id);
        results.push({ jobId: job.id, status: result.status });
      } catch (err) {
        console.error(`Failed to process batch job ${job.id}:`, err);

        // Mark the job as failed
        await prisma.classificationJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            errorMessage:
              err instanceof Error ? err.message : "Processing failed",
          },
        });

        results.push({
          jobId: job.id,
          status: "error",
          error: err instanceof Error ? err.message : "Processing failed",
        });
      }
    }

    return NextResponse.json({
      processed: activeJobs.length,
      results,
    });
  } catch (error) {
    console.error("Classify-poll cron error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Polling failed",
      },
      { status: 500 }
    );
  }
}
