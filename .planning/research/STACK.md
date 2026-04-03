# Technology Stack: v9.0 Brand Profile & AI Context System

**Project:** Facebook Ad Explorer - v9.0 milestone
**Researched:** 2026-04-03
**Scope:** NEW stack elements only. Existing stack (Next.js 16, React 19, Prisma 7, Neon PostgreSQL, R2, Auth.js, Stripe) is not re-evaluated.

---

## Recommended New Stack

### AI Layer: Keep Raw Anthropic SDK, Do NOT Migrate to Vercel AI SDK

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| `@anthropic-ai/sdk` | ^0.82.0 (current: ^0.78.0) | Claude streaming + tool use for Hikaru chat | HIGH |

**Rationale:** The codebase already has a working agentic tool loop with manual SSE streaming in `src/app/api/chat/hikaru/route.ts`. This custom implementation gives you full control over the tool execution loop, thinking events, and the `:::chart` fenced block protocol. Migrating to Vercel AI SDK (`ai@6.x` + `@ai-sdk/anthropic@3.x`) would require rewriting all of this for marginal benefit (the `useChat` hook saves boilerplate, but you already have the SSE plumbing working).

**What to change:** Bump `@anthropic-ai/sdk` from `^0.78.0` to `^0.82.0` for latest streaming improvements and 1M token context window support on newer models. The SDK API is stable -- this is a patch bump, no breaking changes.

**What NOT to use:**
- `ai` (Vercel AI SDK) -- unnecessary abstraction layer over what you already have. Would force rewrite of tool loop and chart protocol for no gain.
- `@anthropic-ai/claude-agent-sdk` -- this is for building Claude Code-style autonomous agents, not chat interfaces. Overkill for your use case.

### Manus API Integration: Direct HTTP Client (No SDK)

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| Native `fetch` | Built-in | HTTP calls to Manus API v2 | HIGH |

**Rationale:** Manus has no official TypeScript SDK. The API is a simple REST interface (create task, poll status, receive webhook). Building a thin wrapper around `fetch` is the right approach -- no need for a third-party SDK.

**Manus API key facts (verified from official docs at open.manus.im):**
- **Base URL:** `https://api.manus.im/v2` (v1 is deprecated)
- **Auth:** Bearer JWT token
- **Task creation:** `POST /v2/tasks` with `taskMode` (chat|adaptive|agent) and `agentProfile` (speed|quality)
- **Task polling:** `GET /v2/tasks/:id` for status
- **Webhooks:** RSA-SHA256 signed callbacks for async completion
- **File upload:** Presigned URLs via `/v2/files`, attach by `file_id`
- **Cost:** ~150 credits per typical task (~$1.50 on consumer tiers)

**Architecture recommendation:** Create a `src/lib/manus/client.ts` wrapper:
```typescript
// Thin wrapper -- NOT a full SDK, just typed fetch calls
export async function createManusTask(prompt: string, opts?: ManusTaskOptions): Promise<ManusTask>
export async function getManusTask(taskId: string): Promise<ManusTask>
export async function cancelManusTask(taskId: string): Promise<void>
```

**What NOT to use:**
- `@aimlapi/manus` or community SDKs -- unofficial, may lag behind API v2
- OpenManus / self-hosted Manus alternatives -- defeats the purpose of using Manus's deep research capabilities

**Confidence:** MEDIUM -- Manus API v2 is new (v1 recently deprecated). The exact endpoint shapes may evolve. Build the wrapper to be easy to update.

### Background Job Processing: Inngest

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| `inngest` | latest (^3.x) | Async job orchestration for Manus tasks + auto-enrichment | HIGH |

**Rationale:** v9.0 needs background processing for:
1. **Manus deep research tasks** (minutes to complete, need polling/webhooks)
2. **Brand auto-enrichment** (scrape website, extract colors/voice/audience on profile creation)
3. **Context pre-computation** (rebuild brand context when new ads are ingested)

**Why Inngest over alternatives:**

| Criteria | Inngest | Trigger.dev | QStash | Vercel Cron |
|---|---|---|---|---|
| Vercel integration | Native, first-class | Good but separate infra | Good, lightweight | Built-in |
| Multi-step workflows | Yes (step functions) | Yes | No (single delivery) | No |
| Retries with backoff | Yes, automatic | Yes | Yes, basic | No |
| Sleep/wait between steps | Yes (`step.sleep()`) | Yes | No | No |
| Free tier | 50K runs/mo | 5K runs/mo | 500 msgs/day | Varies by plan |
| Setup complexity | Low (SDK + API route) | Medium (separate deploy) | Low | Lowest |
| Long-running support | Yes (via step chaining) | Yes (dedicated compute) | No | No (300s max) |

**Why Inngest wins:** Manus integration is a multi-step workflow: create task -> poll/wait for completion -> process results -> store in DB. Inngest's `step.waitForEvent()` and `step.sleep()` are purpose-built for this. QStash is too primitive (just HTTP delivery). Trigger.dev is good but requires separate infrastructure and has a smaller free tier.

**What NOT to use:**
- Vercel Cron alone -- 300s max execution, no workflow orchestration, no retries
- QStash -- too primitive for multi-step Manus integration; fine for fire-and-forget but not for "wait for result, then process"
- Trigger.dev -- excellent but overkill; separate compute layer is unnecessary when Inngest runs within your Vercel functions
- Bull/BullMQ -- requires Redis infrastructure you don't have and don't need

### Context Injection: Prisma + Structured Prompt Assembly

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| Prisma (existing) | ^7.4.2 | BrandProfile data model + queries | HIGH |
| Zod (existing) | ^4.3.6 | Brand profile validation | HIGH |

**Rationale:** Context injection means assembling brand-specific data into the Hikaru system prompt before each message. This is a data layer + prompt engineering problem, not a library problem.

**Architecture:**
```typescript
// src/lib/brand-context.ts
export async function buildBrandContext(brandId: string): Promise<string> {
  // 1. Fetch BrandProfile from Prisma
  // 2. Fetch recent ad stats
  // 3. Fetch classification distribution
  // 4. Assemble into structured prompt section
  // Returns: markdown string injected into HIKARU_SYSTEM_PROMPT
}
```

**No new libraries needed.** The existing Prisma + Zod stack handles this. The BrandProfile model extends the existing `BrandGuidelines` model or replaces it.

**What NOT to use:**
- LangChain / LlamaIndex -- massive abstraction layers for RAG pipelines you don't need. You have structured data in PostgreSQL, not unstructured documents.
- Vector databases (Pinecone, Weaviate) -- your brand context is structured relational data, not embeddings. Prisma queries are faster and more predictable than vector similarity search for this use case.
- Prompt template libraries -- your prompt is a single system message with concatenated sections. Template literals are sufficient.

### Data Model Changes: Prisma Schema Extensions

**New model: `BrandProfile`**

This extends the existing `BrandGuidelines` model with richer context for AI injection. The current `BrandGuidelines` is user-scoped (tied to `User`). The new `BrandProfile` should be brand-scoped (tied to `AdLibraryBrand`) so context works for any brand the user selects in chat.

```prisma
model BrandProfile {
  id        String   @id @default(cuid())
  brandId   String   @unique
  brand     AdLibraryBrand @relation(fields: [brandId], references: [id], onDelete: Cascade)

  // Identity (from onboarding wizard or auto-enrichment)
  brandVoice       String?   // Tone description
  missionStatement String?
  tagline          String?
  website          String?
  logoUrl          String?

  // Target audience
  targetDemographics Json?    // { ageRanges, genders, interests, locations }

  // Visual identity
  primaryColor     String?
  secondaryColor   String?
  accentColor      String?

  // AI-enriched context (populated by auto-enrichment jobs)
  enrichedContext  Json?     // Structured AI analysis of brand's ad strategy
  competitorIds    String[]  // Brand IDs of key competitors

  // Manus deep research results
  manusResearchId  String?   // Last Manus task ID
  manusResearch    Json?     // Stored Manus research output
  manusResearchAt  DateTime?

  // Status
  isComplete       Boolean  @default(false) // Has minimum required fields
  source           String   @default("manual") // manual, auto-enriched, manus

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([brandId])
}
```

**New model: `ManusTask`** (for tracking async Manus jobs)

```prisma
model ManusTask {
  id             String   @id @default(cuid())
  externalTaskId String   @unique  // Manus API task ID
  brandId        String?  // Optional: which brand this research is for

  // Task config
  prompt         String
  taskMode       String   @default("agent")  // chat|adaptive|agent
  agentProfile   String   @default("quality") // speed|quality

  // Status
  status         String   @default("pending") // pending|running|completed|failed
  result         Json?    // Stored Manus output
  error          String?

  // Cost tracking
  creditsUsed    Int?

  // Timing
  submittedAt    DateTime @default(now())
  completedAt    DateTime?

  @@index([status])
  @@index([brandId])
}
```

**Confidence:** HIGH -- these are straightforward Prisma model additions that follow the existing codebase patterns.

### Chat History Storage

| Technology | Version | Purpose | Confidence |
|---|---|---|---|
| Prisma (existing) | ^7.4.2 | Chat message persistence for brand-scoped conversations | HIGH |

**Rationale:** Currently Hikaru chat is stateless (messages sent from client each request). For brand context injection to work well, conversations need persistence so the user can switch brands and resume context.

```prisma
model ChatConversation {
  id       String   @id @default(cuid())
  userId   String?
  brandId  String?  // Which brand context was active
  title    String?  // Auto-generated from first message

  messages ChatMessage[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId, updatedAt])
  @@index([brandId])
}

model ChatMessage {
  id             String   @id @default(cuid())
  conversationId String
  conversation   ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  role           String   // user|assistant|system
  content        String
  toolCalls      Json?    // Tool calls made during this message

  createdAt DateTime @default(now())

  @@index([conversationId, createdAt])
}
```

### Onboarding Wizard: No New Libraries

The brand onboarding wizard (multi-step form for creating BrandProfile) uses existing stack:
- React Hook Form (`react-hook-form@^7.71.1`) -- already installed
- Zod (`zod@^4.3.6`) -- already installed for validation
- Radix UI primitives -- already installed

**What NOT to use:**
- Multi-step form libraries (react-step-wizard, etc.) -- unnecessary abstraction. A simple state machine with `useState` for current step is cleaner.

---

## Summary: What to Install

```bash
# New dependency
npm install inngest

# Bump existing
npm install @anthropic-ai/sdk@latest
```

That is it. One new dependency. Everything else is built with existing stack or thin wrappers over `fetch`.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| AI SDK | Raw `@anthropic-ai/sdk` | Vercel AI SDK (`ai@6.x`) | Already have working tool loop + SSE; migration cost > benefit |
| Manus client | Native `fetch` wrapper | Community SDKs | No official TS SDK; community ones lag behind API v2 |
| Background jobs | Inngest | Trigger.dev | Separate infra unnecessary; smaller free tier |
| Background jobs | Inngest | QStash | Too primitive for multi-step Manus workflow |
| Background jobs | Inngest | Vercel Cron | No workflow orchestration, no retries, 300s limit |
| Context injection | Prisma queries + prompt assembly | LangChain | Massive abstraction for structured data; Prisma is faster |
| Context injection | Prisma queries + prompt assembly | Vector DB (Pinecone) | Data is relational, not unstructured; SQL beats vector search here |
| Chat persistence | Prisma PostgreSQL | Redis | Already have PostgreSQL; no need for another data store |
| Form wizard | React Hook Form + Zod | Multi-step libraries | Already installed; simple state is sufficient |

---

## Version Matrix

| Package | Current Version | Recommended Version | Action |
|---|---|---|---|
| `@anthropic-ai/sdk` | ^0.78.0 | ^0.82.0 | Bump |
| `inngest` | not installed | ^3.x (latest) | Install |
| `prisma` | ^7.4.2 | ^7.4.2 | No change |
| `@prisma/client` | ^7.4.2 | ^7.4.2 | No change |
| `react-hook-form` | ^7.71.1 | ^7.71.1 | No change |
| `zod` | ^4.3.6 | ^4.3.6 | No change |
| `next` | 16.1.2 | 16.1.2 | No change |

---

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Anthropic SDK approach | HIGH | Verified from npm, existing codebase works, stable API |
| Manus API integration | MEDIUM | API v2 is new, v1 recently deprecated; endpoint shapes may evolve |
| Inngest for background jobs | HIGH | Well-documented Vercel integration, battle-tested, generous free tier |
| Data model (BrandProfile) | HIGH | Follows existing Prisma patterns in codebase |
| Context injection approach | HIGH | Standard prompt engineering, no exotic dependencies |
| Chat persistence model | HIGH | Straightforward relational model |
| No vector DB needed | HIGH | All brand data is structured relational data |

---

## Sources

- [@anthropic-ai/sdk on npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- version 0.82.0 confirmed
- [Manus API Documentation](https://manus.im/docs/integrations/manus-api) -- official REST API docs
- [Manus API Introduction](https://open.manus.im/docs) -- API v2 reference, task modes, agent profiles
- [Manus Webhooks](https://open.manus.im/docs/webhooks) -- webhook verification with RSA-SHA256
- [Manus Pricing](https://www.getaiperks.com/en/articles/manus-ai-pricing) -- credit-based pricing, ~150 credits per task
- [Inngest + Vercel Integration](https://www.inngest.com/blog/vercel-integration) -- first-class Vercel support
- [Next.js Background Jobs Comparison](https://www.hashbuilds.com/articles/next-js-background-jobs-inngest-vs-trigger-dev-vs-vercel-cron) -- Inngest vs Trigger.dev vs Vercel Cron
- [Vercel AI SDK](https://ai-sdk.dev/docs/introduction) -- evaluated and rejected for this use case
- [Prisma 7 Release](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0) -- current version confirmed
- [Anthropic Platform Release Notes](https://platform.claude.com/docs/en/release-notes/overview) -- streaming improvements, 1M context
