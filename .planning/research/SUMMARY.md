# Research Summary: v9.0 Brand Profile & AI Context System

**Domain:** Ad Intelligence SaaS — brand profiling, AI context injection, dual-model routing
**Researched:** 2026-04-03
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

v9.0 adds brand awareness to the platform's AI features. The research reveals a surprisingly lean implementation path: **one new dependency** (Inngest for background jobs), a thin fetch wrapper for Manus API, and structured Prisma models feeding into system prompt injection. No vector databases, no LangChain, no Vercel AI SDK migration needed.

The critical insight across all four research dimensions: **context injection quality is the make-or-break factor**. Naive full-profile injection degrades LLM accuracy by 30%+. A "context compiler" pattern — budget-limited, query-aware selection of profile fields — is essential.

The second critical insight: **Manus is fundamentally async** and must not be forced into the synchronous chat pattern. Fire-and-forget with webhook + cron safety net (already proven in the classify-poll pattern) is the right approach.

---

## Key Findings by Dimension

### Stack (HIGH confidence)
- **One new dependency:** `inngest` for background job orchestration (Manus polling, auto-enrichment)
- **Keep raw Anthropic SDK** — existing agentic tool loop + SSE + :::chart protocol works well; Vercel AI SDK migration would cost without benefit
- **Manus API v2 is REST-only** — build a thin ~50-line fetch wrapper, no SDK exists
- **No vector DB or LangChain needed** — brand context is structured relational data, Prisma queries beat vector search
- **Bump `@anthropic-ai/sdk`** from ^0.78.0 to ^0.82.0

### Features (MEDIUM-HIGH confidence)
- **Brand profile + context injection is table stakes** — Jasper, HubSpot, Microsoft Copilot all have it
- **Auto-enrichment from ad data is the killer differentiator** — no competitor has real-time ad intelligence to auto-populate brand context
- **Dual-model routing (Manus) is Phase 3 material** — core brand-aware AI ships fully without it
- **Onboarding must be opt-in, never blocking** — platform's open-access browsing is an asset
- **Context token budget ~2K tokens max** — critical design constraint for prompt injection

### Architecture (MEDIUM-HIGH confidence)
- **Context injection = system prompt enhancement** — zero changes to streaming/tool infrastructure
- **Message router should be keyword-based, not LLM-based** — 500ms+ latency and doubled cost for a 2-option decision space isn't worth it
- **Brand selector via URL params** (`?brand=clxyz123`) — shareable, survives navigation, works with server components
- **5-phase build order:** Schema/CRUD -> Context Injection + Onboarding (parallel) -> Manus -> Message Router
- **Fire-and-forget + webhook + cron** for Manus (matches existing classify-poll pattern)

### Pitfalls (HIGH confidence)
- **CRITICAL: Context stuffing degrades AI quality** — need context compiler with token budgets and XML tags
- **CRITICAL: Manus polling times out on Vercel** — three-endpoint pattern (create/poll/webhook) is mandatory
- **CRITICAL: Wizard state loss on navigation** — single parent state + auto-save drafts to DB
- **CRITICAL: BrandGuidelines overlap** — migrate don't duplicate; plan the migration before building
- **CRITICAL: Dual-model UX inconsistency** — make routing explicit with clear mode indicators
- **MODERATE: Auto-enrichment runaway costs** — change detection + cost budgets before enabling auto-triggers
- **MODERATE: Brand switch breaks chat context** — start new conversation on brand change

---

## Critical Design Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| BrandProfile vs extend BrandGuidelines | New `BrandProfile` model + migrate data | BrandGuidelines is user-scoped; BrandProfile needs to be brand-scoped. Overlapping fields = source of truth confusion |
| Single table vs multi-table | Multi-table (BrandProfile + BrandVoice + BrandAudience + BrandVisualIdentity) | Prevents god object, enables selective queries, reduces migration risk |
| Context injection format | XML-tagged sections with token budget per section | Prevents "lost in the middle" effect, keeps prompt under 2K tokens |
| Message router approach | Keyword matching + UI toggle, not LLM classifier | 500ms+ latency per message for 2-option decision isn't justified |
| Manus integration pattern | Fire-and-forget + webhook + cron safety net | Matches existing classify-poll pattern; Vercel timeout-safe |
| Onboarding trigger | Soft prompt on first Creative Lab / Hikaru visit, always skippable | Never block value discovery; progressive profiling over time |
| Brand selector state | URL search params + React Context | Shareable URLs, survives navigation, server component compatible |
| Auto-enrichment trigger | Manual + monthly scheduled, NOT per-ingestion | Per-ingestion at 514+ brands = runaway API costs |

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: BrandProfile Schema + CRUD + Brand Selector
- **Addresses:** TS-1 (Brand Profile CRUD), TS-6 (Management UI), TS-4 (Brand selector)
- **Avoids:** Pitfall #4 (god object) via multi-table design, Pitfall #10 (BrandGuidelines overlap) via migration plan
- **Uses:** Prisma (existing), no new dependencies
- **Must include:** BrandGuidelines -> BrandProfile data migration script

### Phase 2: Context Injection + Onboarding Wizard (parallelizable)
- **Addresses:** TS-2 (Chat context), TS-3 (Creative Lab context), TS-5 (Onboarding wizard)
- **Avoids:** Pitfall #1 (context stuffing) via token budgets + XML tags, Pitfall #3 (wizard state loss) via auto-save drafts, Pitfall #9 (blocking onboarding) via skip option
- **Uses:** Existing Anthropic SDK, React Hook Form + Zod (existing)
- **Key constraint:** Context must stay under ~2K tokens

### Phase 3: Auto-Enrichment from Ad Data
- **Addresses:** DF-2 (ad data enrichment — the unique differentiator)
- **Avoids:** Pitfall #6 (runaway costs) via change detection + cost budgets
- **Uses:** Existing classification data, Claude API
- **Why before Manus:** Uses existing infrastructure, ships the unique competitive advantage first

### Phase 4: Manus Integration + Deep Research
- **Addresses:** DF-3 (dual-model routing), DF-1 (website enrichment via Manus)
- **Avoids:** Pitfall #2 (serverless timeout) via three-endpoint pattern, Pitfall #8 (credit waste) via cost tracking + dedup, Pitfall #12 (webhook security) via signature validation
- **Uses:** Inngest (new), Manus API fetch wrapper (new)
- **Risk flag:** Manus API v2 is new, exact payload formats need verification at implementation time

### Phase 5: Message Router + Polish
- **Addresses:** DF-3 completion (chat routing), Pitfall #5 (UX consistency), Pitfall #7 (brand switch context)
- **Avoids:** Pitfall #5 (inconsistent UX) via explicit mode indicators
- **Uses:** Keyword-based router, UI toggle for "Deep Research" mode
- **Depends on:** Phase 2 (context injection) + Phase 4 (Manus) both working

**Phase ordering rationale:**
- Phase 1 first because everything depends on the BrandProfile model
- Phase 2 is highest-impact: makes profiles immediately useful in AI responses
- Phase 3 before Phase 4: ad data enrichment uses existing infra and ships the unique differentiator without Manus dependency
- Phase 4 (Manus) is highest-risk and highest-complexity — isolated so failures don't block core value
- Phase 5 last because it requires both Claude context injection AND Manus to be functional

**Research flags for phases:**
- Phase 1: Standard patterns, unlikely to need deeper research
- Phase 2: Context compiler design may need prototyping to find the right token budget
- Phase 3: Standard patterns, uses existing classification data
- Phase 4: **Likely needs deeper research** — Manus API v2 is new, exact response formats and webhook signatures need verification against live API
- Phase 5: Standard patterns once Phase 2 + 4 are proven

---

## New Dependencies Summary

| Package | Version | Purpose | Phase |
|---------|---------|---------|-------|
| `inngest` | ^3.x | Background job orchestration (Manus + enrichment) | Phase 4 |

**Bump:** `@anthropic-ai/sdk` from ^0.78.0 to ^0.82.0 (Phase 2)

---

## Open Questions

1. **BrandGuidelines migration path** — extend or replace? Research recommends replace with migration script
2. **Context token budget** — needs prototyping to determine how much of a full profile fits in 2K tokens usefully
3. **Manus API v2 exact schemas** — response payloads, webhook format, error codes need live verification
4. **Manus credit economics** — 150-500 credits per task ($1.50-$5.00); need to validate against expected usage patterns
5. **Multi-brand UX for agencies** — how many brand profiles per user? Monetization decision, not technical
6. **Inngest free tier capacity** — 50K runs/month vs expected volume for 514+ brands

---

## Confidence Assessment

| Area | Level | Notes |
|------|-------|-------|
| Schema design | HIGH | Follows existing Prisma patterns |
| Context injection | HIGH | Standard prompt engineering, well-documented |
| Onboarding patterns | HIGH | Well-documented SaaS patterns |
| Feature prioritization | HIGH | Verified against HubSpot, Jasper, Microsoft Copilot |
| Manus API specifics | MEDIUM | API v2 is new, docs confirm patterns but exact formats need verification |
| Cost projections | MEDIUM | Based on published pricing, actual usage patterns unknown |
| Build order | HIGH | Based on concrete dependency analysis |

---

## Sources

See individual research files for detailed source lists:
- `STACK.md` — technology recommendations with versions and rationale
- `FEATURES.md` — feature landscape with table stakes, differentiators, anti-features
- `ARCHITECTURE.md` — component boundaries, data flows, build order
- `PITFALLS.md` — 13 pitfalls across critical/moderate/minor severity
