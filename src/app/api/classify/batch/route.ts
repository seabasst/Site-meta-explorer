import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { submitBatchClassification } from "@/lib/classification/classify-batch";

/**
 * POST /api/classify/batch
 * Start batch classification for a brand's unclassified ads.
 *
 * Body: { brandId: string }
 * Returns: { jobId, estimatedCost, unclassifiedAds, alreadyClassified }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandId } = body;

    if (!brandId || typeof brandId !== "string") {
      return NextResponse.json(
        { error: "brandId is required" },
        { status: 400 }
      );
    }

    // Check for existing active job (prevent duplicate submissions)
    const activeJob = await prisma.classificationJob.findFirst({
      where: { brandId, status: { in: ["queued", "processing"] } },
    });

    if (activeJob) {
      return NextResponse.json(
        {
          error: "Classification already in progress",
          jobId: activeJob.id,
        },
        { status: 409 }
      );
    }

    // Count unclassified vs already-classified ads
    const [unclassifiedCount, alreadyClassified] = await Promise.all([
      prisma.adLibraryAd.count({
        where: { brandId, classification: null },
      }),
      prisma.adLibraryAd.count({
        where: { brandId, classification: { isNot: null } },
      }),
    ]);

    if (unclassifiedCount === 0) {
      return NextResponse.json({
        message: "All ads already classified",
        total: alreadyClassified,
      });
    }

    // Estimate cost using Haiku batch pricing (50% discount)
    // Input: $0.50/M tokens, Output: $2.50/M tokens (batch pricing)
    // Estimate ~200 input tokens and ~500 output tokens per ad
    const estimatedCost = Number(
      (
        (unclassifiedCount * 200) / 1_000_000 * 0.50 +
        (unclassifiedCount * 500) / 1_000_000 * 2.50
      ).toFixed(4)
    );

    // Create the classification job
    const job = await prisma.classificationJob.create({
      data: {
        brandId,
        status: "queued",
        totalAds: unclassifiedCount + alreadyClassified,
        skippedAds: alreadyClassified,
        estimatedCostUsd: estimatedCost,
      },
    });

    // Fire-and-forget: submit batch to Anthropic
    // On failure, update job to failed with error message
    submitBatchClassification(job.id).catch(async (err) => {
      console.error(`Batch submission failed for job ${job.id}:`, err);
      await prisma.classificationJob.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMessage:
            err instanceof Error ? err.message : "Submission failed",
        },
      });
    });

    return NextResponse.json({
      jobId: job.id,
      estimatedCost,
      unclassifiedAds: unclassifiedCount,
      alreadyClassified,
    });
  } catch (error) {
    console.error("Batch classification error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
