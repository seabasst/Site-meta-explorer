// =============================================================================
// Manus API v2 Client Wrapper
// =============================================================================

import type {
  ManusCreateResponse,
  ManusTaskDetail,
  ManusMessagesResponse,
} from './types';

const MANUS_BASE = 'https://api.manus.ai';

function getApiKey(): string {
  const key = process.env.MANUS_API_KEY;
  if (!key) {
    throw new Error(
      'MANUS_API_KEY environment variable is not set. ' +
        'Get your key at https://manus.im > Settings > Integration > Build with Manus API'
    );
  }
  return key;
}

/**
 * Create a new Manus research task.
 * POST /v2/task.create
 */
export async function createManusTask(
  prompt: string
): Promise<ManusCreateResponse> {
  const res = await fetch(`${MANUS_BASE}/v2/task.create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-manus-api-key': getApiKey(),
    },
    body: JSON.stringify({
      message: { content: prompt },
      locale: 'en',
      hide_in_task_list: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Manus API error (${res.status}): ${body}`
    );
  }

  return res.json();
}

/**
 * Get task detail / status.
 * GET /v2/task.detail?task_id={taskId}
 */
export async function getManusTask(
  taskId: string
): Promise<ManusTaskDetail> {
  const res = await fetch(
    `${MANUS_BASE}/v2/task.detail?task_id=${encodeURIComponent(taskId)}`,
    {
      headers: { 'x-manus-api-key': getApiKey() },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Manus API error (${res.status}): ${body}`
    );
  }

  return res.json();
}

/**
 * List messages for a completed task.
 * GET /v2/task.listMessages?task_id={taskId}
 */
export async function getManusMessages(
  taskId: string
): Promise<ManusMessagesResponse> {
  const res = await fetch(
    `${MANUS_BASE}/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}`,
    {
      headers: { 'x-manus-api-key': getApiKey() },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Manus API error (${res.status}): ${body}`
    );
  }

  return res.json();
}

/**
 * Extract the last assistant response text from a Manus messages response.
 * Handles unknown content shapes gracefully since the exact format
 * is not fully documented.
 */
export function extractAssistantResponse(
  messagesData: ManusMessagesResponse
): string {
  const messages = messagesData.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'Research completed but no response text was found.';
  }

  // Find last assistant message
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;

    const content = msg.content;

    // String content -- use directly
    if (typeof content === 'string') {
      return content;
    }

    // Array content -- join text parts
    if (Array.isArray(content)) {
      const textParts = content
        .map((part) => {
          if (typeof part === 'string') return part;
          if (
            part &&
            typeof part === 'object' &&
            'text' in part &&
            typeof (part as { text: unknown }).text === 'string'
          ) {
            return (part as { text: string }).text;
          }
          return null;
        })
        .filter(Boolean);

      if (textParts.length > 0) {
        return textParts.join('\n');
      }
    }

    // Object with text field
    if (
      content &&
      typeof content === 'object' &&
      'text' in content &&
      typeof (content as { text: unknown }).text === 'string'
    ) {
      return (content as { text: string }).text;
    }
  }

  return 'Research completed but the response could not be parsed.';
}
