# Requirements: Ad Library Demographics Analyzer

**Defined:** 2026-02-05
**Core Value:** Surface who competitors are reaching with their ads — demographics and geography aggregated from their top performers.

## v4.0 Requirements

Requirements for v4.0 Analytics Platform. Each maps to roadmap phases.

### Trend Analysis

- [ ] **TREND-01**: User can view demographic trend charts showing how age, gender, and country distribution change across historical snapshots for a saved brand

### Competitive Benchmarking

- [ ] **BENCH-01**: User can create a benchmark report comparing up to 5 competitor pages against one baseline brand
- [ ] **BENCH-02**: System can batch-fetch multiple ad library pages with rate limit management
- [ ] **BENCH-03**: User can see aggregated benchmark metrics (average demographics across competitors) with over/under-indexing vs baseline
- [ ] **BENCH-04**: User can save benchmark reports as persistent entities with brands and baseline designation

### Dashboard UX

- [ ] **DASH-01**: Dashboard has improved navigation structure
- [ ] **DASH-02**: Brand cards display richer metrics and visual improvements
- [ ] **DASH-03**: User can filter, tag, and organize saved brands

### Performance & Quality

- [ ] **PERF-01**: Analysis, re-analysis, and page loads are faster
- [ ] **QUAL-01**: Hook grouping uses improved fuzzy matching for similar phrases
- [ ] **QUAL-02**: Demographic weighting and missing data handling are more accurate

## v4.1 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Benchmark Management

- **BENCH-05**: User can view a benchmark dashboard listing all saved benchmark reports
- **BENCH-06**: User can re-analyze a saved benchmark to get fresh data
- **BENCH-07**: User can track benchmark trends over time

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Scheduled re-analysis | Requires background jobs infrastructure |
| N-way brand comparison (3+) | Keep existing 2-brand comparison; benchmarks handle multi-brand |
| AI/LLM insights | Rule-based observations sufficient for v4.0 |
| Video hook transcription | Different infrastructure problem |
| Real-time competitor monitoring | Major infrastructure investment |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TREND-01 | Phase 32 | Pending |
| BENCH-01 | Phase 33 | Pending |
| BENCH-02 | Phase 33 | Pending |
| BENCH-03 | Phase 34 | Pending |
| BENCH-04 | Phase 33 | Pending |
| DASH-01 | Phase 35 | Pending |
| DASH-02 | Phase 35 | Pending |
| DASH-03 | Phase 35 | Pending |
| PERF-01 | Phase 36 | Pending |
| QUAL-01 | Phase 36 | Pending |
| QUAL-02 | Phase 36 | Pending |

**Coverage:**
- v4.0 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-06 after roadmap creation*
