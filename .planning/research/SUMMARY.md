# Project Research Summary

**Project:** Ad Library Demographics Analyzer
**Domain:** Ad Intelligence / Competitive Analysis SaaS
**Researched:** 2026-02-02
**Milestone:** v3.1 Competitive Intelligence
**Confidence:** HIGH

## Executive Summary

The v3.1 Competitive Intelligence milestone adds four features to the existing brand tracking system: ad creative hook extraction, demographic trend charts, side-by-side brand comparison, and rule-based pattern observations. Research across stack, features, architecture, and pitfalls dimensions reveals that **zero new npm dependencies are needed** -- all features can be built with the existing stack (Next.js 16, React 19, Recharts, Tailwind 4, Prisma) plus ~200-300 lines of custom TypeScript utilities.

The recommended approach is **data-first, UI-second**: start with a data foundation phase (schema migration for creative hooks, JSON normalizer for snapshot consistency), then build API endpoints, then UI components. Trend charts and brand comparison can proceed in parallel since they're independent, while pattern observations should come last because they benefit from temporal and hook data being available.

Key risks center on **multilingual hook text** (EU ads in 10+ languages), **sparse irregular time-series** (Recharts has documented issues with non-uniform data), **JSON schema drift** across snapshots from different app versions, and **rule-based observations generating obvious or misleading statements**. All have concrete prevention strategies documented in PITFALLS.md.

## Key Findings

### Recommended Stack

No new libraries needed. The existing stack covers all requirements. See STACK.md for full analysis.

**Key decisions:**
- **Hook extraction:** Custom regex + Dice bigram similarity (~40 LOC) -- NLP libraries (compromise, wink-nlp) are overkill for short ad copy
- **Trend charts:** Recharts already installed -- use `AreaChart` with `stackOffset="expand"` for composition views
- **Comparison:** CSS Grid + existing chart components reused with lifted hover state
- **Pattern observations:** Custom rule engine with template literals (~150 LOC) -- no template engine or LLM needed

### Expected Features

See FEATURES.md for detailed analysis with competitor benchmarking.

**Table stakes:**
- **Trend charts** -- Pathmatics, SocialPeta, Sensor Tower all show time-series. Data already exists in snapshots; not charting it is a missed obvious step.
- **Brand comparison** -- Any brand tracking dashboard that can't compare brands side-by-side is missing its core value prop. Butterfly chart (population pyramid pattern) is the gold standard for 2-brand demographic comparison.

**Differentiators:**
- **Hook extraction** -- Only Foreplay Spyder ($99-249/mo) auto-extracts hooks. Offering this on free public Ad Library data is a strong competitive wedge.
- **Pattern observations** -- Enterprise tools charge $500+/mo for AI insights. Rule-based factual observations are free to compute, deterministic, and no one sub-$50/mo offers them.

**Anti-features (do NOT build for v3.1):**
- AI/LLM-powered insights (cost, latency, hallucination risk)
- Fuzzy/semantic hook clustering (over-engineering for v3.1)
- N-way brand comparison (butterfly charts only work with 2)
- Video hook transcription (different infrastructure problem)
- Real-time competitor monitoring (major infra investment)

### Architecture Approach

All features plug into the existing snapshot pipeline. See ARCHITECTURE.md for data models, API endpoints, component hierarchy, and data flows.

**New data model:**
- `CreativeHook` Prisma model -- stores extracted hooks per snapshot with grouping and reach-weighted scoring

**New API endpoints:**
- `GET /api/dashboard/trends` -- demographic breakdown time series for one brand
- `GET /api/dashboard/compare` -- side-by-side data for two brands (dedicated to avoid request waterfall)

**New lib modules:**
- `src/lib/hook-extractor.ts` -- extract + group hooks from ad creative bodies
- `src/lib/pattern-observer.ts` -- rule-based observation engine

**Key pattern:** Hooks stored as DB rows (queryable). Demographics stay as JSON blobs (read-as-unit). Observations computed at read-time (cheap, always fresh).

### Critical Pitfalls

See PITFALLS.md for all 8 pitfalls with prevention strategies.

1. **Multilingual hook grouping** -- EU ads in 10+ languages; string similarity fails across languages. Group by detected language first, then apply structural pattern classification.
2. **Sparse time-series in Recharts** -- Must use `type="number"` + `scale="time"` with Unix epoch ms and manual tick generation. Recharts auto-ticks break with irregular data (GitHub issues #414, #2126).
3. **demographicsJson schema drift** -- No versioning on JSON blobs. Old and new snapshots may have different shapes. Write a normalizer function as prerequisite before any trend features.
4. **Rule-based observations generating noise** -- "Captain Obvious" problem (restating what charts show) and false significance (reporting 0.3pp shifts). Need minimum delta thresholds and surprise-value ranking.
5. **ad_creative_bodies is an array** -- Current code only reads `[0]`. Multi-variant ads silently lose creative text. Must iterate all elements for hook extraction.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Foundation & Hook Extraction
**Rationale:** Schema migration and data extraction must land before any UI. Hooks require a new Prisma model and expanding `ad_creative_bodies` beyond `[0]`. JSON normalizer is prerequisite for trend charts.
**Delivers:** `CreativeHook` model, `hook-extractor.ts` lib, JSON schema normalizer, expanded creative body extraction
**Addresses:** DF-1 (hooks) data layer, Pitfall #3 (schema drift), Pitfall #6 (array handling)
**Avoids:** Building UI before data is available

### Phase 2: Trend Charts
**Rationale:** Uses existing snapshot data with no schema changes (after normalizer from Phase 1). Highest immediate value for users with multiple snapshots. Independent of comparison and hooks UI.
**Delivers:** `DemographicTrendChart` component, `GET /api/dashboard/trends` endpoint, trend tabs on brand detail page
**Addresses:** TS-1 (trend charts)
**Avoids:** Pitfall #2 (sparse time-series) via d3-scale ticks and minimum 3-snapshot requirement

### Phase 3: Brand Comparison
**Rationale:** Independent of other features. Butterfly/grouped bar chart is visually impressive and table stakes for competitive intelligence tools.
**Delivers:** `/dashboard/compare` page, `GET /api/dashboard/compare` endpoint, mirrored demographic charts, brand picker
**Addresses:** TS-2 (brand comparison)
**Avoids:** Pitfall #5 (mismatched granularity) via confidence indicators and shared axis scales, Pitfall #7 (butterfly chart hacks) via grouped BarChart approach

### Phase 4: Pattern Observations
**Rationale:** Should be LAST because it benefits from temporal data (trend charts) and hook data. Rules are more valuable when more data dimensions exist.
**Delivers:** `pattern-observer.ts` rule engine, `PatternObservations` component, insight cards on brand detail page
**Addresses:** DF-2 (pattern observations)
**Avoids:** Pitfall #4 (obvious/misleading statements) via minimum delta thresholds and surprise-value ranking

### Phase Ordering Rationale

- **Data before UI** -- Phase 1 (data foundation) must complete before Phases 2-4 can display anything
- **Independent features in parallel** -- Phases 2 (trends) and 3 (comparison) have no mutual dependencies and could theoretically be built concurrently
- **Observations last** -- Pattern rules benefit from having trend data and hooks available; more data = more useful observations
- **Pitfall prevention built in** -- Each phase directly addresses the pitfalls mapped to its feature area

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Comparison):** Recharts butterfly/grouped bar implementation specifics; verify negative-value approach vs dual-chart layout
- **Phase 1 (Hooks):** Multilingual language detection library compatibility with Next.js/Vercel edge runtime

Phases with standard patterns (skip research-phase):
- **Phase 2 (Trends):** Recharts LineChart/AreaChart patterns are well-documented and already used in the codebase
- **Phase 4 (Observations):** Pure TypeScript rule engine, no external dependencies or novel patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new deps; verified existing codebase has all needed patterns |
| Features | MEDIUM-HIGH | Competitor analysis confirms table stakes/differentiators; UX specifics need refinement during planning |
| Architecture | HIGH | Based on direct codebase analysis of existing models, endpoints, and components |
| Pitfalls | HIGH | Verified against actual code (e.g., `[0]`-only extraction) and documented Recharts issues |

**Overall confidence:** HIGH

### Gaps to Address

- **Prisma provider discrepancy:** Schema says `postgresql`, PROJECT.md says SQLite -- need to verify actual deployment database before assuming JSON querying capabilities
- **Hook extraction quality:** What percentage of Facebook ads have meaningful `ad_creative_bodies` text? Needs empirical testing with real data during Phase 1
- **Observation thresholds:** Specific percentages for "what counts as interesting" need user testing; ship with reasonable defaults and tune
- **Butterfly chart feasibility:** Recharts grouped BarChart vs negative-value approach needs prototyping during Phase 3 planning

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `facebook-api.ts`, `snapshot-builder.ts`, `demographic-aggregator.ts`, Prisma schema, dashboard components
- Recharts GitHub Issues: #414, #956, #2126, #1137 (time-series handling)
- Foreplay Spyder product pages (hook extraction feature verification)
- Data Viz Project / ChartExpo (butterfly chart patterns)
- NN/g UX research (comparison tables, chart type selection)

### Secondary (MEDIUM confidence)
- Pathmatics/Sensor Tower marketing pages (competitor feature claims)
- SocialPeta feature pages
- Facebook Ad Library API documentation (field structure)

### Tertiary (LOW confidence)
- Ad intelligence vendor listicles (SuperAds, Madgicx) -- used for market landscape only

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
