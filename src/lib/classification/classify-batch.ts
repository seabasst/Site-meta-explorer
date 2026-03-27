// =============================================================================
// Batch Classification Pipeline
// =============================================================================
// Submits unclassified ads to the Anthropic Message Batches API and processes
// completed results into AdClassification rows. Used by the batch API route
// (submit) and the cron polling route (process results).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import { prisma } from "@/lib/prisma";
import { ClassificationOutputSchema } from "./schemas";
import { buildClassificationPrompt, buildAdContext } from "./prompt";
import { logApiCost } from "./cost-tracker";

const client = new Anthropic();

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 500;
const MAX_BATCH_SIZE = 10_000;

// ---------------------------------------------------------------------------
// Submit a batch of unclassified ads to the Anthropic Batch API
// ---------------------------------------------------------------------------
export async function submitBatchClassification(
  jobId: string
): Promise<string> {
  const job = await prisma.classificationJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { brand: true },
  });

  // Find unclassified ads for this brand
  const ads = await prisma.adLibraryAd.findMany({
    where: { brandId: job.brandId, classification: null },
    include: {
      assets: {
        where: { assetType: "image", downloadStatus: "completed" },
        take: 1,
        select: { storedUrl: true },
      },
    },
  });

  // If no unclassified ads, mark job as completed
  if (ads.length === 0) {
    await prisma.classificationJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        skippedAds: job.totalAds,
        classifiedAds: 0,
        failedAds: 0,
      },
    });
    return "";
  }

  // Truncate to MAX_BATCH_SIZE if needed
  const adsToProcess = ads.slice(0, MAX_BATCH_SIZE);
  if (ads.length > MAX_BATCH_SIZE) {
    console.warn(
      `Brand ${job.brand.pageName} has ${ads.length} unclassified ads, truncating to ${MAX_BATCH_SIZE}`
    );
  }

  // Build the system prompt and output format (shared across all requests)
  const systemPrompt = buildClassificationPrompt();
  const outputFormat = zodOutputFormat(ClassificationOutputSchema);

  // Map ads to batch requests
  const requests: Array<{
    custom_id: string;
    params: MessageCreateParamsNonStreaming;
  }> = adsToProcess.map((ad) => {
    const imageUrl = ad.assets[0]?.storedUrl;
    const textContext = buildAdContext({
      brandName: job.brand.pageName,
      category: job.brand.category ?? undefined,
      body: ad.body ?? undefined,
      title: ad.title ?? undefined,
      ctaText: ad.ctaText ?? undefined,
      displayFormat: ad.displayFormat ?? undefined,
    });

    // Build user message content: optional image + text
    const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    if (imageUrl) {
      content.push({
        type: "image" as const,
        source: { type: "url" as const, url: imageUrl },
      });
    }

    content.push({ type: "text" as const, text: textContext });

    return {
      custom_id: ad.id,
      params: {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user" as const, content }],
        output_config: {
          format: outputFormat as {
            type: "json_schema";
            schema: Record<string, unknown>;
          },
        },
      },
    };
  });

  // Submit the batch
  const batch = await client.messages.batches.create({ requests });

  // Update the job with batch info
  await prisma.classificationJob.update({
    where: { id: jobId },
    data: {
      status: "processing",
      anthropicBatchId: batch.id,
      batchSubmittedAt: new Date(),
      totalAds: adsToProcess.length + job.skippedAds,
      skippedAds: job.skippedAds,
    },
  });

  return batch.id;
}

// ---------------------------------------------------------------------------
// Process completed batch results into AdClassification rows
// ---------------------------------------------------------------------------
export async function processBatchResults(
  jobId: string
): Promise<{ status: string; classified?: number; failed?: number }> {
  const job = await prisma.classificationJob.findUniqueOrThrow({
    where: { id: jobId },
  });

  if (!job.anthropicBatchId || job.status !== "processing") {
    throw new Error(
      `Job ${jobId} is not in a processable state (status: ${job.status}, batchId: ${job.anthropicBatchId})`
    );
  }

  // Check batch status
  const batch = await client.messages.batches.retrieve(job.anthropicBatchId);

  if (batch.processing_status !== "ended") {
    // Update progress counts from batch
    await prisma.classificationJob.update({
      where: { id: jobId },
      data: {
        classifiedAds: batch.request_counts.succeeded,
        failedAds:
          batch.request_counts.errored +
          batch.request_counts.expired +
          batch.request_counts.canceled,
      },
    });
    return { status: "in_progress" };
  }

  // Batch ended -- stream and process results
  const results = await client.messages.batches.results(job.anthropicBatchId);

  // Collect all ad IDs from results first, then bulk-query for image assets
  const resultEntries: Array<{
    custom_id: string;
    result: Anthropic.Messages.Batches.MessageBatchResult;
  }> = [];
  for await (const entry of results) {
    resultEntries.push(entry);
  }

  // Build a Set of ad IDs that have image assets (for classificationSource)
  const adIds = resultEntries.map((e) => e.custom_id);
  const adsWithImages = await prisma.adAsset.findMany({
    where: {
      adId: { in: adIds },
      assetType: "image",
      downloadStatus: "completed",
    },
    select: { adId: true },
  });
  const imageAdIds = new Set(adsWithImages.map((a) => a.adId));

  // Process each result
  const classifications: Array<{
    adId: string;
    assetType: string;
    visualFormat: string;
    hookTactic: string;
    messagingAngle: string;
    awarenessStage: string;
    creativeMechanic: string;
    offerType: string;
    intendedAudience: string;
    hookScore: number;
    conceptCluster: string;
    confidence: number;
    classifiedBy: string;
    classificationSource: string;
    schemaVersion: number;
  }> = [];
  let failedCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const entry of resultEntries) {
    if (entry.result.type === "succeeded") {
      try {
        // Extract text content from the message
        const message = entry.result.message;
        const textBlock = message.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          failedCount++;
          continue;
        }

        const parsed = ClassificationOutputSchema.parse(
          JSON.parse(textBlock.text)
        );

        classifications.push({
          adId: entry.custom_id,
          ...parsed,
          classifiedBy: "haiku-4.5",
          classificationSource: imageAdIds.has(entry.custom_id)
            ? "vision"
            : "text",
          schemaVersion: 1,
        });

        // Track tokens
        totalInputTokens += message.usage.input_tokens;
        totalOutputTokens += message.usage.output_tokens;
      } catch (err) {
        console.error(
          `Failed to parse classification for ad ${entry.custom_id}:`,
          err
        );
        failedCount++;
      }
    } else {
      // errored, expired, or canceled
      failedCount++;
    }
  }

  // Bulk insert classifications (skipDuplicates prevents errors if cron runs twice)
  if (classifications.length > 0) {
    await prisma.adClassification.createMany({
      data: classifications,
      skipDuplicates: true,
    });
  }

  // Update job as completed
  await prisma.classificationJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      classifiedAds: classifications.length,
      failedAds: failedCount,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      batchCompletedAt: new Date(),
    },
  });

  // Fire-and-forget cost logging
  logApiCost({
    model: MODEL,
    operation: "classify-batch",
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    brandId: job.brandId,
  }).catch(() => {});

  return {
    status: "completed",
    classified: classifications.length,
    failed: failedCount,
  };
}
