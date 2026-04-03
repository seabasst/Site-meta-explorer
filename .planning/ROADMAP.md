# Roadmap: Ad Library Pro

## Milestones

<details>
<summary>✅ v1.0 MVP (Phases 1-4) - SHIPPED 2026-01-25</summary>
Phases 1-4
</details>

<details>
<summary>✅ v1.1 Polish (Phase 5) - SHIPPED 2026-01-25</summary>
Phase 5 (phases 6-9 superseded by v2.1)
</details>

<details>
<summary>✅ v2.0 Payments & Auth (Phases 10-13) - SHIPPED 2026-01-27</summary>
Phases 10-13
</details>

<details>
<summary>✅ v2.1 Polish & UX (Phases 14-17.2) - SHIPPED 2026-02-01</summary>
Phases 14-17.2
</details>

<details>
<summary>✅ v3.0 Brand Tracking (Phases 24-27) - SHIPPED 2026-02-02</summary>
Phases 24-27
</details>

<details>
<summary>✅ v3.1 Competitive Intelligence (Phases 28-31) - SHIPPED 2026-02-03</summary>
Phases 28-31
</details>

<details>
<summary>✅ v5.0 Product Refocus (Phases 38-43) - SHIPPED 2026-03-17</summary>
Phases 38-43
</details>

<details>
<summary>✅ v5.1 Visual Consistency (Phases 44-45) - SHIPPED 2026-03-18</summary>
Phases 44-45
</details>

<details>
<summary>✅ v6.0 Ad Library UX Overhaul (Phases 46-51) - SHIPPED 2026-03-20</summary>
Phases 46-51 — See milestones/v6.0-ROADMAP.md for full details
</details>

<details>
<summary>✅ v6.1 Brand Monitoring & Cleanup (Phases 52-54) — SHIPPED 2026-03-21</summary>
Phases 52-54 — See milestones/v6.1-ROADMAP.md for full details
</details>

<details>
<summary>✅ v7.0 Creative Lab (Phases 55-61) — SHIPPED 2026-03-26</summary>
Phases 55-61 — Creative analysis, AI generation, UGC briefs, brand guidelines, gap closure
</details>

<details>
<summary>✅ v8.0 Creative Strategy Engine (Phases 62-67) — SHIPPED 2026-03-27</summary>
Phases 62-67 — Motion classification, strategy matrix, gap analysis, concepts, benchmarking
</details>

---

### 🚧 v9.0 Brand Profile & AI Context System (In Progress)

**Milestone Goal:** Make Hikaru Chat brand-aware — users onboard their brand, and every AI response is contextualized with their brand voice, audience, competitors, and strategy.

## Phases

- [x] **Phase 68: Brand Profile Schema & CRUD** - Data model, management UI, brand selector
- [ ] **Phase 69: Context Injection & Onboarding** - Brand-aware AI responses + guided wizard
- [ ] **Phase 70: Auto-Enrichment from Ad Data** - Auto-populate profiles from existing intelligence
- [ ] **Phase 71: Manus Integration & Deep Research** - Async research backend + website enrichment
- [ ] **Phase 72: Brand Intelligence & Polish** - Health overview + personalized strategy

## Phase Details

### Phase 68: Brand Profile Schema & CRUD
**Goal**: Structured brand profile data model with full CRUD and brand selector for context switching
**Depends on**: Nothing (first phase of v9.0)
**Requirements**: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, CTXI-03
**Research flag**: Unlikely — standard Prisma patterns, BrandGuidelines migration is the main concern
**Success Criteria** (what must be TRUE):
  1. User can create a brand profile with voice, audience, positioning, competitors, and pain points
  2. User can view and edit brand profile via tab-based settings page
  3. User can link competitor brands from existing DB to their profile
  4. User can delete a brand profile
  5. User can switch active brand via dropdown in chat header (URL param `?brand=` persisted)
**Plans**: 2 plans

Plans:
- [x] 68-01-PLAN.md — Prisma schema (BrandProfile + BrandCompetitor models) + CRUD API routes
- [x] 68-02-PLAN.md — Brand management UI (tab-based settings page) + brand selector in chat header

### Phase 69: Context Injection & Onboarding
**Goal**: Brand context flows into all AI responses; users can create profiles via guided wizard or AI interview
**Depends on**: Phase 68 (BrandProfile must exist)
**Requirements**: CTXI-01, CTXI-02, CTXI-04, ONBD-01, ONBD-02, ONBD-03, ONBD-04
**Research flag**: Unlikely — context compiler needs prototyping but patterns are well-known
**Success Criteria** (what must be TRUE):
  1. Hikaru responses reflect selected brand's voice, audience, and positioning
  2. Creative Lab analysis and generation flows use brand context
  3. User sees soft onboarding prompt on first Creative Lab or Hikaru visit (always skippable)
  4. User can complete 3-5 step wizard or AI interview to build profile
  5. Context stays under ~2K tokens via intelligent field selection per query
**Plans**: TBD

Plans:
- [ ] 69-01: Context compiler (token-budgeted, XML-tagged system prompt injection)
- [ ] 69-02: Onboarding wizard UI (multi-step form + auto-save drafts)
- [ ] 69-03: AI interview mode (conversational profile building)

### Phase 70: Auto-Enrichment from Ad Data
**Goal**: Auto-populate brand profiles from existing ad classifications, analyses, and metadata
**Depends on**: Phase 69 (profile + context injection must work first)
**Requirements**: ENRC-01, ENRC-03
**Research flag**: Unlikely — uses existing classification infrastructure
**Success Criteria** (what must be TRUE):
  1. User can trigger auto-populate from existing ad library data (classifications, analyses, metadata)
  2. Enrichment uses change detection to skip redundant runs
  3. Cost budgets cap API usage per enrichment run
**Plans**: TBD

Plans:
- [ ] 70-01: Enrichment pipeline (ad data → profile fields) + change detection + cost budgets

### Phase 71: Manus Integration & Deep Research
**Goal**: Async deep research via Manus API for complex brand analysis and website enrichment
**Depends on**: Phase 68 (BrandProfile for storing results)
**Requirements**: MANS-01, MANS-02, MANS-03, MANS-04, ENRC-02
**Research flag**: Likely — Manus API v2 is new, exact payloads and webhook formats need live verification
**Success Criteria** (what must be TRUE):
  1. Deep research queries route to Manus API as async tasks with polling UI
  2. Simple/fast queries continue routing to Claude for instant streaming
  3. User can auto-populate profile from website URL crawl via Manus
  4. Routing uses keyword matching + UI toggle ("Deep Research" mode), not LLM-classified
**Plans**: TBD

Plans:
- [ ] 71-01: Manus API wrapper + three-endpoint pattern (create/poll/webhook)
- [ ] 71-02: Website enrichment flow + deep research UI + message routing

### Phase 72: Brand Intelligence & Polish
**Goal**: Brand health insights comparing user's ads to competitors, personalized strategy recommendations
**Depends on**: Phase 69 (context injection) + Phase 70 (enrichment) for full profile data
**Requirements**: INTL-01, INTL-02
**Research flag**: Unlikely — builds on existing strategy engine from v8.0
**Success Criteria** (what must be TRUE):
  1. User sees auto-generated brand health overview comparing their ads to linked competitors
  2. Creative Lab strategy view uses full brand profile for personalized gap analysis and recommendations
**Plans**: TBD

Plans:
- [ ] 72-01: Brand health overview (competitor comparison + health scores)
- [ ] 72-02: Personalized strategy integration (profile-aware gap analysis + recommendations)

## Progress

**Execution Order:**
Phases execute in numeric order: 68 → 69 → 70 → 71 → 72

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 68. Brand Profile Schema & CRUD | 2/2 | ✓ Complete | 2026-04-03 |
| 69. Context Injection & Onboarding | 0/3 | Not started | — |
| 70. Auto-Enrichment from Ad Data | 0/1 | Not started | — |
| 71. Manus Integration & Deep Research | 0/2 | Not started | — |
| 72. Brand Intelligence & Polish | 0/2 | Not started | — |

---
*Last updated: 2026-04-03 — Phase 68 complete (2/2 plans, verified ✓)*
