import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { createManusTask } from '@/lib/manus/client';
import { llmGuard } from '@/lib/llm/guard';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Auth gate — paid Manus agent run against attacker-controlled URL. Never anon.
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Manus is expensive but we don't get per-call usage. Guard only.
    const guard = await llmGuard({
      userId: session.user.id,
      userEmail: session.user.email,
      operation: 'manus-enrich',
    });
    if (!guard.ok) return guard.response;

    const { brandProfileId, websiteUrl } = await request.json();

    // Validate inputs
    if (!brandProfileId || typeof brandProfileId !== 'string') {
      return Response.json(
        { error: 'brandProfileId is required' },
        { status: 400 }
      );
    }

    if (!websiteUrl || typeof websiteUrl !== 'string') {
      return Response.json(
        { error: 'websiteUrl is required' },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(websiteUrl);
    } catch {
      return Response.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Fetch brand profile — and verify ownership. IDOR guard.
    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: { id: true, name: true, userId: true },
    });

    if (!profile || profile.userId !== session.user.id) {
      return Response.json(
        { error: 'Brand profile not found' },
        { status: 404 }
      );
    }

    // Build enrichment prompt
    const enrichmentPrompt = `Research the brand "${profile.name}" by thoroughly browsing their website at ${websiteUrl}.

Extract the following brand profile data:
1. Brand Voice/Tone: How do they communicate? (2-3 sentences)
2. Market Positioning: What's their unique value proposition? (1-2 sentences)
3. Target Demographics: Who are they targeting? (list specific segments)
4. Audience Interests: What topics/interests does their audience have?
5. Customer Pain Points: What problems do they solve?
6. Brand Colors: Extract primary, secondary, and accent hex colors from the site
7. Mission Statement: If stated on the site

Browse multiple pages: homepage, about page, product pages, blog. Look at their actual content, not just meta tags.

Return ONLY valid JSON in this format:
{
  "brandVoice": "string or null",
  "positioning": "string or null",
  "demographics": ["array"],
  "interests": ["array"],
  "painPoints": ["array"],
  "missionStatement": "string or null",
  "primaryColor": "#hex or null",
  "secondaryColor": "#hex or null",
  "accentColor": "#hex or null"
}`;

    const result = await createManusTask(enrichmentPrompt);

    // Persist to DB
    const task = await prisma.manusTask.create({
      data: {
        manusTaskId: result.task_id,
        brandProfileId: profile.id,
        prompt: enrichmentPrompt,
        taskType: 'website_enrichment',
        status: 'running',
        manusUrl: result.task_url || null,
      },
    });

    return Response.json({
      taskId: task.id,
      status: 'running',
      message: 'Website analysis started. This usually takes 3-5 minutes.',
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal error';

    // Return 503 for Manus API errors (including missing key)
    if (errMsg.includes('MANUS_API_KEY') || errMsg.includes('Manus API')) {
      return Response.json({ error: errMsg }, { status: 503 });
    }

    console.error('Manus enrich error:', error);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
