import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { compileBrandContext } from "@/lib/brand-context";
import type { BrandProfileFull } from "@/lib/brand-profile-types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Request schema
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  pageId: z.string().min(1),
  diversityScores: z.record(z.string(), z.number()),
  weakCategories: z.array(z.string()),
  gapCount: z.number(),
});

// ---------------------------------------------------------------------------
// POST /api/strategy/personalized
// ---------------------------------------------------------------------------
// Generates AI-powered personalized strategy insights using brand profile
// context via Claude Haiku. Returns an array of insight paragraphs.

export async function POST(request: NextRequest) {
  try {
    // 1. Parse request
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { pageId, diversityScores, weakCategories, gapCount } = parsed.data;

    // 2. Look up brand
    const brand = await prisma.adLibraryBrand.findUnique({
      where: { pageId },
      select: { id: true, pageName: true, category: true },
    });

    if (!brand) {
      return Response.json({ error: "Brand not found" }, { status: 404 });
    }

    // 3. Find active BrandProfile
    const profile = await prisma.brandProfile.findFirst({
      where: { isActive: true },
      include: {
        competitors: {
          include: {
            adLibraryBrand: {
              select: { id: true, pageId: true, pageName: true, profilePicUrl: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!profile) {
      return Response.json({
        needsProfile: true,
        message: "Create a brand profile for personalized insights",
      });
    }

    // 4. Build brand context using shared utility
    const brandContext = compileBrandContext(
      profile as unknown as BrandProfileFull,
      { queryHint: "strategy" }
    );

    // 5. Build diversity summary
    const overall = diversityScores["overall"] ?? 0;
    const weakList = weakCategories.length > 0
      ? weakCategories.join(", ")
      : "none identified";

    const strongCategories = Object.entries(diversityScores)
      .filter(([k, v]) => k !== "overall" && (v as number) >= 60)
      .map(([k]) => k);
    const strongList = strongCategories.length > 0
      ? strongCategories.join(", ")
      : "none above 60";

    // 6. Build prompt
    const prompt = `You are a senior Meta Ads creative strategist giving personalized recommendations to a brand.
${brandContext}

**Ad Strategy Analysis for ${brand.pageName}:**
- Overall diversity score: ${overall}/100
- Weak categories (score < 40): ${weakList}
- Strong categories (score >= 60): ${strongList}
- Empty gap matrix cells: ${gapCount}

**Instructions:**
Generate 3-5 personalized, actionable strategy recommendations for this brand. Each recommendation MUST:
1. Reference specific brand profile data (audience demographics, positioning, pain points, or brand voice)
2. Connect to a specific weakness or gap from the analysis
3. Include a concrete next step the brand can take

Format: Return a JSON array of strings, where each string is one recommendation paragraph (2-3 sentences each). No markdown, no explanation outside the array.

Example format: ["Recommendation 1 text...", "Recommendation 2 text..."]`;

    // 7. Call Claude Haiku
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20250415",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // 8. Parse response
    let insights: string[];
    try {
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Expected non-empty array");
      }
      insights = parsed.map((item: unknown) => String(item));
    } catch {
      // Fallback: split by double newlines if JSON parsing fails
      insights = responseText
        .split(/\n\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 20);

      if (insights.length === 0) {
        insights = [responseText.trim()];
      }
    }

    return Response.json({ insights });
  } catch (error) {
    console.error("Personalized strategy error:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate personalized insights",
      },
      { status: 500 }
    );
  }
}
