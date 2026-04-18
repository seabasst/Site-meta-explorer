import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  TAXONOMY,
  CATEGORY_KEYS,
  type CategoryKey,
} from "@/lib/classification/taxonomy";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CategoryDistribution = Record<CategoryKey, Record<string, number>>;

// ---------------------------------------------------------------------------
// GET /api/strategy/[pageId]
// ---------------------------------------------------------------------------
// Assembles full strategy data for a brand from existing DB tables.
// No AI calls — pure data assembly from AdClassification + BrandAnalysisCache.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { pageId } = await params;

    if (!pageId) {
      return Response.json({ error: "pageId is required" }, { status: 400 });
    }

    // 1. Look up brand
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: {
        id: true,
        pageName: true,
        category: true,
        website: true,
        activeAdCount: true,
        demographicsJson: true,
      },
    });

    if (!brand) {
      return Response.json(
        { error: "Brand not found" },
        { status: 404 }
      );
    }

    // 2. Parallel queries: cache, classifications, total active ads, brand profile
    const [cache, classifications, totalActiveAds, userBrandProfile] = await Promise.all([
      prisma.brandAnalysisCache.findUnique({
        where: { brandId: brand.id },
      }),
      prisma.adClassification.findMany({
        where: { ad: { brandId: brand.id, isActive: true } },
        select: { awarenessStage: true, visualFormat: true },
      }),
      prisma.adLibraryAd.count({
        where: { brandId: brand.id, isActive: true },
      }),
      prisma.brandProfile.findFirst({
        where: { isActive: true },
        include: {
          competitors: {
            include: {
              adLibraryBrand: { select: { id: true, pageId: true, pageName: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    // 3. Check minimum classification threshold
    if (classifications.length < 3) {
      return Response.json(
        {
          error: `Only ${classifications.length} of ${totalActiveAds} ads are classified. Run classification first (need at least 3).`,
          needsClassification: true,
          classifiedCount: classifications.length,
          totalAds: totalActiveAds,
          brandId: brand.id,
        },
        { status: 422 }
      );
    }

    // 4. Build taxonomyBreakdown
    let taxonomyBreakdown: CategoryDistribution;

    if (cache?.distributionJson) {
      // Use cached distribution directly
      taxonomyBreakdown = cache.distributionJson as unknown as CategoryDistribution;
    } else {
      // Fall back to computing from classifications (need all 8 categories)
      const fullClassifications = await prisma.adClassification.findMany({
        where: { ad: { brandId: brand.id, isActive: true } },
        select: {
          assetType: true,
          visualFormat: true,
          hookTactic: true,
          messagingAngle: true,
          awarenessStage: true,
          creativeMechanic: true,
          offerType: true,
          intendedAudience: true,
        },
      });

      taxonomyBreakdown = {
        assetType: {},
        visualFormat: {},
        hookTactic: {},
        messagingAngle: {},
        awarenessStage: {},
        creativeMechanic: {},
        offerType: {},
        intendedAudience: {},
      };

      for (const c of fullClassifications) {
        for (const key of CATEGORY_KEYS) {
          const value = c[key];
          if (value) {
            taxonomyBreakdown[key][value] =
              (taxonomyBreakdown[key][value] || 0) + 1;
          }
        }
      }
    }

    // 5. Build diversityScores from cache
    const diversityScores: Record<CategoryKey | "overall", number> = {
      assetType: cache?.assetTypeScore ?? 0,
      visualFormat: cache?.visualFormatScore ?? 0,
      hookTactic: cache?.hookTacticScore ?? 0,
      messagingAngle: cache?.messagingAngleScore ?? 0,
      awarenessStage: cache?.awarenessStageScore ?? 0,
      creativeMechanic: cache?.creativeMechanicScore ?? 0,
      offerType: cache?.offerTypeScore ?? 0,
      intendedAudience: cache?.intendedAudienceScore ?? 0,
      overall: cache?.overallScore ?? 0,
    };

    // 6. Compute gapMatrix (awarenessStage x visualFormat)
    const gapMatrix: Record<string, Record<string, number>> = {};
    let maxCellCount = 0;

    for (const stage of TAXONOMY.awarenessStage.values) {
      gapMatrix[stage] = {};
      for (const format of TAXONOMY.visualFormat.values) {
        gapMatrix[stage][format] = 0;
      }
    }

    for (const c of classifications) {
      if (c.awarenessStage && c.visualFormat) {
        gapMatrix[c.awarenessStage][c.visualFormat]++;
        const count = gapMatrix[c.awarenessStage][c.visualFormat];
        if (count > maxCellCount) {
          maxCellCount = count;
        }
      }
    }

    // 7. Build brand profile
    const brandProfile = {
      pageName: brand.pageName,
      category: brand.category,
      website: brand.website,
      activeAdCount: brand.activeAdCount,
      demographics: brand.demographicsJson,
    };

    // 8. Build classificationCoverage
    const classificationCoverage = {
      classified: classifications.length,
      total: totalActiveAds,
    };

    return Response.json({
      brand: brandProfile,
      classificationCoverage,
      taxonomyBreakdown,
      diversityScores,
      gapMatrix,
      maxCellCount,
      // Optional brand profile context for personalized recommendations
      brandContext: userBrandProfile ? {
        name: userBrandProfile.name,
        positioning: userBrandProfile.positioning,
        brandVoice: userBrandProfile.brandVoice,
        demographics: userBrandProfile.demographics,
        painPoints: userBrandProfile.painPoints,
        interests: userBrandProfile.interests,
      } : null,
    });
  } catch (error) {
    console.error("Strategy data error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load strategy data",
      },
      { status: 500 }
    );
  }
}
