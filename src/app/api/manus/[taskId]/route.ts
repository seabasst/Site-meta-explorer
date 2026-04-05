import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getManusTask, getManusMessages, extractAssistantResponse } from '@/lib/manus/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await context.params;

    const task = await prisma.manusTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // If already completed or failed, return cached DB result
    if (task.status === 'completed') {
      return Response.json({
        status: 'completed',
        resultText: task.resultText,
        completedAt: task.completedAt,
        manusUrl: task.manusUrl,
      });
    }

    if (task.status === 'failed') {
      return Response.json({
        status: 'failed',
        error: task.errorMessage,
      });
    }

    // Still pending or running -- poll Manus API for current status
    try {
      const detail = await getManusTask(task.manusTaskId);
      const manusStatus = detail.task?.status;

      if (manusStatus === 'completed') {
        // Fetch full results
        const messagesData = await getManusMessages(task.manusTaskId);
        const resultText = extractAssistantResponse(messagesData);

        await prisma.manusTask.update({
          where: { id: taskId },
          data: {
            status: 'completed',
            resultText,
            resultJson: messagesData as object,
            completedAt: new Date(),
          },
        });

        return Response.json({
          status: 'completed',
          resultText,
          completedAt: new Date(),
          manusUrl: task.manusUrl,
        });
      }

      if (manusStatus === 'failed') {
        const errorMessage = 'Manus research task failed';
        await prisma.manusTask.update({
          where: { id: taskId },
          data: { status: 'failed', errorMessage },
        });

        return Response.json({ status: 'failed', error: errorMessage });
      }

      // Handle unknown status values defensively
      if (manusStatus && manusStatus !== 'pending' && manusStatus !== 'running') {
        console.warn(`Unknown Manus task status: "${manusStatus}" for task ${task.manusTaskId}`);
      }

      // Still running (or unknown status treated as running)
      return Response.json({ status: 'running' });
    } catch (pollError) {
      // Manus API call failed -- don't update DB, just report running
      console.error('Manus poll error:', pollError);
      return Response.json({
        status: 'running',
        note: 'Unable to check latest status. Will retry on next poll.',
      });
    }
  } catch (error) {
    console.error('Manus poll route error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
