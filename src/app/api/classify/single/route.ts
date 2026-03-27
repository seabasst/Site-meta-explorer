// =============================================================================
// POST /api/classify/single — On-demand single ad classification
// =============================================================================
// Checks cache, fetches ad data, classifies via Claude Haiku 4.5,
// persists to AdClassification, and logs cost via after().

import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifySingleAd } from "@/lib/classification/classify-single";
import { logApiCost } from "@/lib/classification/cost-tracker";

export async function POST(request: Request) {
  try {
    // 1. Parse request body
    const body = await request.json();
    const { adId } = body;

    if (!adId || typeof adId !== "string") {
      return NextResponse.json(
        { error: "adId is required" },
        { status: 400 }
      );
    }

    // 2. Cache check — return existing classification if available
    const existing = await prisma.adClassification.findUnique({
      where: { adId },
    });

    if (existing) {
      return NextResponse.json({ classification: existing, cached: true });
    }

    // 3. Fetch ad with brand and first image asset
    const ad = await prisma.adLibraryAd.findUnique({
      where: { id: adId },
      include: {
        brand: { select: { pageName: true, category: true } },
        assets: {
          where: { assetType: "image", downloadStatus: "completed" },
          take: 1,
          select: { storedUrl: true },
        },
      },
    });

    if (!ad) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }

    // 4. Classify the ad
    const { classification, usage } = await classifySingleAd({
      adId: ad.id,
      brandName: ad.brand?.pageName ?? undefined,
      category: ad.brand?.category ?? undefined,
      body: ad.body ?? undefined,
      title: ad.title ?? undefined,
      ctaText: ad.ctaText ?? undefined,
      displayFormat: ad.displayFormat ?? undefined,
      imageUrl: ad.assets[0]?.storedUrl ?? undefined,
    });

    // 5. Persist classification
    const saved = await prisma.adClassification.create({
      data: {
        adId: ad.id,
        ...classification,
        classifiedBy: "haiku-4.5",
        classificationSource: ad.assets[0]?.storedUrl ? "vision" : "text",
        schemaVersion: 1,
      },
    });

    // 6. Fire-and-forget cost logging via after()
    after(() => {
      logApiCost({
        model: "claude-haiku-4-5-20251001",
        operation: "classify-single",
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        brandId: ad.brandId,
      });
    });

    // 7. Return classification result
    return NextResponse.json({ classification: saved, cached: false });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error";
    console.error("Classification failed:", message);
    return NextResponse.json(
      { error: "Classification failed", details: message },
      { status: 500 }
    );
  }
}
