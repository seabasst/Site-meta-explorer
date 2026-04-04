// =============================================================================
// POST /api/brand-profiles/[id]/enrich
// =============================================================================
// Orchestrates auto-enrichment of a brand profile from ad library data.
// Pipeline: auth -> validate source -> budget check -> enrichFromAds ->
//           change detection -> selective merge -> persist -> log cost.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { enrichFromAds } from "@/lib/enrichment/enrich-from-ads";
import { getDailySpend, logApiCost } from "@/lib/classification/cost-tracker";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const enrichSchema = z.object({
  sourcePageId: z.string().min(1, "sourcePageId is required"),
  forceOverwrite: z.boolean().optional().default(false),
});

// ---------------------------------------------------------------------------
// Include clause (same as [id]/route.ts)
// ---------------------------------------------------------------------------

const profileInclude = {
  competitors: {
    include: {
      adLibraryBrand: {
        select: {
          id: true,
          pageId: true,
          pageName: true,
          profilePicUrl: true,
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENRICHMENT_DAILY_BUDGET = 2.0; // $2/day cap

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // 1. Auth check
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify ownership
    const existing = await prisma.brandProfile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = enrichSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sourcePageId, forceOverwrite } = parsed.data;

    // 3. Validate source brand exists and has enough data
    const sourceBrand = await prisma.adLibraryBrand.findUnique({
      where: { id: sourcePageId },
      select: { id: true, pageName: true },
    });

    if (!sourceBrand) {
      return NextResponse.json(
        { error: "Source brand not found" },
        { status: 404 }
      );
    }

    const classifiedCount = await prisma.adClassification.count({
      where: { ad: { brandId: sourcePageId, isActive: true } },
    });

    if (classifiedCount < 3) {
      return NextResponse.json(
        {
          error: `Not enough classified ads (need at least 3, found ${classifiedCount})`,
        },
        { status: 400 }
      );
    }

    // 4. Cost budget check
    const dailySpend = await getDailySpend();
    if (dailySpend >= ENRICHMENT_DAILY_BUDGET) {
      return NextResponse.json(
        {
          error:
            "Daily enrichment budget exceeded ($2/day cap). Try again tomorrow.",
        },
        { status: 429 }
      );
    }

    // 5. Call enrichment pipeline
    const result = await enrichFromAds(sourcePageId);

    // 6. Change detection
    if (existing.enrichmentHash === result.hash && !forceOverwrite) {
      return NextResponse.json({
        skipped: true,
        reason: "No new ad data since last enrichment",
      });
    }

    // 7. Selective merge
    const { fields } = result;
    const fieldsUpdated: string[] = [];

    // String fields: only update if empty or forceOverwrite
    const stringUpdates: Record<string, string | null> = {};
    for (const key of [
      "brandVoice",
      "positioning",
      "missionStatement",
    ] as const) {
      const currentValue = existing[key];
      const newValue = fields[key];
      if (newValue && (!currentValue || forceOverwrite)) {
        stringUpdates[key] = newValue;
        fieldsUpdated.push(key);
      }
    }

    // Array fields: append-and-deduplicate or replace
    const arrayUpdates: Record<string, string[]> = {};
    for (const key of ["demographics", "interests", "painPoints"] as const) {
      const currentValues = existing[key] as string[];
      const newValues = fields[key];
      if (newValues.length === 0) continue;

      if (forceOverwrite) {
        arrayUpdates[key] = newValues;
        fieldsUpdated.push(key);
      } else if (currentValues.length === 0) {
        arrayUpdates[key] = newValues;
        fieldsUpdated.push(key);
      } else {
        // Append-and-deduplicate
        const merged = [...new Set([...currentValues, ...newValues])];
        if (merged.length > currentValues.length) {
          arrayUpdates[key] = merged;
          fieldsUpdated.push(key);
        }
      }
    }

    // 8. Prisma update
    const profile = await prisma.brandProfile.update({
      where: { id },
      data: {
        ...stringUpdates,
        ...arrayUpdates,
        enrichmentHash: result.hash,
        enrichedAt: new Date(),
        enrichmentSource: "ad-library",
      },
      include: profileInclude,
    });

    // 9. Log cost
    await logApiCost({
      model: result.model,
      operation: "enrich-from-ads",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      brandId: sourcePageId,
    });

    // 10. Return result
    return NextResponse.json({
      profile,
      enriched: true,
      fieldsUpdated,
      adCount: result.adCount,
    });
  } catch (error) {
    console.error("[brand-profiles] POST enrich error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Enrichment failed",
      },
      { status: 500 }
    );
  }
}
