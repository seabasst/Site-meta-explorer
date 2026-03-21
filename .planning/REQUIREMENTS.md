# Requirements: Ad Library Pro — v7.0 Creative Lab

**Defined:** 2026-03-21
**Core Value:** Turn ad insights into action — generate, remix, and customize ad creatives directly in the platform.

## v1 Requirements

Requirements for v7.0 milestone. Each maps to roadmap phases.

### Creative Analysis

- [ ] **ANLZ-01**: User can select their brand and a category to benchmark against
- [ ] **ANLZ-02**: Category benchmark aggregates Five Pillars + Andromeda scores across all brands in that category from the database
- [ ] **ANLZ-03**: User sees brand vs. category comparison with per-pillar indexing (e.g., "your format diversity is 62 vs. category avg 78")
- [ ] **ANLZ-04**: Comparison highlights gaps and strengths with actionable recommendations

### Creative Generation

- [ ] **GENR-01**: User can generate AI images from analysis recommendations using Flux Schnell
- [ ] **GENR-02**: User can select target ad format/size (1080x1080, 1080x1920, 1200x628, etc.)
- [ ] **GENR-03**: User can generate multiple format variants from a single prompt
- [ ] **GENR-04**: User can download generated images
- [ ] **GENR-05**: Generation is driven by analysis gaps (recommendations feed directly into generation prompts)

### Text Overlay Editor

- [ ] **EDIT-01**: User can pick from a library of ad templates
- [ ] **EDIT-02**: User can swap text on templates (headline, body, CTA)
- [ ] **EDIT-03**: User can swap images on templates (upload or use generated images)
- [ ] **EDIT-04**: User can customize colors and fonts on templates
- [ ] **EDIT-05**: User can export finished creative as image (PNG/JPG)

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

### Text Overlay Editor (Advanced)

- **EDIT-06**: User can add/remove text layers
- **EDIT-07**: User can position elements via drag-and-drop
- **EDIT-08**: User can save templates for reuse

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full canvas editor (Figma-like) | Too complex — template-based only, keep scope manageable |
| Video generation | High cost, different tech stack — defer to later |
| AI model selection (DALL-E vs Flux vs Gemini) | Start with Flux Schnell, upgrade path later |
| Real-time collaboration | Single-user tool for now |
| Asset management/library | Store locally or download — no persistent asset library yet |
| Scheduled generation | No background job infrastructure for this |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ANLZ-01 | Phase 55 | Pending |
| ANLZ-02 | Phase 55 | Pending |
| ANLZ-03 | Phase 55 | Pending |
| ANLZ-04 | Phase 55 | Pending |
| GENR-01 | Phase 56 | Pending |
| GENR-02 | Phase 56 | Pending |
| GENR-03 | Phase 56 | Pending |
| GENR-04 | Phase 56 | Pending |
| GENR-05 | Phase 56 | Pending |
| EDIT-01 | Phase 57 | Pending |
| EDIT-02 | Phase 57 | Pending |
| EDIT-03 | Phase 57 | Pending |
| EDIT-04 | Phase 57 | Pending |
| EDIT-05 | Phase 57 | Pending |
| UGC-01 | Phase 58 | Pending |
| UGC-02 | Phase 58 | Pending |
| UGC-03 | Phase 58 | Pending |
| UGC-04 | Phase 58 | Pending |
| UGC-05 | Phase 58 | Pending |

**Coverage:**
- v1 requirements: 18 total (+ Phase 59 cross-cutting integration)
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation*
