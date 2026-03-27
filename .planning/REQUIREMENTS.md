# Requirements: Ad Library Pro — v8.0 Creative Strategy Engine

**Defined:** 2026-03-27
**Core Value:** Help brands and agencies see what competitors are running and how they're reaching their audiences — browse, save, analyze, compare.

## v1 Requirements

Requirements for v8.0 milestone. Each maps to roadmap phases.

### Classification Engine

- [ ] **CLSF-01**: User can trigger AI classification of a single ad via Claude Vision (on-demand, ~2-4s)
- [ ] **CLSF-02**: Ad classifications are stored persistently in the database (AdClassification model, indexed columns)
- [ ] **CLSF-03**: User can trigger batch classification of a brand's ads via Anthropic Batch API (50% cost discount)
- [ ] **CLSF-04**: Classification taxonomy covers ~8-10 categories with ~10 tags each (visual format, hook tactic, messaging angle, awareness stage, creative mechanic, offer type, intended audience, asset type)
- [ ] **CLSF-05**: Batch classification jobs track progress and cost (ClassificationJob + ApiCostLog models)
- [ ] **CLSF-06**: Existing diversity analysis route reads from stored classifications instead of re-classifying

### Brand Context

- [ ] **BRND-01**: Brand profile auto-populates from existing DB data (ads, category, demographics) without requiring manual input

### Strategy & Gap Analysis

- [ ] **STRT-01**: Strategy generation uses classification taxonomy data (not just text ad copy patterns)
- [ ] **STRT-02**: User can select any brand and see their full creative taxonomy breakdown (format distribution, tactic usage, awareness stage coverage)
- [ ] **STRT-03**: User can view an interactive gap matrix crossing awareness stages x creative formats, with coverage heatmap
- [ ] **STRT-04**: User can click a gap cell in the matrix to auto-generate creative concepts targeting that gap
- [ ] **STRT-05**: Generated concepts include visual format, creative mechanic, hook, messaging angle, and production brief

### Visual Reporting

- [ ] **REPT-01**: User sees distribution bar charts per classification dimension (e.g., "30% testimonial, 5% listicle")
- [ ] **REPT-02**: Individual ads display their classification tags in ad detail view

### Category Benchmarking

- [ ] **BNCH-01**: User can compare a brand's creative dimension distribution against category averages
- [ ] **BNCH-02**: Comparison shows index scores (e.g., "2x over-indexed on testimonials, 0.5x under-indexed on listicles")

## v2 Requirements

Deferred to future release (v8.1+). Tracked but not in current roadmap.

### Creative Velocity

- **VLCT-01**: User sees creative velocity metrics (ads/week, format diversification trend)
- **VLCT-02**: Staleness indicators highlight when a brand hasn't shipped new formats

### Brand Context (Advanced)

- **BRND-02**: Extract voice, positioning, and pain points from ad copy text patterns
- **BRND-03**: Auto-detect brand personality shifts over time

### Benchmarking (Advanced)

- **BNCH-03**: Custom competitive sets (hand-pick brands to benchmark against)
- **BNCH-04**: Benchmark trends over time (how category norms shift)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full image/video generation | AdCreative.ai owns this; focus on strategy layer |
| Swipe file / Chrome extension | Foreplay owns this; platform already has 514+ brands |
| Ad account connection | Removes competitor intelligence advantage (the primary differentiator) |
| Team collaboration | Scope explosion; single-user tool |
| 46-format taxonomy | Start with ~8-10 categories; expand after accuracy validation |
| Creative velocity tracking | Nice-to-have; deferred to v2 |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLSF-01 | Phase 63 | Pending |
| CLSF-02 | Phase 62 | Complete |
| CLSF-03 | Phase 63 | Pending |
| CLSF-04 | Phase 62 | Complete |
| CLSF-05 | Phase 63 | Pending |
| CLSF-06 | Phase 64 | Pending |
| BRND-01 | Phase 66 | Pending |
| STRT-01 | Phase 66 | Pending |
| STRT-02 | Phase 66 | Pending |
| STRT-03 | Phase 66 | Pending |
| STRT-04 | Phase 66 | Pending |
| STRT-05 | Phase 66 | Pending |
| REPT-01 | Phase 65 | Pending |
| REPT-02 | Phase 65 | Pending |
| BNCH-01 | Phase 67 | Pending |
| BNCH-02 | Phase 67 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16 ✓
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 — Phase 62 requirements marked Complete*
