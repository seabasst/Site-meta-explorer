# Domain Pitfalls

**Domain:** Brand Profiling, Onboarding Wizards, Multi-Model AI Routing, Context Injection for Ad Intelligence SaaS
**Researched:** 2026-04-03
**Project:** Facebook Ad Explorer v9.0 (Brand Profile & AI Context System)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken core features.

---

### Pitfall 1: Context Window Stuffing Degrades AI Quality

**What goes wrong:** The full BrandProfile (voice, audience, visual identity, competitors, pain points, positioning) is naively serialized and injected into every Claude system prompt. As brand profiles grow richer over time, the injected context balloons to thousands of tokens. Research shows LLM accuracy drops over 30% when relevant information sits in middle positions of the context ("lost in the middle" effect). The AI starts ignoring brand context or producing generic responses despite having the data.

**Why it happens:** Developers treat the context window as a dumping ground. "More context = better responses" is the intuitive but wrong assumption. The existing Hikaru system prompt is already ~600 tokens. Adding a full brand profile with competitors, pain points, and ad history could easily add 2,000-4,000 tokens of structured data per request.

**Consequences:** Users set up detailed brand profiles but see no improvement in AI output quality. Worse, Claude may latch onto irrelevant details (e.g., a hex color code) while ignoring the brand voice description. Token costs increase significantly with no quality gain.

**Prevention:**
- Design a **context budget system**: allocate fixed token budgets per context section (e.g., 200 tokens for voice, 150 for audience, 100 for visual identity)
- Build a **context compiler** that selects and condenses profile fields relevant to the current query type. A chat about "hook lines" needs voice + audience, not hex colors
- Place brand context at the **beginning** of the system prompt (before tool descriptions), not in the middle
- Use structured XML tags to delimit sections: `<brand_voice>`, `<target_audience>`, `<competitors>` so the model can selectively attend
- Measure quality with A/B tests: responses with vs. without brand context injection

**Detection:** AI responses that ignore brand voice despite profile being set. Token cost per chat message increasing over time. Users saying "it doesn't feel personalized."

**Confidence:** HIGH (well-documented LLM behavior, verified by multiple research papers on context window limitations)

**Phase:** Context Injection system design -- must be addressed in the architecture phase before any prompt wiring.

---

### Pitfall 2: Manus Polling Timeout on Vercel Serverless

**What goes wrong:** Manus tasks take 30 seconds to 5+ minutes to complete. The developer creates a Next.js API route that submits a task to Manus and polls for completion before returning the result. The Vercel function times out (default 15s on Pro, max 300s) long before Manus finishes. The user sees a 504 error. Retry logic makes it worse by spawning duplicate tasks.

**Why it happens:** The synchronous request-response mental model is deeply ingrained. The existing Hikaru chat route already uses `maxDuration = 120` with a streaming response, but Manus is fundamentally different: it is not a streaming API. It is a fire-and-forget async task system with four states: `running`, `pending`, `completed`, `error`.

**Consequences:** Every Manus interaction fails for complex tasks. Users lose confidence in the "deep research" feature. Duplicate tasks burn credits ($1.50-$9.00 per task). The `pending` state (Manus needs user input) is never handled, causing tasks to hang indefinitely.

**Prevention:**
- Implement a **three-endpoint pattern**: (1) POST to create task and store task ID in DB, return immediately with 202 + task ID; (2) GET to poll task status from DB; (3) Webhook endpoint for Manus to push completion
- Store Manus task state in a `ManusTask` table: `{ id, taskId, brandId, userId, status, prompt, result, creditsUsed, createdAt, completedAt }`
- Client polls the **internal** status endpoint (not Manus directly) with exponential backoff: 2s, 4s, 8s, 16s, max 30s
- Handle the `pending` state explicitly: surface Manus's clarifying question to the user in the UI
- Use Vercel's `waitUntil` or `after()` (Next.js) to fire the Manus task creation after returning the initial response
- Set a **hard timeout** (10 minutes) after which the task is marked failed and credits are logged as wasted

**Detection:** 504 errors on Manus-related routes. Duplicate tasks in Manus dashboard. Tasks stuck in `running` state for hours.

**Confidence:** HIGH (Vercel timeout limits are documented; Manus task states confirmed via API docs; existing codebase already uses `maxDuration = 120`)

**Phase:** Manus API integration -- the very first task in the Manus phase. Must be built before any UI work.

---

### Pitfall 3: Onboarding Wizard State Loss on Navigation

**What goes wrong:** User fills out 4 of 6 wizard steps (brand name, voice, audience, visual identity). They accidentally click the browser back button, or navigate to check something in the ad library, or the page refreshes. All wizard data is lost. They have to start over from step 1.

**Why it happens:** Each wizard step is a separate component that unmounts when moving between steps. If state lives only in the step component, it dies with the component. React's default behavior is to destroy component state on unmount. The existing codebase uses `useState` heavily (see strategy-view.tsx, creative-lab page.tsx) without persistence layers.

**Consequences:** Users abandon the onboarding flow. Brand profiles are never completed. Partially-entered data creates inconsistent states if auto-saved incorrectly.

**Prevention:**
- Lift ALL wizard state to a **single parent component** or use a state machine (XState or a simple reducer)
- **Auto-save to database** after each step completion, not just at the end. Use a `status: 'draft' | 'complete'` field on BrandProfile
- Save draft state to `localStorage` as backup for accidental page refreshes
- Add a `beforeunload` event listener to warn users about unsaved changes
- Use React Hook Form with a **single form instance** spanning all steps (not one form per step)
- Implement `router.beforePopState` or `next/navigation` interception to warn on back-button

**Detection:** Analytics showing high drop-off between wizard steps. BrandProfile records with only 1-2 fields filled. Support tickets about "lost my progress."

**Confidence:** HIGH (well-documented React state management pattern, confirmed by multiple library maintainers and tutorials)

**Phase:** Onboarding wizard implementation. Must be part of the wizard architecture, not bolted on after.

---

### Pitfall 4: BrandProfile Schema Becomes a God Object

**What goes wrong:** BrandProfile starts clean with ~10 fields. Over time, every feature adds fields: Manus adds `lastManusAnalysis`, auto-enrichment adds `enrichmentHistory`, competitors add `competitorProfiles[]`, the wizard adds `wizardProgress`. Within two milestones, BrandProfile has 40+ fields, half of which are JSON blobs. Queries become slow. Migrations become scary. The model is impossible to reason about.

**Why it happens:** "Just add one more field" is the path of least resistance. The existing schema already shows this pattern: `BrandGuidelines` has flat fields, JSON arrays, and nullable columns all mixed together. `AdLibraryBrand` has 15+ fields spanning ingestion control, user requests, and aggregated demographics.

**Consequences:** Prisma migrations take longer. Schema changes risk data loss. The `BrandProfile` query pulls megabytes of data when you only need the brand name. Frontend components receive the entire profile when they need two fields.

**Prevention:**
- Design BrandProfile as **multiple related tables** from day one:
  - `BrandProfile` (core: name, userId, status, createdAt)
  - `BrandVoice` (voice description, mission, tone keywords)
  - `BrandAudience` (demographics, interests, pain points)
  - `BrandVisualIdentity` (colors, logo, reference images)
  - `BrandCompetitorSet` (competitor brand IDs, positioning)
  - `BrandAIContext` (compiled prompt cache, last enrichment date)
- Use Prisma `select` and `include` rigorously -- never `findFirst()` without a select clause
- Create a **compiled context cache** (`BrandAIContext`) that is rebuilt when profile changes, so the AI prompt assembly never touches raw profile tables
- Set a rule: any JSON column must have a documented schema and a maximum size

**Detection:** Migration files growing in complexity. API routes that fetch BrandProfile but only use 3 fields. JSON columns with undocumented shapes.

**Confidence:** HIGH (observable anti-pattern already present in current schema with BrandGuidelines and AdLibraryBrand)

**Phase:** Database schema design -- the very first task in the BrandProfile phase. Table structure must be decided before any CRUD is built.

---

### Pitfall 5: Dual-Model Routing Creates Inconsistent User Experience

**What goes wrong:** Claude handles fast streaming chat; Manus handles deep research. But the UI treats them as interchangeable. Users ask a question in chat, get a Claude response in 3 seconds. Then they ask a slightly different question that routes to Manus, and the UI goes silent for 2 minutes with no explanation. Or worse: the routing is opaque and users cannot predict which model will respond.

**Why it happens:** The routing decision is made server-side based on heuristics (query complexity, keywords, etc.) without communicating the decision to the user. The existing Hikaru chat already has a "thinking" indicator for tool calls, but a 3-second tool call and a 3-minute Manus task require fundamentally different UI treatments.

**Consequences:** Users think the app is broken when Manus is processing. They refresh the page, losing the pending task. They ask the same question again, doubling costs. Trust in the AI feature erodes.

**Prevention:**
- Make routing **explicit, not implicit**: give users a clear choice between "Quick answer" (Claude) and "Deep research" (Manus) modes
- If auto-routing, immediately show a **mode indicator**: "This requires deep research. Estimated time: 2-4 minutes" with a progress timeline
- Show Manus's intermediate states: "Browsing web...", "Analyzing data...", "Compiling report..." (Manus provides step-level progress)
- Allow users to **cancel** a Manus task and fall back to Claude for a quick answer
- Never auto-route to Manus for follow-up questions in a chat thread -- it breaks conversational flow
- Store the pending Manus task in DB so page refreshes resume polling, not lose the task

**Detection:** Users sending duplicate messages within 30 seconds. High Manus task cancellation rate. Support tickets about "the AI stopped responding."

**Confidence:** HIGH (architectural principle; confirmed by Microsoft's multi-model Copilot strategy documentation which emphasizes transparency in model routing)

**Phase:** Chat UI + routing layer -- must be designed holistically, not as separate Claude and Manus integrations.

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded experience.

---

### Pitfall 6: Auto-Enrichment Creates Runaway Costs

**What goes wrong:** The system re-analyzes brand profiles whenever new ads are ingested. With 514+ brands being tracked and weekly ingestion cycles, this triggers hundreds of Claude API calls per week. Each enrichment call uses the full brand profile context (1,000+ tokens input) plus ad data. Monthly AI costs spiral from $50 to $500+ with no user-visible benefit.

**Why it happens:** "Keep profiles fresh" sounds like a good idea. But most brand voices and audiences do not change week-to-week. The enrichment logic lacks change detection -- it re-analyzes even when new ads are identical in style to existing ones.

**Prevention:**
- Implement **change detection** before triggering enrichment: compare new ad classifications against existing profile. Only re-enrich if distribution shift exceeds a threshold (e.g., >20% change in messaging angles)
- Set enrichment to **manual trigger + optional scheduled** (monthly, not per-ingestion)
- Use a cost budget: `max_enrichment_cost_per_month` setting that pauses auto-enrichment when exceeded
- Use the cheapest model (Haiku) for change detection; only escalate to Sonnet for actual profile updates
- Log every enrichment call to `ApiCostLog` with `operation: 'brand_enrichment'` so costs are trackable

**Detection:** `ApiCostLog` showing unexpected spikes in `brand_enrichment` operations. Enrichment results that are identical to previous run.

**Confidence:** MEDIUM (cost concern is real based on existing `ApiCostLog` tracking pattern; exact numbers are estimates)

**Phase:** Auto-enrichment feature -- add cost controls before enabling any automatic triggers.

---

### Pitfall 7: Brand Selector in Chat Breaks Conversation Context

**What goes wrong:** User is chatting about Brand A. They switch the brand selector to Brand B mid-conversation. The system injects Brand B's profile into the system prompt, but the conversation history still contains analysis of Brand A's ads. Claude gets confused, mixing up data from both brands. Responses become incoherent.

**Why it happens:** The brand selector changes the system prompt but does not reset the conversation. The existing Hikaru implementation maintains a `currentMessages` array that accumulates across the full session (see hikaru/route.ts lines 948-1016). Changing the brand context mid-stream creates a prompt/history mismatch.

**Prevention:**
- When brand changes, **start a new conversation** (clear message history) with an explicit system message: "Now analyzing [Brand B]"
- Alternatively, **lock the brand selector** during an active conversation and require explicit "Start new analysis" action
- If supporting multi-brand conversations, prepend each message with a `[Brand: X]` tag so the model can track which brand is being discussed
- Store `brandId` per conversation thread, not as a global setting

**Detection:** AI responses that reference Brand A data when user is asking about Brand B. Confusion in comparative queries.

**Confidence:** HIGH (directly observable from existing Hikaru chat architecture where system prompt is static per session)

**Phase:** Brand selector + chat integration -- must be addressed when adding brand context to Hikaru.

---

### Pitfall 8: Manus Credits Wasted on Failed or Duplicate Tasks

**What goes wrong:** Manus charges credits for partial work on failed tasks. Network errors, user cancellations, and poorly-formed prompts all consume credits. Without tracking, the team has no visibility into credit burn. Complex tasks can cost 500-900 credits ($5-9) each, and there is no way to preview cost before starting.

**Why it happens:** Manus's pricing model is unusual: credits are consumed during processing, not on completion. Failed tasks still cost partial credits. The API provides no cost estimate endpoint. Without explicit tracking, credit spend is invisible until the monthly bill arrives.

**Prevention:**
- Build a `ManusTask` table that logs every task with `creditsUsed` (populated from Manus response)
- Display estimated credit cost to user before confirming a Manus task: "This deep research will use approximately 150-500 credits ($1.50-$5.00)"
- Implement a **per-user daily credit cap** to prevent runaway spending
- Validate prompts client-side before sending to Manus (check minimum length, required context)
- Deduplicate: check if an identical prompt was submitted in the last hour before creating a new task
- Cache Manus results aggressively -- if the same brand + same question was asked recently, serve cached result

**Detection:** Monthly Manus bill exceeding budget. High ratio of failed/cancelled tasks to completed tasks.

**Confidence:** HIGH (Manus pricing model confirmed via official help center documentation)

**Phase:** Manus integration -- cost tracking must be built alongside the task submission system, not after.

---

### Pitfall 9: Onboarding Wizard Blocks Value Discovery

**What goes wrong:** New user signs up, immediately hits a 6-step mandatory wizard. They have not yet seen the product's value. The wizard asks for brand voice and visual identity -- information that requires thought and preparation. User bounces. Conversion rate drops.

**Why it happens:** The team conflates "data collection" with "onboarding." A wizard that asks for brand hex colors before the user has seen a single ad analysis is optimizing for data completeness over user activation.

**Prevention:**
- Make the wizard **skippable** with a "Set up later" option on every step
- Implement **progressive profiling**: collect minimum data first (brand name + category), let user explore the product, then prompt for additional profile fields contextually
- Show a "profile completeness" indicator (like LinkedIn) that encourages filling in details over time
- Gate features on specific profile fields, not the whole profile: "Add your brand voice to get personalized recommendations" at the moment the user tries to use that feature
- Start with just brand selection (pick from existing 514+ brands in DB, or add new) -- this requires zero creative input from the user

**Detection:** High wizard abandonment rate. Users completing wizard but never returning. Low profile completeness scores.

**Confidence:** HIGH (well-documented product onboarding anti-pattern; LinkedIn-style progressive profiling is industry standard)

**Phase:** Onboarding wizard UX design -- decide skip/progressive strategy before building any steps.

---

### Pitfall 10: Existing BrandGuidelines Model Creates Migration Confusion

**What goes wrong:** The schema already has a `BrandGuidelines` model with voice, demographics, interests, colors, logo, and reference images. The new `BrandProfile` needs the same fields plus more. The team either (a) tries to extend BrandGuidelines and breaks existing Creative Lab features, or (b) creates a parallel BrandProfile model with overlapping fields, causing data duplication and confusion about which is the source of truth.

**Why it happens:** BrandGuidelines was built for Phase 56.1 (Creative Lab image generation). It is tightly coupled to the generation pipeline via `generate-config` and `generate-batch` endpoints. The new BrandProfile has a broader purpose (AI context, onboarding, chat personalization). They overlap but are not the same thing.

**Consequences:** Two models with similar data. Features reference different models. Users edit their brand info in one place but the other place shows stale data. Migration from BrandGuidelines to BrandProfile risks data loss.

**Prevention:**
- **Migrate, don't duplicate**: Create the new BrandProfile tables, then write a one-time migration script that copies BrandGuidelines data into the new structure
- Update all existing Creative Lab endpoints (`generate-config`, `generate-batch`, `generate-brief`) to read from BrandProfile instead of BrandGuidelines
- Keep `BrandGuidelines` temporarily as a read-only alias/view until all references are migrated
- Drop `BrandGuidelines` model only after verification that no code references it
- Test the migration path: `BrandGuidelines data -> BrandProfile -> Creative Lab features still work`

**Detection:** Two different "brand settings" pages in the UI. API responses returning different brand data depending on which model they query.

**Confidence:** HIGH (directly observable from current schema -- BrandGuidelines already exists with overlapping fields)

**Phase:** BrandProfile schema design -- must explicitly plan the BrandGuidelines migration before creating new tables.

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable.

---

### Pitfall 11: Brand Profile Completeness Gating is Too Strict or Too Loose

**What goes wrong:** If too strict: users cannot use chat or Creative Lab until they fill in every profile field, creating friction. If too loose: AI generates with empty context and produces generic output, making the feature seem useless.

**Prevention:**
- Define **minimum viable profile** per feature: chat needs `brandName` only; Creative Lab needs `brandName + category`; personalized recommendations need `brandName + voice + audience`
- Show clear messaging about what profile data improves which feature
- Provide sensible defaults: infer category from AdLibraryBrand data, suggest voice based on existing ad copy analysis

**Detection:** Features that silently fall back to generic mode without telling the user. Features that hard-block with unhelpful "complete your profile" errors.

**Confidence:** MEDIUM

**Phase:** Every feature that consumes BrandProfile data -- each must define its own minimum requirements.

---

### Pitfall 12: Webhook Endpoint Security for Manus Callbacks

**What goes wrong:** The Manus webhook endpoint is a public URL on Vercel. Without authentication, anyone can POST fake completion events, potentially injecting malicious content into the database or triggering downstream actions.

**Prevention:**
- Validate the webhook signature (if Manus provides one) or use a shared secret in the webhook URL path
- Verify the `taskId` in the webhook payload matches a task in the `ManusTask` table
- Validate response content before storing: sanitize HTML, check for prompt injection attempts in Manus output
- Rate-limit the webhook endpoint

**Detection:** Unexpected webhook calls with unknown task IDs. ManusTask records with suspicious content.

**Confidence:** MEDIUM (standard webhook security; Manus webhook authentication details need verification during implementation)

**Phase:** Manus webhook integration.

---

### Pitfall 13: Brand Selector UI Breaks on High Brand Count

**What goes wrong:** If a user tracks 20+ competitors alongside their own brand, a simple dropdown becomes unusable. The selector renders slowly, is hard to navigate, and does not show enough context to distinguish brands with similar names.

**Prevention:**
- Use a searchable combobox (like the existing `brand-search.tsx` pattern in Creative Lab) rather than a plain select
- Show brand logo/icon, category, and ad count alongside the name
- Limit displayed brands to "own brand + top 5 competitors" with "View all" expansion
- Cache the brand list client-side to prevent re-fetching on every selector open

**Detection:** Selector taking >500ms to render. Users unable to find their desired brand.

**Confidence:** HIGH (existing `brand-search.tsx` proves the pattern is already needed and available)

**Phase:** Brand selector UI component.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| BrandProfile schema | God object / BrandGuidelines overlap (#4, #10) | Multi-table design + migration plan | Critical |
| Onboarding wizard | State loss on navigation (#3) | Single parent state + auto-save drafts | Critical |
| Onboarding wizard | Blocking value discovery (#9) | Progressive profiling, skip option | Moderate |
| Context injection | Context stuffing degrades quality (#1) | Context budget + compiler + XML tags | Critical |
| Manus integration | Serverless timeout (#2) | Three-endpoint pattern + DB task table | Critical |
| Manus integration | Credit waste (#8) | Cost tracking + dedup + caching | Moderate |
| Manus integration | Webhook security (#12) | Signature validation + rate limiting | Minor |
| Dual-model routing | UX inconsistency (#5) | Explicit mode selector + progress UI | Critical |
| Brand selector in chat | Context mismatch (#7) | New conversation on brand switch | Moderate |
| Auto-enrichment | Runaway costs (#6) | Change detection + cost budget | Moderate |
| Profile completeness | Too strict/loose gating (#11) | Per-feature minimum requirements | Minor |
| Brand selector UI | Performance on high count (#13) | Searchable combobox pattern | Minor |

## Sources

- [Agenta: Top Techniques to Manage Context Length in LLMs](https://agenta.ai/blog/top-6-techniques-to-manage-context-length-in-llms) -- context window limitations and management
- [Atlan: LLM Context Window Limitations in 2026](https://atlan.com/know/llm-context-window-limitations/) -- effective vs advertised context windows, "lost in the middle" research
- [Context Studios: Context Engineering Best Practices](https://www.contextstudios.ai/blog/context-engineering-how-to-build-reliable-llm-systems-by-designing-the-context) -- structured context management
- [Microsoft Azure: Asynchronous Request-Reply Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply) -- three-endpoint polling pattern
- [Vercel KB: What can I do about functions timing out?](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out) -- Vercel timeout limits and workarounds
- [Inngest: Long-running background functions on Vercel](https://www.inngest.com/blog/vercel-long-running-background-functions) -- serverless long-task patterns
- [Manus Help Center: Credits consumption rules](https://help.manus.im/en/articles/11711097-what-are-the-rules-for-credits-consumption-and-how-can-i-obtain-them) -- Manus pricing model
- [Manus Help Center: Cost estimation before task](https://help.manus.im/en/articles/13185575-is-there-a-way-to-check-how-many-credits-a-task-will-cost-before-i-begin) -- no pre-task cost estimate
- [EESel: Manus AI pricing 2026](https://www.eesel.ai/blog/manus-ai-pricing) -- credit costs and task pricing
- [GitHub Gist: Manus AI Architecture Investigation](https://gist.github.com/renschni/4fbc70b31bad8dd57f3370239dccd58f) -- Manus internal architecture
- [Orbitive: Prompt Injection Guardrails for Enterprise](https://orbitive.tech/blog/prompt-injection-guardrails-llm-copilots-2025) -- context security
- [LogRocket: Multi-step form with React Hook Form and Zod](https://blog.logrocket.com/building-reusable-multi-step-form-react-hook-form-zod/) -- wizard state management
- [Codedaily: Form Wizard with Data Loss Prevention](https://www.codedaily.io/tutorials/Create-a-Form-Wizard-with-Data-Loss-Prevention-using-Formik-and-React-Router) -- navigation data loss prevention
