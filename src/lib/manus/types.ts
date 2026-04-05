// =============================================================================
// Manus API v2 Types
// =============================================================================

/** Request body for POST /v2/task.create */
export interface ManusCreateRequest {
  message: { content: string };
  locale?: string;
  hide_in_task_list?: boolean;
}

/** Response from POST /v2/task.create */
export interface ManusCreateResponse {
  ok: boolean;
  request_id: string;
  task_id: string;
  task_title: string;
  task_url: string;
  share_url?: string;
}

/** Response from GET /v2/task.detail */
export interface ManusTaskDetail {
  ok: boolean;
  request_id: string;
  task: {
    id: string;
    status: string;
    created_at: number;
    updated_at: number;
    task_type: string;
  };
}

/** Known task status values (may expand -- handle unknown values defensively) */
export type ManusTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Response from GET /v2/task.listMessages
 *
 * // TODO: refine types after live API testing
 * The exact message content structure is not fully documented.
 * Using `unknown` for unverified fields.
 */
export interface ManusMessagesResponse {
  ok: boolean;
  messages?: Array<{
    role: string;
    content: unknown;
  }>;
}
