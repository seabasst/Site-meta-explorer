# Requirements: Ad Library Pro — v7.0 Creative Lab

**Defined:** 2026-03-21
**Core Value:** Turn ad insights into action — generate, remix, and customize ad creatives directly in the platform.

## v1 Requirements

Requirements for v7.0 milestone. Each maps to roadmap phases.

### Creative Analysis

- [x] **ANLZ-01**: User can select their brand and a category to benchmark against
- [x] **ANLZ-02**: Category benchmark aggregates Five Pillars + Andromeda scores across all brands in that category from the database
- [x] **ANLZ-03**: User sees brand vs. category comparison with per-pillar indexing (e.g., "your format diversity is 62 vs. category avg 78")
- [x] **ANLZ-04**: Comparison highlights gaps and strengths with actionable recommendations

### Creative Generation

- [x] **GENR-01**: User can generate AI images from analysis recommendations using Flux Schnell
- [x] **GENR-02**: User can select target ad format/size (1080x1080, 1080x1920, 1200x628, etc.)
- [x] **GENR-03**: User can generate multiple format variants from a single prompt
- [x] **GENR-04**: User can download generated images
- [x] **GENR-05**: Generation is driven by analysis gaps (recommendations feed directly into generation prompts)

### AI Creative Generation (REPLACES Text Overlay Editor)

- [ ] **AIGEN-01**: User can trigger ad generation from analysis gap recommendations
- [ ] **AIGEN-02**: AI pre-fills config screen with suggested formats, quantity, style, and copy angles based on gaps + brand guidelines + competitor data
- [ ] **AIGEN-03**: Each suggestion shows reasoning (why this ad concept was suggested)
- [ ] **AIGEN-04**: User can adjust any pre-filled setting before generating
- [ ] **AIGEN-05**: Generated ads appear in a gallery view with download (individual or zip)

### UGC Creator Briefs

- [ ] **UGC-01**: User can generate a structured UGC brief from a brand's ad library data
- [ ] **UGC-02**: Brief includes shot list with scene descriptions
- [ ] **UGC-03**: Brief includes talking points and hook script
- [ ] **UGC-04**: Brief includes B-roll suggestions based on brand category
- [ ] **UGC-05**: User can copy or download brief as formatted document

## v2 Requirements

Deferred to future release (v7.1+). Tracked but not in current roadmap.

### Creative Analysis (Advanced)

- **ANLZ-05**: User can create custom competitive sets (not just category-level)
- **ANLZ-06**: Trend analysis showing benchmark changes over time
- **ANLZ-07**: AI-generated strategy narrative summarizing brand position

### Creative Generation (Advanced)

- **GENR-06**: Template remixing from high-performing competitor ads
- **GENR-07**: Batch generation (generate full campaign set in one action)
- **GENR-08**: Generation history with saved prompts and outputs

### AI Creative Generation (Advanced)

- **AIGEN-06**: Light post-generation editing (text copy tweaks, color swaps)
- **AIGEN-07**: Regenerate/variations of specific results
- **AIGEN-08**: Campaign history with saved generations

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full canvas editor (Figma-like) | AI-driven approach — user shouldn't need to edit manually |
| Video generation | High cost, different tech stack — defer to later |
| AI model selection (DALL-E vs Flux vs Gemini) | Start with Flux Schnell, upgrade path later |
| Real-time collaboration | Single-user tool for now |
| Asset management/library | Store locally or download — no persistent asset library yet |
| Scheduled generation | No background job infrastructure for this |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ANLZ-01 | Phase 55 | Complete |
| ANLZ-02 | Phase 55 | Complete |
| ANLZ-03 | Phase 55 | Complete |
| ANLZ-04 | Phase 55 | Complete |
| GENR-01 | Phase 56 | Complete |
| GENR-02 | Phase 56 | Complete |
| GENR-03 | Phase 56 | Complete |
| GENR-04 | Phase 56 | Complete |
| GENR-05 | Phase 56 | Complete |
| ~~EDIT-01~~ | ~~Phase 57~~ | Superseded by AIGEN-01..05 |
| AIGEN-01 | Phase 57 | Pending |
| AIGEN-02 | Phase 57 | Pending |
| AIGEN-03 | Phase 57 | Pending |
| AIGEN-04 | Phase 57 | Pending |
| AIGEN-05 | Phase 57 | Pending |
| UGC-01 | Phase 58 | Pending |
| UGC-02 | Phase 58 | Pending |
| UGC-03 | Phase 58 | Pending |
| UGC-04 | Phase 58 | Pending |
| UGC-05 | Phase 58 | Pending |

**Coverage:**
- v1 requirements: 19 total (+ Phase 59 cross-cutting integration)
- Mapped to phases: 19
- Unmapped: 0 ✓
- Superseded: EDIT-01..05 replaced by AIGEN-01..05 (2026-03-23)

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-22 after Phase 56 completion*
