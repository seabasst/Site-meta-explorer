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

        // Website enrichment: attempt to merge results into brand profile
        let fieldsUpdated: string[] = [];
        if (task.taskType === 'website_enrichment' && task.brandProfileId) {
          fieldsUpdated = await mergeWebsiteEnrichment(task.brandProfileId, resultText);
        }

        return Response.json({
          status: 'completed',
          resultText,
          completedAt: new Date(),
          manusUrl: task.manusUrl,
          fieldsUpdated,
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

// ---------------------------------------------------------------------------
// Website enrichment: selective merge into brand profile
// Fill-empty + append-deduplicate strategy (preserves user edits)
// ---------------------------------------------------------------------------

interface WebsiteEnrichmentData {
  brandVoice?: string | null;
  positioning?: string | null;
  demographics?: string[];
  interests?: string[];
  painPoints?: string[];
  missionStatement?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
}

async function mergeWebsiteEnrichment(
  brandProfileId: string,
  resultText: string
): Promise<string[]> {
  const fieldsUpdated: string[] = [];

  try {
    // Try to extract JSON from the result text
    let data: WebsiteEnrichmentData;
    try {
      // Try direct parse first
      data = JSON.parse(resultText);
    } catch {
      // Try to extract JSON block from markdown/text
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('Website enrichment: no JSON found in result, skipping merge');
        return [];
      }
      data = JSON.parse(jsonMatch[0]);
    }

    // Fetch current profile
    const profile = await prisma.brandProfile.findUnique({
      where: { id: brandProfileId },
      select: {
        brandVoice: true,
        positioning: true,
        demographics: true,
        interests: true,
        painPoints: true,
        missionStatement: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
      },
    });

    if (!profile) return [];

    // Build selective update: fill-empty for strings, append-deduplicate for arrays
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};

    // String fields: only fill if currently null/empty
    const stringFields = [
      'brandVoice',
      'positioning',
      'missionStatement',
    ] as const;

    for (const field of stringFields) {
      const newVal = data[field];
      if (typeof newVal === 'string' && newVal.trim()) {
        const current = profile[field];
        if (!current || current.trim() === '') {
          updates[field] = newVal.trim();
          fieldsUpdated.push(field);
        }
      }
    }

    // Color fields: only fill if currently null
    const colorFields = [
      'primaryColor',
      'secondaryColor',
      'accentColor',
    ] as const;

    for (const field of colorFields) {
      const newVal = data[field];
      if (typeof newVal === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(newVal)) {
        const current = profile[field];
        if (!current) {
          updates[field] = newVal;
          fieldsUpdated.push(field);
        }
      }
    }

    // Array fields: append new items, deduplicate
    const arrayFields = [
      'demographics',
      'interests',
      'painPoints',
    ] as const;

    for (const field of arrayFields) {
      const newItems = data[field];
      if (Array.isArray(newItems) && newItems.length > 0) {
        const current = (profile[field] as string[]) || [];
        const currentLower = new Set(current.map((s) => s.toLowerCase()));
        const toAdd = newItems.filter(
          (item): item is string =>
            typeof item === 'string' && !currentLower.has(item.toLowerCase())
        );
        if (toAdd.length > 0) {
          updates[field] = [...current, ...toAdd];
          fieldsUpdated.push(field);
        }
      }
    }

    // Apply updates
    if (Object.keys(updates).length > 0) {
      updates.enrichedAt = new Date();
      updates.enrichmentSource = 'website';

      await prisma.brandProfile.update({
        where: { id: brandProfileId },
        data: updates,
      });

      console.log(
        `Website enrichment merged for profile ${brandProfileId}: ${fieldsUpdated.join(', ')}`
      );
    } else {
      console.log(
        `Website enrichment: no new fields to merge for profile ${brandProfileId}`
      );
    }
  } catch (err) {
    // JSON parse failed or DB error -- just log, don't fail the poll
    console.error('Website enrichment merge error:', err);
  }

  return fieldsUpdated;
}
