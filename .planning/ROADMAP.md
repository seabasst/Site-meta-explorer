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

---

### 🚧 v7.0 Creative Lab (In Progress)

**Milestone Goal:** Turn ad insights into action — generate, remix, and customize ad creatives directly in the platform.

## Phases

- [x] **Phase 55: Creative Analysis** - Brand vs. category benchmarking with Five Pillars + Andromeda
- [x] **Phase 56: Image Generation** - AI image generation with format selection driven by analysis gaps
- [x] **Phase 56.1: Brand Guidelines Setup** - Brand persona form (voice, audience, visual identity) to steer AI generation (INSERTED)
- [ ] **Phase 57: Text Overlay Editor** - Template-based ad customization and export
- [ ] **Phase 58: UGC Creator Briefs** - Structured briefs with shot list, talking points, hooks
- [ ] **Phase 59: Creative Lab Integration** - Unified Creative Lab page connecting all features

## Phase Details

### Phase 55: Creative Analysis
**Goal**: Users can benchmark their brand's creative strategy against category averages
**Depends on**: Nothing (first phase — extends existing Andromeda analysis)
**Requirements**: ANLZ-01, ANLZ-02, ANLZ-03, ANLZ-04
**Success Criteria** (what must be TRUE):
  1. User can select their brand AND a category to compare against
  2. Category benchmark shows aggregated Five Pillars + Andromeda scores across all brands in that category
  3. User sees side-by-side comparison with per-pillar indexing (brand score vs. category average)
  4. Comparison highlights gaps and strengths with actionable recommendations
**Plans:** 2 plans
Plans:
- [x] 55-01-PLAN.md — Analysis caching + benchmark API
- [x] 55-02-PLAN.md — Category selector UI + benchmark comparison component

### Phase 56: Image Generation
**Goal**: Users can generate AI ad creatives in multiple formats from analysis-driven prompts
**Depends on**: Phase 55 (recommendations feed into generation)
**Requirements**: GENR-01, GENR-02, GENR-03, GENR-04, GENR-05
**Success Criteria** (what must be TRUE):
  1. User can generate an AI image from any recommendation with one click
  2. User can select target ad format/size before generating
  3. User can generate multiple format variants from the same prompt
  4. User can download any generated image
  5. Generation prompts are pre-filled from analysis gap recommendations
**Plans:** 1 plan
Plans:
- [x] 56-01-PLAN.md — Format selector, multi-format generation, blob download

### Phase 56.1: Brand Guidelines Setup (INSERTED)
**Goal**: Users can define their brand persona (voice, mission, target audience, visual identity) to steer AI-generated creatives toward brand consistency
**Depends on**: Phase 56 (brand guidelines feed into generation prompts)
**Requirements**: TBD (to be defined during planning)
**Success Criteria** (what must be TRUE):
  1. User can input brand voice & personality description
  2. User can set a mission statement
  3. User can select target audience demographics and interests
  4. User can upload a logo and define core brand colors (primary, secondary, accent)
  5. User can upload reference images to an image library
  6. Brand guidelines are saved and persist across sessions
  7. Saved guidelines feed into image generation prompts for brand-consistent output
**Plans:** 2 plans
Plans:
- [x] 56.1-01-PLAN.md — Prisma model, CRUD API, upload API, generation integration
- [x] 56.1-02-PLAN.md — Brand Guidelines page UI + sidebar navigation

**Design Reference**: Figma file `w3UPPS0z6hGsWPoZWxXjkO` node `0:3` — adapted to existing design system (#1235e2 primary, dark/light mode, V2Shell/V2Card)

### Phase 57: Text Overlay Editor
**Goal**: Users can customize ad creatives using templates with text, image, color, and font controls
**Depends on**: Phase 56 (generated images can be used in templates)
**Requirements**: EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05
**Success Criteria** (what must be TRUE):
  1. User can browse and pick from a library of ad templates
  2. User can swap headline, body text, and CTA on any template
  3. User can swap the template image (upload their own or use a generated image)
  4. User can customize colors and fonts
  5. User can export the finished creative as PNG or JPG
**Plans**: TBD

### Phase 58: UGC Creator Briefs
**Goal**: Users can generate structured UGC briefs based on a brand's ad library data
**Depends on**: Phase 55 (analysis data informs brief content)
**Requirements**: UGC-01, UGC-02, UGC-03, UGC-04, UGC-05
**Success Criteria** (what must be TRUE):
  1. User can generate a UGC brief for any brand in the database
  2. Brief includes a shot list with scene descriptions
  3. Brief includes talking points and a hook script
  4. Brief includes B-roll suggestions relevant to the brand's category
  5. User can copy the brief to clipboard or download as a formatted document
**Plans**: TBD

### Phase 59: Creative Lab Integration
**Goal**: Unified Creative Lab page that connects analysis, generation, editing, and briefs into one workflow
**Depends on**: Phases 55-58
**Requirements**: (cross-cutting — connects all features)
**Success Criteria** (what must be TRUE):
  1. Creative Lab page has clear navigation between Analysis, Generation, Editor, and Briefs
  2. User can flow from analysis → generation → editor without leaving Creative Lab
  3. Recommendations from analysis link directly to generation and brief creation
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 55 → 56 → 56.1 → 57 → 58 → 59

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 55. Creative Analysis | 2/2 | ✅ Complete | 2026-03-21 |
| 56. Image Generation | 1/1 | ✅ Complete | 2026-03-22 |
| 56.1. Brand Guidelines Setup | 2/2 | ✅ Complete | 2026-03-23 |
| 57. Text Overlay Editor | 0/TBD | Not started | - |
| 58. UGC Creator Briefs | 0/TBD | Not started | - |
| 59. Creative Lab Integration | 0/TBD | Not started | - |

---
*Last updated: 2026-03-23 after Phase 56.1 complete*
