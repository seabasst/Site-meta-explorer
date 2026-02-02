# Roadmap: Ad Library Demographics Analyzer

## Overview

v3.1 Competitive Intelligence adds four capabilities to the existing brand tracking system: ad creative hook extraction and exploration, side-by-side brand comparison with mirrored demographic charts, and rule-based pattern observations. The approach is data-first (hooks extraction engine), then UI (hook exploration), then independent feature (comparison), then cross-cutting insights (observations that benefit from all prior data).

## Milestones

- ✅ **v1.0 MVP** - Phases 1-4 (shipped 2026-01-25)
- ✅ **v1.1 Polish** - Phase 5 (shipped 2026-01-25)
- ✅ **v2.0 Payments & Auth** - Phases 10-13 (shipped 2026-01-27)
- ✅ **v2.1 Polish & UX** - Phases 14-17.2 (shipped 2026-02-01)
- ✅ **v3.0 Brand Tracking** - Phases 24-27 (shipped 2026-02-02)
- 🚧 **v3.1 Competitive Intelligence** - Phases 28-31 (in progress)

## Phases

- [x] **Phase 28: Hook Extraction Engine** - Extract, group, and persist ad creative hooks from analysis data
- [ ] **Phase 29: Hook Exploration UI** - Browse, search, and explore extracted hooks
- [ ] **Phase 30: Brand Comparison** - Side-by-side demographic comparison of two saved brands
- [ ] **Phase 31: Pattern Observations** - Auto-generated factual observations surfacing notable demographic patterns

## Phase Details

### Phase 28: Hook Extraction Engine
**Goal**: Extract opening hooks from ad creative text, group similar hooks, compute reach-weighted metrics, and persist for saved brands
**Depends on**: Nothing (first phase of v3.1)
**Requirements**: HOOK-01, HOOK-02, HOOK-03, HOOK-07
**Success Criteria** (what must be TRUE):
  1. System extracts opening hooks from all ad creative bodies during analysis (not just `[0]`)
  2. Similar hooks are grouped after text normalization (lowercase, strip punctuation/emojis, trim)
  3. Each hook group shows frequency count, total reach, and average reach per ad
  4. Hooks are stored in database and available for saved brands without re-analysis
**Research**: Complete (28-RESEARCH.md)
**Plans**: 2 plans
Plans:
- [x] 28-01-PLAN.md — Hook extractor module + HookGroup Prisma model
- [x] 28-02-PLAN.md — Wire extraction into save-brand and re-analysis flows

### Phase 29: Hook Exploration UI
**Goal**: Users can browse, search, and drill into extracted hooks on the brand detail page
**Depends on**: Phase 28
**Requirements**: HOOK-04, HOOK-05, HOOK-06
**Success Criteria** (what must be TRUE):
  1. User can view hooks as card list ranked by reach-weighted frequency
  2. User can search/filter hooks by text content
  3. User can expand a hook group to see all ads using that hook
**Research**: Unlikely — standard UI components with existing patterns
**Plans**: TBD

### Phase 30: Brand Comparison
**Goal**: Side-by-side demographic comparison of two saved brands with mirrored charts
**Depends on**: Nothing (independent of hooks; requires saved brands from v3.0)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05
**Success Criteria** (what must be TRUE):
  1. User can select 2 saved brands for side-by-side comparison
  2. User sees butterfly chart showing age-gender distribution for both brands (Brand A left, Brand B right)
  3. User sees paired horizontal bar chart comparing country distribution
  4. User sees summary metrics table with reach, ad count, and dominant demographic side by side
  5. User sees empty state with guidance when fewer than 2 brands are saved
**Research**: Likely — Recharts butterfly/grouped bar implementation, negative-value approach vs dual-chart layout
**Plans**: TBD

### Phase 31: Pattern Observations
**Goal**: Auto-generate factual observations from demographic data, surfacing notable patterns without AI/LLM
**Depends on**: Phase 28 (uses hook data for OBSV-04)
**Requirements**: OBSV-01, OBSV-02, OBSV-03, OBSV-04, OBSV-05, OBSV-06
**Success Criteria** (what must be TRUE):
  1. System generates demographic skew, gender imbalance, geographic concentration, and hook pattern observations
  2. User sees up to 5 observation cards at top of brand detail page, ranked by signal magnitude
  3. Observations are hidden entirely when no significant patterns are detected
**Research**: Unlikely — pure TypeScript rule engine, no external dependencies
**Plans**: TBD

## Progress

**Execution Order:**
Phases 28 → 29 → 30 → 31 (Phase 30 can run parallel with 29 if desired)

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 28. Hook Extraction Engine | 2/2 | ✓ Complete | 2026-02-02 |
| 29. Hook Exploration UI | 0/TBD | Not started | - |
| 30. Brand Comparison | 0/TBD | Not started | - |
| 31. Pattern Observations | 0/TBD | Not started | - |
