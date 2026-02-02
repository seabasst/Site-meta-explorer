# Requirements: Ad Library Demographics Analyzer

**Defined:** 2026-02-02
**Milestone:** v3.1 Competitive Intelligence
**Core Value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## v1 Requirements

Requirements for v3.1 release. Each maps to roadmap phases.

### Brand Comparison

- [ ] **COMP-01**: User can select 2 saved brands for side-by-side comparison
- [ ] **COMP-02**: User can view butterfly chart showing age-gender distribution for both brands (Brand A left, Brand B right)
- [ ] **COMP-03**: User can view paired horizontal bar chart comparing country distribution for both brands
- [ ] **COMP-04**: User can view summary metrics table with reach, ad count, and dominant demographic for both brands side by side
- [ ] **COMP-05**: User sees empty state with guidance when fewer than 2 brands are saved

### Hook Extraction

- [ ] **HOOK-01**: System extracts first sentence (opening hook) from each ad's creative body text during analysis
- [ ] **HOOK-02**: System groups identical hooks after normalization (lowercase, strip punctuation/emojis, trim)
- [ ] **HOOK-03**: Each hook group shows frequency count, total reach, and average reach per ad
- [ ] **HOOK-04**: User can view hooks as card list ranked by reach-weighted frequency
- [ ] **HOOK-05**: User can search/filter hooks by text
- [ ] **HOOK-06**: User can expand a hook group to see all ads using that hook
- [ ] **HOOK-07**: Hooks are persisted for saved brands (available on brand detail page without re-analysis)

### Pattern Observations

- [ ] **OBSV-01**: System auto-generates dominant demographic skew observation (e.g., "Skews 25-34 male, 42% of reach")
- [ ] **OBSV-02**: System auto-generates gender imbalance observation when one gender exceeds 60% of reach
- [ ] **OBSV-03**: System auto-generates geographic concentration observation when top 2 countries exceed 50% of reach
- [ ] **OBSV-04**: System auto-generates hook pattern observation showing most common hook and its frequency
- [ ] **OBSV-05**: User can view up to 5 observation cards at top of brand detail page, ranked by signal magnitude
- [ ] **OBSV-06**: Observations are hidden entirely when no significant patterns are detected

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Trend Charts

- **TRND-01**: User can view age distribution changes across snapshots as line chart
- **TRND-02**: User can view gender split changes across snapshots as line chart
- **TRND-03**: User can view top country changes across snapshots as line chart
- **TRND-04**: User sees tabbed interface (Age | Gender | Country) for trend views
- **TRND-05**: User sees empty state with re-analyze CTA for brands with only 1 snapshot

### Temporal Observations

- **OBSV-07**: System auto-generates temporal shift observations (e.g., "Top country shifted DE→FR since last analysis")
- **OBSV-08**: System auto-generates age shift observations across snapshots

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI/LLM-powered insights | Cost, latency, hallucination risk at sub-$50/mo pricing |
| Fuzzy/semantic hook clustering | Over-engineering for v3.1; simple normalization first |
| N-way brand comparison (3+) | Butterfly charts only work with 2; visually cluttered beyond that |
| Video hook transcription | Different infrastructure (speech-to-text, video download) |
| Real-time competitor monitoring | Major infra investment (cron, queues, notifications) |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| COMP-01 | TBD | Pending |
| COMP-02 | TBD | Pending |
| COMP-03 | TBD | Pending |
| COMP-04 | TBD | Pending |
| COMP-05 | TBD | Pending |
| HOOK-01 | TBD | Pending |
| HOOK-02 | TBD | Pending |
| HOOK-03 | TBD | Pending |
| HOOK-04 | TBD | Pending |
| HOOK-05 | TBD | Pending |
| HOOK-06 | TBD | Pending |
| HOOK-07 | TBD | Pending |
| OBSV-01 | TBD | Pending |
| OBSV-02 | TBD | Pending |
| OBSV-03 | TBD | Pending |
| OBSV-04 | TBD | Pending |
| OBSV-05 | TBD | Pending |
| OBSV-06 | TBD | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 0
- Unmapped: 18 (pending roadmap creation)

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after initial definition*
