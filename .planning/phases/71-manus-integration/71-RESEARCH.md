# Phase 71: Manus Integration & Deep Research - Research

**Researched:** 2026-04-06
**Domain:** Manus API integration, async task management, message routing
**Confidence:** MEDIUM (API docs confirmed, but some response details need live verification)

## Summary

Phase 71 integrates Manus AI as an async deep research backend alongside the existing Claude-powered Hikaru chat. The Manus API v2 is a REST API at `https://api.manus.ai` that creates async "tasks" which run for 2-5+ minutes and produce research results. The integration pattern is: create task via `POST /v2/task.create`, poll status via `GET /v2/task.detail`, retrieve results via `GET /v2/task.listMessages`, with optional webhook notifications via `task_stopped` events.

The current Hikaru chat (`/api/chat/hikaru/route.ts`) is a single monolithic route that does agentic tool-use loops with Claude Sonnet, streaming SSE events (`thinking`, `tool_result`, `text`, `done`) to the client. Manus integration requires: (1) a routing layer that decides Claude vs Manus before calling either backend, (2) a new Manus task API with create/poll endpoints, (3) Prisma model to track task state, and (4) UI changes to add a "Deep Research" toggle and async polling display.

The existing website scraping endpoint (`/api/creative-lab/scrape-brand/route.ts`) does basic HTML fetch + Haiku extraction. The ENRC-02 requirement (website URL enrichment) should use Manus for deeper crawling -- Manus can browse full sites, not just the homepage HTML.

**Primary recommendation:** Build a thin Manus API wrapper (`src/lib/manus/client.ts`), a `ManusTask` Prisma model, two new API routes (create + poll), and modify the Hikaru page to support both instant (Claude SSE) and async (Manus polling) response modes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Manus API v2 | v2 | Async deep research tasks | Decided by user -- the AI agent for complex research |
| @anthropic-ai/sdk | (existing) | Claude streaming for fast queries | Already in use for Hikaru chat |
| Prisma | (existing) | Task state persistence | Already the project ORM |
| zod | (existing) | Request validation | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node built-in) | N/A | Webhook signature verification | If webhook path is implemented |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling from client | Webhooks | Webhooks need a public endpoint; polling is simpler for Vercel serverless. Use polling first, add webhooks later |
| Manus for website enrichment | Current scrape-brand (Haiku) | Manus crawls full sites, Haiku only sees first 10K chars of homepage. Manus is much better for ENRC-02 |

**Installation:**
```bash
# No new packages needed -- Manus uses raw fetch, Prisma and zod already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    manus/
      client.ts          # Manus API wrapper (create, poll, getMessages)
      types.ts           # TypeScript types for Manus API responses
      router.ts          # Message routing logic (keyword + toggle)
  app/
    api/
      manus/
        create/route.ts  # POST: create Manus task, save to DB
        [taskId]/
          route.ts       # GET: poll task status + get results
      chat/
        hikaru/route.ts  # MODIFIED: add routing pre-check
```

### Pattern 1: Manus API Client Wrapper
**What:** Thin wrapper around Manus REST API with typed responses
**When to use:** All Manus API calls
**Example:**
```typescript
// Source: https://open.manus.im/docs/api-reference/create-task
const MANUS_BASE = 'https://api.manus.ai';

interface ManusCreateResponse {
  ok: boolean;
  request_id: string;
  task_id: string;
  task_title: string;
  task_url: string;
  share_url?: string;
}

interface ManusTaskDetail {
  ok: boolean;
  request_id: string;
  task: {
    id: string;
    status: string; // "running" | "completed" | "failed" | pending
    created_at: number;
    updated_at: number;
    task_type: string;
  };
}

export async function createManusTask(prompt: string): Promise<ManusCreateResponse> {
  const res = await fetch(`${MANUS_BASE}/v2/task.create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-manus-api-key': process.env.MANUS_API_KEY!,
    },
    body: JSON.stringify({
      message: { content: prompt },
      locale: 'en',
      hide_in_task_list: true,
    }),
  });
  return res.json();
}

export async function getManusTask(taskId: string): Promise<ManusTaskDetail> {
  const res = await fetch(
    `${MANUS_BASE}/v2/task.detail?task_id=${taskId}`,
    {
      headers: { 'x-manus-api-key': process.env.MANUS_API_KEY! },
    }
  );
  return res.json();
}

export async function getManusMessages(taskId: string): Promise<unknown> {
  const res = await fetch(
    `${MANUS_BASE}/v2/task.listMessages?task_id=${taskId}`,
    {
      headers: { 'x-manus-api-key': process.env.MANUS_API_KEY! },
    }
  );
  return res.json();
}
```

### Pattern 2: Keyword-Based Message Routing
**What:** Simple keyword matching + UI toggle to decide Claude vs Manus
**When to use:** Every incoming Hikaru message
**Example:**
```typescript
const DEEP_RESEARCH_KEYWORDS = [
  'deep research', 'deep dive', 'comprehensive analysis',
  'full report', 'detailed report', 'in-depth',
  'website analysis', 'brand audit', 'market research',
  'competitive landscape', 'industry report',
  'crawl', 'scrape website', 'analyze website',
  'enrichment from website', 'auto-populate from url',
];

export function shouldRouteToManus(
  message: string,
  deepResearchToggle: boolean
): boolean {
  if (deepResearchToggle) return true;

  const lower = message.toLowerCase();
  return DEEP_RESEARCH_KEYWORDS.some(kw => lower.includes(kw));
}
```

### Pattern 3: Async Task State Machine
**What:** Prisma model + polling pattern for Manus task lifecycle
**When to use:** Every Manus task
**Example:**
```typescript
// Prisma schema addition
model ManusTask {
  id           String   @id @default(cuid())
  manusTaskId  String   @unique // Manus API task_id
  userId       String
  brandProfileId String?

  prompt       String   // Original user query
  status       String   @default("pending") // pending | running | completed | failed
  resultText   String?  // Final assistant response text
  resultJson   Json?    // Full response data
  manusUrl     String?  // Link to view in Manus app

  errorMessage String?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  completedAt  DateTime?

  @@index([userId, status])
  @@index([manusTaskId])
}
```

### Pattern 4: Client-Side Polling
**What:** React hook that polls task status every 5 seconds
**When to use:** When a Manus task is in progress
**Example:**
```typescript
function useManusTask(taskId: string | null) {
  const [task, setTask] = useState<ManusTaskState | null>(null);

  useEffect(() => {
    if (!taskId) return;

    const poll = async () => {
      const res = await fetch(`/api/manus/${taskId}`);
      const data = await res.json();
      setTask(data);

      if (data.status === 'completed' || data.status === 'failed') {
        clearInterval(interval);
      }
    };

    poll(); // immediate first check
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [taskId]);

  return task;
}
```

### Anti-Patterns to Avoid
- **Don't classify with LLM:** The routing decision must be keyword + toggle, not a Claude call (adds latency and cost to every message).
- **Don't block the UI:** Manus tasks take 2-5+ minutes. Never hold open an SSE connection waiting for Manus. Return immediately with task ID, let client poll.
- **Don't lose the Claude SSE pattern:** When routing to Claude, the existing streaming pattern must remain untouched. Manus is a parallel path, not a replacement.
- **Don't poll from server on Vercel:** Vercel serverless functions timeout. The client must poll, not the server.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Website crawling/analysis | Custom Puppeteer crawler | Manus task with browse capability | Manus handles full site crawling, JS rendering, multi-page navigation |
| Webhook signature verification | Custom crypto | Manus `/v2/webhook.publicKey` endpoint + RSA-SHA256 | Standard verification pattern |
| SSE streaming for Claude | New streaming implementation | Existing Hikaru SSE pattern | Already battle-tested, works well |
| Polling with backoff | Custom retry logic | Simple `setInterval` with 5s cadence | Tasks take minutes, not seconds -- simple polling is fine |

## Common Pitfalls

### Pitfall 1: Manus Credit Consumption is Unpredictable
**What goes wrong:** A "simple" Manus research task can consume 10-900 credits depending on complexity. No way to predict cost before starting.
**Why it happens:** Manus agents browse the web, run multi-step reasoning, create files -- each step costs credits.
**How to avoid:** Log every task's credit usage. Consider adding a daily task limit (e.g., 5 deep research tasks/day). Display cost warnings in UI.
**Warning signs:** Rapid credit depletion, users triggering Manus for simple queries that Claude handles fine.

### Pitfall 2: Manus Task Status Values Need Live Verification
**What goes wrong:** Documentation shows task status values but exact strings and transitions are not 100% confirmed across all sources.
**Why it happens:** Manus API v2 is relatively new. Different sources mention slightly different status values (e.g., "pending" vs immediate "running").
**How to avoid:** Add defensive status handling. Log actual status values during development. Handle unknown statuses gracefully.
**Warning signs:** Tasks stuck in unexpected states.

### Pitfall 3: Manus API Key Not Yet Available
**What goes wrong:** Development blocked because no API key exists yet.
**Why it happens:** Manus API access needs to be set up at https://manus.im (Settings > Integration > Build with Manus API).
**How to avoid:** Set up Manus account and API key BEFORE starting implementation. Add `MANUS_API_KEY` to .env and Vercel env vars.
**Warning signs:** All Manus calls returning 401/403.

### Pitfall 4: Vercel Function Timeout vs Long Tasks
**What goes wrong:** Trying to wait for Manus completion inside a Vercel serverless function (maxDuration 60-120s).
**Why it happens:** Natural instinct to poll server-side. Manus tasks take 2-5+ minutes.
**How to avoid:** Return task ID immediately to client. Client does all polling via separate lightweight GET requests.
**Warning signs:** 504 Gateway Timeout errors.

### Pitfall 5: Dual Message Display Complexity
**What goes wrong:** The Hikaru chat needs to show both instant Claude responses (SSE stream) and async Manus responses (polling with progress states).
**Why it happens:** Two fundamentally different UX patterns in the same chat interface.
**How to avoid:** Use a message type discriminator: `type: 'instant' | 'deep-research'`. Deep research messages show inline polling card instead of streaming text.
**Warning signs:** Broken chat flow when switching between Claude and Manus responses.

### Pitfall 6: listMessages Response Format Unknown
**What goes wrong:** Can't parse Manus task results because the exact `task.listMessages` response format is not documented in detail.
**Why it happens:** API docs show the endpoint exists but detailed response schema is sparse.
**How to avoid:** Build the wrapper with generous typing (`unknown` for unverified fields), log full responses during development, refine types iteratively.
**Warning signs:** Type errors, missing data in task results display.

## Code Examples

### Hikaru Route Modification -- Adding Router Pre-Check
```typescript
// In /api/chat/hikaru/route.ts POST handler
// BEFORE the Claude call, check if we should route to Manus

const lastMessage = messages[messages.length - 1];
const deepResearch = body.deepResearch === true; // UI toggle

if (shouldRouteToManus(lastMessage.content, deepResearch)) {
  // Create Manus task and return immediately
  const manusResult = await createManusTask(
    buildManusPrompt(lastMessage.content, brandContext)
  );

  // Save to DB
  const task = await prisma.manusTask.create({
    data: {
      manusTaskId: manusResult.task_id,
      userId: user.id,
      brandProfileId: brandProfileId || null,
      prompt: lastMessage.content,
      status: 'running',
      manusUrl: manusResult.task_url,
    },
  });

  // Return task reference (not SSE stream)
  return Response.json({
    type: 'manus_task',
    taskId: task.id,
    manusTaskId: manusResult.task_id,
    message: 'Deep research started. This usually takes 2-5 minutes.',
  });
}

// ... existing Claude SSE flow continues unchanged
```

### Website Enrichment via Manus
```typescript
// Manus prompt for ENRC-02 website enrichment
function buildWebsiteEnrichmentPrompt(url: string, brandName: string): string {
  return `Research the brand "${brandName}" by thoroughly browsing their website at ${url}.

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
}
```

### Manus Poll Endpoint
```typescript
// GET /api/manus/[taskId]/route.ts
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params;

  const task = await prisma.manusTask.findUnique({
    where: { id: taskId },
  });

  if (!task) {
    return Response.json({ error: 'Task not found' }, { status: 404 });
  }

  // If still running, check Manus API
  if (task.status === 'running' || task.status === 'pending') {
    const detail = await getManusTask(task.manusTaskId);

    if (detail.task.status === 'completed') {
      // Fetch results
      const messages = await getManusMessages(task.manusTaskId);
      // Extract last assistant message
      const resultText = extractAssistantResponse(messages);

      await prisma.manusTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          resultText,
          resultJson: messages as object,
          completedAt: new Date(),
        },
      });

      return Response.json({
        status: 'completed',
        resultText,
        completedAt: new Date(),
      });
    }

    if (detail.task.status === 'failed') {
      await prisma.manusTask.update({
        where: { id: taskId },
        data: { status: 'failed', errorMessage: 'Manus task failed' },
      });
      return Response.json({ status: 'failed', error: 'Research task failed' });
    }

    // Still running
    return Response.json({ status: 'running' });
  }

  // Already completed/failed in DB
  return Response.json({
    status: task.status,
    resultText: task.resultText,
    completedAt: task.completedAt,
    error: task.errorMessage,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manus v1 API (`/v1/tasks`) | Manus v2 API (`/v2/task.create`) | 2025 | Different URL patterns, auth header changed to `x-manus-api-key` |
| Single agent profile | 6 profiles (1.6, 1.6-lite, 1.6-max, 1.5, 1.5-lite, speed) | 2025 | Choose `manus-1.6` for deep research, `speed` for website scraping |
| Simple HTML scraping for enrichment | Manus agent browsing full websites | Phase 71 | Much richer website analysis -- multi-page, JS-rendered content |

**Deprecated/outdated:**
- v1 API endpoints (`/v1/tasks`) -- still work per PHP SDK but v2 is recommended
- `agentProfile` request field name (v1) -- v2 likely uses different field, needs live verification

## Open Questions

1. **Exact `task.listMessages` response format**
   - What we know: Returns messages with role/content structure
   - What's unclear: Exact field names, pagination, attachment handling
   - Recommendation: Build with `unknown` type, log full responses, refine during development

2. **Manus task status lifecycle**
   - What we know: Tasks go through pending/running/completed/failed
   - What's unclear: Whether tasks start as "pending" then move to "running", or skip straight to "running"
   - Recommendation: Handle all possible statuses defensively

3. **Credit consumption per task type**
   - What we know: 10-900 credits per task, varies wildly
   - What's unclear: Average cost for "brand research" and "website enrichment" task types
   - Recommendation: Log costs from first tasks, set conservative daily limits initially

4. **Manus API key and account setup**
   - What we know: Need to go to Settings > Integration > Build with Manus API
   - What's unclear: Whether account exists yet, pricing plan chosen
   - Recommendation: This is a blocker -- must be resolved before any implementation

5. **Agent profile selection**
   - What we know: 6 profiles available (manus-1.6, 1.6-lite, 1.6-max, 1.5, 1.5-lite, speed)
   - What's unclear: Optimal profile for research vs website scraping
   - Recommendation: Use `manus-1.6` for deep research, `speed` for website enrichment. Tune after testing.

6. **v2 task.create `message.content` format**
   - What we know: Can be a plain string or array of ContentPart objects
   - What's unclear: Whether string works directly or must be wrapped in ContentPart
   - Recommendation: Start with plain string, fall back to `[{type: "text", text: "..."}]` if needed

## Codebase Integration Points

### Files to Modify
| File | Change | Reason |
|------|--------|--------|
| `prisma/schema.prisma` | Add `ManusTask` model | Store async task state |
| `src/app/api/chat/hikaru/route.ts` | Add routing pre-check | Direct deep research to Manus |
| `src/app/dashboard/v2/hikaru/page.tsx` | Add Deep Research toggle + polling UI | UX for async tasks |
| `.env` / Vercel env vars | Add `MANUS_API_KEY` | Authentication |

### Files to Create
| File | Purpose |
|------|---------|
| `src/lib/manus/client.ts` | Manus API wrapper (create, poll, getMessages) |
| `src/lib/manus/types.ts` | TypeScript types for API responses |
| `src/lib/manus/router.ts` | Message routing logic (keyword + toggle) |
| `src/app/api/manus/create/route.ts` | POST: create Manus task |
| `src/app/api/manus/[taskId]/route.ts` | GET: poll task + get results |

### Existing Patterns to Preserve
- Hikaru SSE streaming (`data: {type: 'thinking'|'tool_result'|'text'|'done'}`) -- unchanged for Claude path
- Brand context injection via `compileBrandContext()` -- inject into Manus prompts too
- Chat history persistence via `/api/chat/hikaru/history/*` -- Manus results should also be saved
- Brand profile enrichment pattern from Phase 70 -- website enrichment follows same selective-merge approach

## Sources

### Primary (HIGH confidence)
- [Manus API v2 Reference](https://open.manus.im/docs) -- all endpoints, authentication, response format
- [Create Task endpoint](https://open.manus.im/docs/api-reference/create-task) -- `POST /v2/task.create` with `x-manus-api-key` auth, request/response format
- [Get Task endpoint](https://open.manus.im/docs/api-reference/get-task) -- `GET /v2/task.detail` response with status field
- [Webhooks documentation](https://open.manus.im/docs/webhooks) -- `task_created` and `task_stopped` events with payload schema
- Codebase: `src/app/api/chat/hikaru/route.ts` -- current chat implementation (1099 lines, SSE streaming, tool loop)
- Codebase: `src/app/dashboard/v2/hikaru/page.tsx` -- chat UI (892 lines, brand selector, history sidebar)
- Codebase: `prisma/schema.prisma` -- current data model including BrandProfile
- Codebase: `src/lib/enrichment/enrich-from-ads.ts` -- existing enrichment pipeline pattern

### Secondary (MEDIUM confidence)
- [elastic.io Manus component](https://docs.elastic.io/components/manus-ai/) -- 6 agent profiles, task modes (chat/adaptive/agent), v1 endpoint patterns
- [tigusigalpa/manus-ai-php](https://github.com/tigusigalpa/manus-ai-php) -- task lifecycle, output structure `{role, content}`, status values
- [Building Research Agents with Manus API](https://atalupadhyay.wordpress.com/2026/01/04/building-intelligent-research-agents-with-manus-api/) -- polling pattern, Python examples, practical tips

### Tertiary (LOW confidence)
- [Manus AI Pricing](https://manus.im/pricing) -- credit system, 10-900 credits per task, plan tiers
- [Getting Started with Manus Agent API (Medium)](https://new2026.medium.com/getting-started-with-the-manus-agent-api-full-code-tips-costing-eef90bacd06c) -- blocked by paywall, snippets from search results only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Manus API v2 endpoints and auth confirmed from official docs
- Architecture: HIGH -- Based on direct codebase analysis of existing patterns
- Manus response formats: MEDIUM -- Endpoint URLs and basic formats confirmed, detailed response schemas partially verified
- Task lifecycle: MEDIUM -- Status values mentioned across sources but exact transitions need live verification
- Pitfalls: MEDIUM -- Based on API documentation gaps and community reports
- Credit costs: LOW -- Highly variable, no reliable prediction possible

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (30 days -- Manus API is relatively stable, but verify response formats during implementation)
