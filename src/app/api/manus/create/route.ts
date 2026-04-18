import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { createManusTask } from '@/lib/manus/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Auth gate — Manus tasks are paid agent runs (minutes, $$$). Never anon.
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      brandProfileId,
      taskType,
    }: {
      prompt?: string;
      brandProfileId?: string;
      taskType?: 'research' | 'website_enrichment';
    } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return Response.json(
        { error: 'prompt is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // If caller passed a brandProfileId, verify ownership. IDOR guard.
    if (brandProfileId) {
      const profile = await prisma.brandProfile.findUnique({
        where: { id: brandProfileId },
        select: { userId: true },
      });
      if (!profile || profile.userId !== session.user.id) {
        return Response.json({ error: 'Brand profile not found' }, { status: 404 });
      }
    }

    // Create task via Manus API
    const result = await createManusTask(prompt.trim());

    // Persist to database
    // NOTE: ManusTask has no userId column yet (see scope 4 P0). Until that
    // migration ships, ownership can only be reconstructed via brandProfileId.
    // TODO(phase-2.4): add userId FK + filter on the detail/list routes.
    const task = await prisma.manusTask.create({
      data: {
        manusTaskId: result.task_id,
        prompt: prompt.trim(),
        taskType: taskType || 'research',
        status: 'running',
        manusUrl: result.task_url,
        brandProfileId: brandProfileId || null,
      },
    });

    return Response.json({
      taskId: task.id,
      manusTaskId: result.task_id,
      status: 'running',
      message: 'Deep research started. This usually takes 2-5 minutes.',
    });
  } catch (error) {
    console.error('Manus create error:', error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create research task',
      },
      { status: 500 }
    );
  }
}
