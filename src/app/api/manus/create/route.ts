import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createManusTask } from '@/lib/manus/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
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

    // Create task via Manus API
    const result = await createManusTask(prompt.trim());

    // Persist to database
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
