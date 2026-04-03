# Architecture Patterns: Dual-Model AI Routing + Brand Profile Context System

**Domain:** Ad Intelligence SaaS -- v9.0 Brand Profile & AI Context System
**Researched:** 2026-04-03
**Overall confidence:** MEDIUM-HIGH (existing codebase patterns are HIGH; Manus API specifics are MEDIUM due to limited official docs access)

---

## Recommended Architecture

### High-Level Overview

```
+---------------------+     +--------------------+     +-------------------+
|  Hikaru Chat UI     |     |  Brand Onboarding  |     |  Brand Selector   |
|  (existing SSE)     |     |  Wizard            |     |  (header/sidebar) |
+----------+----------+     +--------+-----------+     +--------+----------+
           |                         |                           |
           v                         v                           v
+----------+-------------------------+---------------------------+----------+
|                          Next.js API Layer                                |
|                                                                           |
|  /api/chat/hikaru/route.ts      /api/brands/profile/route.ts             |
|  (enhanced with routing +       (CRUD + onboarding)                      |
|   context injection)                                                      |
|                                                                           |
|  /api/brands/enrich/route.ts    /api/brands/enrich/webhook/route.ts      |
|  (kick off Manus task)          (receive Manus completion)               |
+-----+-------------------+------------------+----------------------------+
      |                   |                  |
      v                   v                  v
+-----+------+    +------+-------+    +-----+---------+
| Anthropic  |    | Manus API    |    | Neon Postgres |
| Claude API |    | (async agent)|    | (BrandProfile |
| (streaming)|    |              |    |  + all models)|
+------------+    +--------------+    +---------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **BrandProfile model** (Prisma) | Store brand identity, voice, audience, competitive context | All API routes read it |
| **Brand CRUD API** (`/api/brands/profile/`) | Create, read, update, delete brand profiles | Prisma, UI |
| **Brand Selector** (UI component) | Switch active brand context across the app | Local state / URL param, stored in cookie or React context |
| **Onboarding Wizard** (UI) | Multi-step brand profile creation | Brand CRUD API, enrichment API |
| **Message Router** (`/api/chat/hikaru/route.ts`) | Decide Claude (fast) vs Manus (deep) based on intent | Claude API, Manus API, BrandProfile |
| **Context Injector** (lib function) | Build system prompt with brand context | BrandProfile, called by router |
| **Manus Task Manager** (`/api/brands/enrich/`) | Create Manus tasks, store task IDs | Manus API, Prisma |
| **Manus Webhook Receiver** (`/api/brands/enrich/webhook/`) | Receive completed Manus results, update DB | Manus API (inbound), Prisma |
| **Enrichment Poller** (cron fallback) | Poll incomplete Manus tasks as safety net | Manus API, Prisma |

---

## Data Flow

### Flow 1: Brand Context Injection into Claude Chat (Fast Path)

This is the primary flow -- user asks Hikaru a question with brand context active.

```
1. User sends message in chat UI
2. UI includes activeBrandId in request body
3. /api/chat/hikaru/route.ts receives message
4. Router checks message intent (keyword + heuristic classification)
5. For Claude path:
   a. Load BrandProfile from Prisma by activeBrandId
   b. Call buildBrandContext(profile) -> context string
   c. Prepend context to HIKARU_SYSTEM_PROMPT
   d. Continue existing agentic tool loop (unchanged)
   e. Stream response via existing SSE protocol
```

**Key insight:** The existing Hikaru route already uses a non-streaming agentic loop with SSE wrapper (lines 968-1033 of current route). Brand context injection is purely a system prompt enhancement -- zero changes to the streaming/tool infrastructure.

### Flow 2: Message Router -- Claude vs Manus Decision

```
1. User sends message in chat UI
2. Router classifies intent:
   - FAST: "Compare Nike vs Adidas ads" -> Claude (uses DB tools, needs speed)
   - DEEP: "Research competitor landscape for my brand" -> Manus (needs web browsing, takes minutes)
3. For FAST -> existing Claude flow with brand context
4. For DEEP:
   a. Create Manus task via POST /v1/tasks
   b. Store task_id + chat context in ManusTask table
   c. Return SSE event: { type: "manus_started", taskId, estimatedMinutes }
   d. UI shows "Manus is researching... (usually 2-5 min)"
   e. Client polls /api/chat/hikaru/manus-status?taskId=X every 10s
   f. When complete, return full Manus result as assistant message
```

### Flow 3: Brand Onboarding Wizard

```
1. User clicks "Add Brand" in brand selector
2. Wizard UI: Step 1 - Brand name + website (required)
3. Wizard UI: Step 2 - Voice & audience (optional, can skip)
4. Wizard UI: Step 3 - Competitors (search existing brands in DB)
5. POST /api/brands/profile -> creates BrandProfile in Prisma
6. Background: kick off auto-enrichment (Flow 4)
7. User lands on dashboard with brand context active
```

### Flow 4: Auto-Enrichment via Manus (Background)

```
1. Brand profile created (or user clicks "Enrich" button)
2. POST /api/brands/enrich:
   a. Create Manus task: "Research brand X: analyze their ad strategy,
      identify key competitors, describe their brand voice and positioning"
   b. Store ManusTask record: { brandProfileId, taskId, status: "running" }
   c. Register webhook URL: /api/brands/enrich/webhook
   d. Return 200 to caller
3. Manus processes (2-10 minutes)
4. Webhook fires to /api/brands/enrich/webhook:
   a. Verify webhook signature (RSA-SHA256)
   b. Parse Manus result
   c. Update BrandProfile with enriched data
   d. Set ManusTask status to "completed"
5. Safety net: Vercel cron polls incomplete tasks every 5 min
```

---

## Component Detail: BrandProfile Schema

**Recommendation:** Extend the existing `BrandGuidelines` model rather than creating a new model. The current model already has voice, demographics, colors, and logo -- it just needs enrichment fields.

However, `BrandGuidelines` is tied 1:1 to User, while v9.0 needs brand profiles that are independent entities (a user might manage multiple brands). **Create a new `BrandProfile` model.**

```prisma
model BrandProfile {
  id        String   @id @default(cuid())

  // Identity
  name           String        // Brand name
  website        String?       // Brand website
  logoUrl        String?       // Logo URL (R2)
  logoKey        String?       // R2 object key

  // Voice & Positioning (user-provided or AI-enriched)
  brandVoice     String?       // Tone description
  mission        String?       // Mission statement
  positioning    String?       // Market positioning
  uniqueValue    String?       // USP / value proposition

  // Audience
  targetDemo     String[]      // Demographics: ["25-34", "Female"]
  interests      String[]      // Interest tags
  geoFocus       String[]      // Country codes: ["DE", "SE", "GB"]

  // Visual Identity
  primaryColor   String?
  secondaryColor String?
  accentColor    String?

  // Competitive Context
  competitors    String[]      // AdLibraryBrand pageIds
  competitorNotes String?      // AI-generated competitive summary

  // AI-Enriched Fields (populated by Manus)
  enrichedAt         DateTime?
  enrichmentJson     Json?         // Full Manus research output
  industryInsights   String?       // AI-generated industry context
  adStrategyNotes    String?       // AI-generated strategy observations

  // Link to existing brand in ad library (optional)
  adLibraryBrandId   String?       // If brand exists in our DB

  // Ownership
  userId         String
  isDefault      Boolean  @default(false) // One default per user

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  manusEnrichments ManusTask[]

  @@index([userId])
  @@unique([userId, name])
}

model ManusTask {
  id             String   @id @default(cuid())
  brandProfileId String?
  brandProfile   BrandProfile? @relation(fields: [brandProfileId], references: [id], onDelete: Cascade)

  // Task tracking
  manusTaskId    String   @unique // Manus API task_id
  taskType       String            // "brand_enrichment", "deep_research", "competitor_analysis"
  prompt         String            // What was sent to Manus
  status         String   @default("running") // running, pending, completed, failed

  // Result
  resultJson     Json?             // Full Manus output
  resultSummary  String?           // Extracted summary for display

  // Metadata
  manusTaskUrl   String?           // URL to view in Manus dashboard
  createdAt      DateTime @default(now())
  completedAt    DateTime?

  @@index([status])
  @@index([brandProfileId])
}
```

**Build order implication:** BrandProfile schema MUST be built before any other v9.0 component -- everything depends on it.

---

## Component Detail: Context Injector

The context injector builds a system prompt section from the BrandProfile. This is a pure function, not a service.

```typescript
// src/lib/brand-context.ts

interface BrandContext {
  name: string;
  voice?: string;
  mission?: string;
  positioning?: string;
  targetDemo: string[];
  interests: string[];
  geoFocus: string[];
  competitors: string[]; // brand names, resolved from pageIds
  industryInsights?: string;
  adStrategyNotes?: string;
}

export function buildBrandSystemPrompt(brand: BrandContext): string {
  const sections: string[] = [];

  sections.push(`## Active Brand Context: ${brand.name}`);
  sections.push(`You are advising the team behind **${brand.name}**.`);
  sections.push(`Frame all analysis, recommendations, and creative suggestions from their perspective.`);

  if (brand.voice) {
    sections.push(`\n### Brand Voice\n${brand.voice}`);
  }
  if (brand.positioning) {
    sections.push(`\n### Market Positioning\n${brand.positioning}`);
  }
  if (brand.targetDemo.length > 0) {
    sections.push(`\n### Target Audience\nDemographics: ${brand.targetDemo.join(', ')}`);
  }
  if (brand.interests.length > 0) {
    sections.push(`Interests: ${brand.interests.join(', ')}`);
  }
  if (brand.geoFocus.length > 0) {
    sections.push(`Geographic focus: ${brand.geoFocus.join(', ')}`);
  }
  if (brand.competitors.length > 0) {
    sections.push(`\n### Key Competitors\n${brand.competitors.join(', ')}`);
    sections.push(`When analyzing these competitors, highlight opportunities and gaps relative to ${brand.name}.`);
  }
  if (brand.industryInsights) {
    sections.push(`\n### Industry Context\n${brand.industryInsights}`);
  }
  if (brand.adStrategyNotes) {
    sections.push(`\n### Current Ad Strategy Observations\n${brand.adStrategyNotes}`);
  }

  return sections.join('\n');
}
```

**Integration point:** In `/api/chat/hikaru/route.ts`, the system prompt becomes:

```typescript
const brandContext = activeBrandId
  ? await loadBrandContext(activeBrandId)
  : null;

const systemPrompt = brandContext
  ? `${HIKARU_SYSTEM_PROMPT}\n\n${buildBrandSystemPrompt(brandContext)}`
  : HIKARU_SYSTEM_PROMPT;
```

**Build order implication:** Context injector depends on BrandProfile schema. Can be built immediately after schema.

---

## Component Detail: Message Router

The router decides between Claude (fast, streaming) and Manus (deep, async). Keep it simple -- a classifier function, not a separate service.

```typescript
// src/lib/ai-router.ts

type RouteDecision =
  | { model: 'claude'; reason: string }
  | { model: 'manus'; reason: string; manusPrompt: string };

const MANUS_TRIGGERS = [
  'deep research',
  'research my competitors',
  'full analysis',
  'investigate',
  'comprehensive report',
  'market research',
  'industry analysis',
  'deep dive into',
  'scrape their website',
  'analyze their landing page',
];

export function routeMessage(
  userMessage: string,
  hasBrandContext: boolean
): RouteDecision {
  const lower = userMessage.toLowerCase();

  // Check for explicit Manus triggers
  const manusMatch = MANUS_TRIGGERS.find(t => lower.includes(t));

  if (manusMatch) {
    return {
      model: 'manus',
      reason: `Matched deep research trigger: "${manusMatch}"`,
      manusPrompt: userMessage, // Will be enriched with brand context
    };
  }

  // Default: Claude for everything else
  return {
    model: 'claude',
    reason: 'Standard query -- fast path via Claude',
  };
}
```

**Architecture decision: Start with keyword matching, not an LLM classifier.** Reasons:
1. An LLM classifier adds latency (500ms+ per message) to decide which model to use
2. The decision space is small (2 options) and trigger words are predictable
3. Can always add an LLM classifier later if keyword matching proves insufficient
4. Users can also explicitly choose "Deep Research" mode via UI toggle

**Build order implication:** Router depends on nothing except the decision to have it. Can be built any time, but should be built after core Claude + brand context works, so you have a baseline to route FROM.

---

## Component Detail: Manus Integration

### API Contract (MEDIUM confidence -- based on WebSearch, not verified against live docs)

Based on research, the Manus API v1 works like this:

```
POST https://api.manus.ai/v1/tasks
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "prompt": "Research brand X and their ad strategy...",
  "agentProfile": "manus-1.5"
}

Response:
{
  "task_id": "abc123",
  "task_title": "Brand Research",
  "task_url": "https://manus.im/tasks/abc123",
  "share_url": "https://manus.im/share/abc123"
}
```

**Task states:** running -> pending | completed | failed

- `running`: Manus is working
- `pending`: Manus needs user input (interactive mode -- likely not relevant for our use)
- `completed`: Results ready
- `failed`: Task failed

**Retrieval:** GET endpoint to fetch task status + results (exact endpoint needs verification against official docs at open.manus.im/docs).

**Webhooks:** POST to your registered URL when `task_stopped` event fires. Verify with RSA-SHA256 signature.

### Vercel-Compatible Manus Pattern

**Problem:** Manus tasks take 2-10 minutes. Vercel functions time out at 60s (Pro) or 300s (maxDuration=300). Cannot hold a connection open.

**Solution: Webhook + Cron Safety Net (matches existing pattern)**

The project already uses this exact pattern for classification jobs:
- `/api/ad-library/cron/classify-poll` runs every 5 minutes
- Polls for completed Anthropic batch jobs

Apply the same pattern to Manus:

```typescript
// 1. Kick off task (returns immediately)
// POST /api/brands/enrich/route.ts
export async function POST(req: NextRequest) {
  const { brandProfileId } = await req.json();
  const profile = await prisma.brandProfile.findUnique({ where: { id: brandProfileId } });

  const manusResponse = await fetch('https://api.manus.ai/v1/tasks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MANUS_API_KEY}` },
    body: JSON.stringify({
      prompt: buildEnrichmentPrompt(profile),
      agentProfile: 'manus-1.5',
    }),
  });

  const { task_id, task_url } = await manusResponse.json();

  await prisma.manusTask.create({
    data: {
      brandProfileId,
      manusTaskId: task_id,
      taskType: 'brand_enrichment',
      prompt: buildEnrichmentPrompt(profile),
      status: 'running',
      manusTaskUrl: task_url,
    },
  });

  return NextResponse.json({ taskId: task_id, status: 'running' });
}

// 2. Webhook receiver (Manus calls this when done)
// POST /api/brands/enrich/webhook/route.ts
export async function POST(req: NextRequest) {
  // Verify webhook signature
  const body = await req.text();
  const signature = req.headers.get('x-manus-signature');
  if (!verifyManusSignature(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(body);
  // Update task and brand profile...
  return NextResponse.json({ ok: true });
}

// 3. Cron safety net (every 5 min)
// GET /api/brands/enrich/poll/route.ts
export async function GET(req: NextRequest) {
  const runningTasks = await prisma.manusTask.findMany({
    where: { status: 'running', createdAt: { gt: subHours(new Date(), 1) } },
  });

  for (const task of runningTasks) {
    const status = await fetchManusTaskStatus(task.manusTaskId);
    if (status === 'completed') {
      // Process result, update brand profile
    }
  }
}
```

**Build order implication:** Manus integration is the most complex component. Build it AFTER BrandProfile + Context Injection are working. Needs its own phase.

---

## Component Detail: Brand Selector UI

### Where It Lives

The brand selector should be a global component in `v2-shell.tsx`, visible in the header/sidebar. It sets context for the entire app, not just Hikaru.

### State Management

**Recommendation: URL search param + React Context, not just React state.**

```
/dashboard/v2/hikaru?brand=clxyz123
/dashboard/v2/creative-lab?brand=clxyz123
```

Reasons:
1. Shareable URLs that include brand context
2. Persists across page navigations
3. Server components can read it from searchParams
4. No need for a state management library

**Implementation:** A `BrandProvider` context in the V2 layout that reads from URL and provides `activeBrand` to all children.

```typescript
// src/app/dashboard/v2/brand-context.tsx
'use client';
import { createContext, useContext } from 'react';
import { useSearchParams } from 'next/navigation';

interface BrandContextType {
  activeBrandId: string | null;
  activeBrand: BrandProfile | null; // fetched via SWR/React Query
  setBrand: (id: string) => void;
}

export const BrandContext = createContext<BrandContextType>({...});

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const brandId = searchParams.get('brand');
  // SWR fetch of brand profile...
  // setBrand updates URL param
}
```

**Build order implication:** Brand selector depends on BrandProfile CRUD being functional. Build after CRUD API.

---

## Component Detail: Onboarding Wizard

### Architecture Decision: Client-Side Multi-Step, Not Server Actions

The wizard is a purely client-side multi-step form that makes one API call at the end. Reasons:
1. Steps are interdependent (brand name needed before competitor search)
2. User should be able to go back and edit
3. Final submit creates the profile and optionally kicks off enrichment
4. No need for server-side form state

### Steps

| Step | Fields | Notes |
|------|--------|-------|
| 1. Basics | Name, website, logo upload | Name is the only required field |
| 2. Voice | Brand voice, mission, positioning | All optional -- Manus can enrich later |
| 3. Audience | Demographics, interests, geo focus | Multi-select chips |
| 4. Competitors | Search + select from existing brands | Uses `/api/brands/search` |
| 5. Review | Summary + "Create" or "Create & Enrich" | Enrich = auto-Manus task |

**Build order implication:** Wizard is a UI concern. Build after Brand CRUD API works. Can be built in parallel with Manus integration since "Create & Enrich" can be added as an enhancement.

---

## Patterns to Follow

### Pattern 1: System Prompt Layering

**What:** Compose the final system prompt from modular layers rather than one monolithic string.
**When:** Always -- this is foundational.

```typescript
const systemPrompt = [
  HIKARU_BASE_PROMPT,          // Personality + formatting rules (existing)
  HIKARU_TOOLS_PROMPT,         // Tool usage instructions (existing, embedded in base)
  brandContext                  // Brand-specific context (new, optional)
    ? buildBrandSystemPrompt(brandContext)
    : null,
  HIKARU_CHART_PROMPT,         // Chart formatting rules (existing, embedded in base)
].filter(Boolean).join('\n\n---\n\n');
```

**Why:** Keeps each concern testable and swappable. Can A/B test brand context formats.

### Pattern 2: Fire-and-Forget with Webhook + Cron Safety Net

**What:** For Manus tasks, return immediately, rely on webhook for result, use cron as fallback.
**When:** Any async external API that takes > 30 seconds.

This is already the pattern used for `classify-poll` cron. Extend it.

### Pattern 3: Progressive Enhancement of Brand Profile

**What:** Start with minimal brand data, enrich over time.
**When:** Brand creation and ongoing usage.

```
Day 0: User creates profile with just name + website
Day 0: Auto-enrichment via Manus fills in insights
Week 1: User's chat history informs better context
Month 1: Ad performance data (if connected) enriches further
```

**Why:** Low friction onboarding. Don't gate features on complete profiles.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: LLM-as-Router for Every Message

**What:** Using Claude to classify every message before routing to Claude or Manus.
**Why bad:** Adds 500ms-1s latency to EVERY message. Doubles API cost for Claude messages. The decision space (2 options) doesn't warrant an LLM.
**Instead:** Keyword matching + optional UI toggle ("Deep Research" button).

### Anti-Pattern 2: Holding Connections Open for Manus

**What:** Keeping the SSE connection open while waiting for Manus (2-10 min).
**Why bad:** Vercel functions time out. Even with maxDuration=300, Manus can take longer. Wastes serverless compute time.
**Instead:** Return a `manus_started` event immediately, have the client poll a lightweight status endpoint.

### Anti-Pattern 3: Storing Brand Context in the Chat Message History

**What:** Including full brand context as a user message or injecting it into the conversation history.
**Why bad:** Burns tokens on every subsequent message (context is repeated). Makes conversation history confusing when exported.
**Instead:** Inject brand context into the system prompt ONLY. It's excluded from user-visible history but included in every API call.

### Anti-Pattern 4: Separate "Brand Chat" vs "Generic Chat"

**What:** Creating a separate chat route/UI for brand-contextualized conversations.
**Why bad:** Duplicates UI code, confusing UX ("which chat do I use?"), harder to maintain.
**Instead:** Single Hikaru chat with optional brand context. Brand selector is external to chat. When active, context is injected transparently.

### Anti-Pattern 5: Blocking Onboarding on Enrichment

**What:** Making users wait for Manus enrichment before they can use the brand profile.
**Why bad:** Manus takes 2-10 minutes. Users will abandon.
**Instead:** Create profile immediately with user-provided data. Enrichment runs in background. UI shows "Enriching..." badge. Profile works without enrichment.

---

## Suggested Build Order

Based on dependency analysis, here is the recommended phase structure:

```
Phase 1: BrandProfile Schema + CRUD
  |- Prisma model (BrandProfile + ManusTask)
  |- /api/brands/profile/ (CRUD endpoints)
  |- Brand selector UI component
  |- BrandProvider context in v2 layout
  Dependencies: None (pure addition)

Phase 2: Context Injection into Hikaru
  |- buildBrandSystemPrompt() lib function
  |- Modify /api/chat/hikaru/route.ts to accept brandId
  |- Load profile, inject into system prompt
  |- UI: pass activeBrandId from BrandContext to chat API calls
  Dependencies: Phase 1 (BrandProfile must exist)

Phase 3: Onboarding Wizard
  |- Multi-step form component
  |- Brand search for competitor selection
  |- Logo upload to R2
  Dependencies: Phase 1 (CRUD API must work)

Phase 4: Manus Integration + Auto-Enrichment
  |- Manus API client (src/lib/manus.ts)
  |- /api/brands/enrich/ (create task)
  |- /api/brands/enrich/webhook/ (receive result)
  |- /api/brands/enrich/poll/ (cron safety net)
  |- vercel.json cron entry
  |- Parse Manus result into BrandProfile fields
  Dependencies: Phase 1 (ManusTask model), Phase 3 (wizard triggers enrichment)

Phase 5: Message Router (Claude vs Manus in Chat)
  |- routeMessage() classifier function
  |- Manus path in Hikaru route
  |- Client-side polling for Manus results
  |- UI: "Deep Research" mode indicator
  Dependencies: Phase 2 (context injection), Phase 4 (Manus integration)
```

### Dependency Graph

```
Phase 1 (Schema + CRUD)
  |
  +---> Phase 2 (Context Injection)
  |       |
  |       +---> Phase 5 (Message Router)
  |
  +---> Phase 3 (Onboarding Wizard)
  |       |
  |       +---> Phase 4 (Manus Integration)
  |               |
  |               +---> Phase 5 (Message Router)
```

**Phases 2 and 3 can be built in parallel** after Phase 1.
**Phase 5 requires both Phase 2 and Phase 4** to be complete.

---

## Vercel Infrastructure Considerations

### Cron Job Updates

Add to `vercel.json`:

```json
{
  "path": "/api/brands/enrich/poll",
  "schedule": "*/5 * * * *"
}
```

This matches the existing `classify-poll` pattern -- poll every 5 minutes for completed Manus tasks.

### Function Timeouts

| Route | Recommended maxDuration | Reason |
|-------|------------------------|--------|
| `/api/chat/hikaru` | 120s (existing) | Claude tool loop can be multi-turn |
| `/api/brands/profile` | 10s (default) | Simple CRUD |
| `/api/brands/enrich` | 30s | Just creates Manus task |
| `/api/brands/enrich/webhook` | 30s | Processes result, updates DB |
| `/api/brands/enrich/poll` | 60s | May poll multiple tasks |

### Environment Variables

New env vars needed:
- `MANUS_API_KEY` -- Manus API authentication
- `MANUS_WEBHOOK_SECRET` -- For verifying webhook signatures (RSA public key)

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| BrandProfile schema design | HIGH | Based on existing schema patterns in codebase |
| Context injection approach | HIGH | System prompt injection is standard, matches existing pattern |
| Message router architecture | HIGH | Simple keyword approach is proven, LLM routing is premature |
| Manus API integration | MEDIUM | Endpoints and task states confirmed via multiple sources, but exact response format needs verification against live docs |
| Webhook pattern | MEDIUM-HIGH | Manus docs confirm webhook support with RSA-SHA256; exact payload format needs verification |
| Cron safety net | HIGH | Already using this exact pattern for classify-poll |
| Build order | HIGH | Dependency analysis is based on concrete technical requirements |

---

## Sources

- Existing codebase: `/api/chat/hikaru/route.ts`, `prisma/schema.prisma`, `vercel.json`
- [Manus API - Create Task](https://open.manus.im/docs/api-reference/create-task)
- [Manus API - Webhooks](https://open.manus.im/docs/webhooks)
- [Manus API - Introduction](https://open.manus.im/docs)
- [Getting Started with Manus Agent API](https://new2026.medium.com/getting-started-with-the-manus-agent-api-full-code-tips-costing-eef90bacd06c)
- [Next.js after() function](https://nextjs.org/docs/app/api-reference/functions/after)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Inngest - Long-running background functions on Vercel](https://www.inngest.com/blog/vercel-long-running-background-functions)
