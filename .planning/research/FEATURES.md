# Feature Landscape: v3.1 Competitive Intelligence

**Domain:** Ad Intelligence / Competitive Analysis SaaS
**Researched:** 2026-02-02
**Overall confidence:** MEDIUM-HIGH (features grounded in competitor analysis + existing codebase data model)

## Table Stakes

Features users expect from any ad intelligence tool offering competitive analysis. Missing = product feels incomplete or half-baked.

### TS-1: Demographic Trend Charts (Time-Series)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Pathmatics, SocialPeta, and Sensor Tower all show historical trend lines. Any tool with historical snapshots that does NOT show trends over time frustrates users -- they have the data, why can they not see it change? The app already stores multiple `BrandSnapshot` records per brand with `snapshotDate` and full `demographicsJson`. Not surfacing this as a chart is a missed obvious step. |
| **Complexity** | Medium |
| **What competitors do** | Pathmatics: line charts of spend/impressions over time with daily granularity. SocialPeta: advertiser ranking trend charts. Kantar: media mix trend overlays. All use line/area charts with selectable date ranges. |
| **Expected UX** | Line chart (or stacked area chart) with X-axis = snapshot dates, Y-axis = percentage. Separate charts or tabs for: (1) age distribution over time, (2) gender split over time, (3) top countries over time. Users expect to select a brand, see its demographic shifts across all stored snapshots. Tooltip on hover showing exact values per snapshot. Date range selector if many snapshots exist. |
| **Data dependency** | Requires 2+ snapshots for the same brand. Data already exists: `BrandSnapshot.demographicsJson` stores full age/gender/region breakdowns per snapshot, indexed by `[trackedBrandId, snapshotDate]`. No schema changes needed. |
| **Key decisions** | (1) Chart type: line chart (cleaner for few snapshots) vs stacked area (better for composition). Recommend **line chart** with one line per age group / gender / country -- it works with as few as 2 data points. (2) Where to show: brand detail page `[brandId]/page.tsx`, new "Trends" tab or section below current snapshot view. |
| **Risk** | LOW. Straightforward Recharts implementation over existing data. The main UX risk is brands with only 1 snapshot showing an empty/useless chart -- handle with "Re-analyze to track changes over time" prompt. |

### TS-2: Side-by-Side Brand Comparison

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Pathmatics lets users compare up to 20 advertisers side by side. Moat (before shutdown) offered competitive benchmarking with brand-vs-brand views. AdSpy/BigSpy offer comparison filters. Any brand tracking dashboard that shows multiple brands but cannot compare them side by side is missing the core value proposition of tracking competitors. |
| **Complexity** | Medium |
| **What competitors do** | Pathmatics: up to 20 brands in parallel columns, share-of-voice charts, spend comparison. SocialPeta: brand-vs-brand with audience overlap analysis. Moat: side-by-side creative and metric comparison. Most tools use paired/grouped bar charts or butterfly charts for demographic comparison. |
| **Expected UX** | User selects exactly 2 brands from their saved brands (dropdown or card picker). View shows mirrored/paired charts: (1) **Butterfly chart** for age-gender distribution -- Brand A bars extend left, Brand B bars extend right, shared age-range axis in center. This is the gold standard for demographic comparison (population pyramid pattern). (2) Paired horizontal bars for country distribution. (3) Summary metrics table (total reach, ad count, spend, dominant demo) side by side. The existing `DemographicsComparison` component already renders stacked bars per brand -- this feature elevates it to a dedicated full-page comparison view with richer chart types. |
| **Data dependency** | Requires 2+ saved brands with at least 1 snapshot each. Uses latest `BrandSnapshot.demographicsJson` for each brand. No schema changes. |
| **Key decisions** | (1) Butterfly chart vs simple paired bars. Recommend **butterfly chart** -- it is the recognized pattern for demographic comparison (see Data Viz Project, Zoho Analytics, Qlik all support it). Recharts does not have a native butterfly chart, but it can be built with two stacked `BarChart` components or a single chart with negative values for Brand A. (2) Limit to 2 brands (butterfly) or support N brands (grouped bars). Recommend **start with 2** -- butterfly is cleaner and more impactful than N-way grouped bars. (3) Entry point: dedicated `/dashboard/compare` route with brand picker, or inline in dashboard. |
| **Risk** | MEDIUM. Butterfly chart in Recharts requires custom implementation (negative value trick or dual chart layout). Not a standard Recharts component. Budget extra time for chart engineering. |

## Differentiators

Features that set the product apart. Not expected by users, but valued when present. These are competitive advantages.

### DF-1: Ad Creative Hooks / Opening Lines Extraction

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Foreplay's Spyder is the ONLY major tool that auto-extracts hooks from ad copy, and it charges $99-249/month for the privilege. This is a genuine differentiator in the market. Most ad spy tools (AdSpy, BigSpy, Minea) treat ad text as searchable but do not extract, group, or analyze the text patterns. Offering hook extraction on Facebook Ad Library data -- which is free and public -- is a strong competitive wedge. |
| **Complexity** | Medium-High |
| **What competitors do** | **Foreplay Spyder**: Dedicated "Hooks" tab, auto-transcribes video hooks, extracts opening lines, lets users browse hundreds of hooks, pin favorites, export to CSV. **Bestever**: Scores hook engagement, detects hook fatigue, compares hooks to top performers. **Everyone else**: Ad copy is shown raw; users must manually read and pattern-match. No grouping, no frequency analysis, no reach weighting. |
| **Expected UX** | (1) **Extraction**: For each ad, extract the first sentence (or first N characters up to first sentence break) from `ad_creative_bodies[0]`. This is the "hook." (2) **Grouping**: Cluster similar hooks using fuzzy string matching or simple normalization (lowercase, strip emojis, collapse whitespace). Show groups ranked by frequency. (3) **Frequency weighted by reach**: Each hook group shows: count of ads using it, total reach of those ads, average reach per ad. This surfaces hooks that are not just common but effective. (4) **Display**: Card or list view, each hook group shows the canonical phrase, frequency badge, reach metric, and expandable list of actual ads using it. (5) **Filter/search**: Users should be able to search hooks or filter by reach threshold. |
| **Data dependency** | `FacebookAdResult.creativeBody` (mapped from `ad_creative_bodies[0]`) is already fetched and available in the API result. However, it is NOT currently stored in `BrandSnapshot` -- the snapshot only stores aggregated demographic metrics. For hooks analysis to work on saved brands (not just live analysis), the raw ad texts would need to be stored. **Two options**: (A) store hooks at snapshot time (new `hooksJson` field on `BrandSnapshot`), or (B) only show hooks during live analysis (no persistence). Recommend (A) for saved brands. |
| **Key decisions** | (1) NLP approach: simple first-sentence extraction (split on `.` `!` `?` or first 100 chars) vs LLM-based extraction. Recommend **simple extraction first** -- no AI dependency, deterministic, fast. LLM refinement can come later. (2) Grouping algorithm: exact match after normalization vs fuzzy matching (Levenshtein distance). Recommend **normalized exact match first** (lowercase, strip punctuation/emojis, trim) -- covers 80% of cases. Fuzzy can be a v3.2 enhancement. (3) Storage: new JSON field on BrandSnapshot vs separate HookGroup table. Recommend **JSON field** for simplicity -- `hooksJson` storing `Array<{ hook: string, count: number, totalReach: number, adIds: string[] }>`. |
| **Risk** | MEDIUM. Quality of extraction depends heavily on ad copy structure. Some ads have no clear "hook" (single word, emoji-only, or very short text). Need graceful handling of edge cases. Grouping accuracy with simple normalization may be low for paraphrased hooks (e.g., "Stop doing X" vs "Why you should stop doing X"). Accept this limitation for v3.1 and flag fuzzy matching for v3.2. |

### DF-2: Rule-Based Pattern Observations (Auto-Generated Insights)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Most ad intelligence tools present data but leave interpretation to the user. AI-powered insight tools (Improvado, Adverity, Polymer) charge enterprise prices ($500+/month) for automated pattern detection. Offering rule-based factual observations (not AI-generated) is a lightweight alternative that adds significant perceived value. Phrases like "Skews 25-34 male" or "Top country shifted DE to FR since last analysis" make users feel the tool is doing analytical work for them. |
| **Complexity** | Medium |
| **What competitors do** | **Pathmatics/Sensor Tower**: AI-powered insights with natural language summaries of trends. **Improvado**: Conversational AI agent for data querying. **Polymer**: Statistically significant pattern highlighting. **PowerAdSpy**: AI audience analysis recommendations. These are all AI/ML-heavy. **No one in this tier** (sub-$50/month) offers even rule-based observations. This is a blue ocean at the lower price point. |
| **Expected UX** | (1) **Observation cards**: Small, scannable text blocks displayed alongside demographic charts. Each observation is a single factual statement derived from the data. (2) **Types of observations**: - **Dominant skew**: "Audience skews 25-34 male (42% of reach)" - **Gender imbalance**: "67% female audience -- significantly above platform average" - **Geographic concentration**: "80% of reach concentrated in top 2 countries (DE, FR)" - **Temporal shift** (requires 2+ snapshots): "Top country shifted from DE to FR since [date]" - **Age shift**: "25-34 age group grew from 30% to 45% over last 3 analyses" - **Hook pattern**: "Most common hook pattern used in 12 of 47 ads" (3) **Confidence/strength indicator**: Simple visual indicator (strong/moderate/weak pattern) based on data volume and magnitude of observation. (4) **Placement**: Summary section at top of brand detail page, before charts. Users see insights first, then can drill into charts. |
| **Data dependency** | All observations derived from existing `BrandSnapshot` fields. Single-snapshot observations use current snapshot data. Temporal observations require 2+ snapshots and compare latest vs previous (or latest vs oldest). Hook observations require DF-1 to be implemented first. |
| **Key decisions** | (1) Rule engine approach: hardcoded rules in TypeScript vs configurable rule definitions. Recommend **hardcoded rules** for v3.1 -- there will be at most 8-12 rules, not worth abstracting. (2) Threshold values: what counts as "skewed"? Recommend >60% for gender skew, >35% for age group dominance, >50% for geographic concentration. These can be tuned. (3) Temporal comparison: compare latest snapshot to immediately previous vs to first snapshot. Recommend **latest vs previous** -- more actionable for "what changed recently." (4) Observation limit: show all applicable or cap at top N. Recommend **top 5 most interesting** ranked by magnitude of the signal. |
| **Risk** | LOW-MEDIUM. Risk is not technical but editorial: observations that state the obvious ("Your brand runs ads in Germany" for a German brand) feel dumb. Need threshold tuning to ensure observations are genuinely insightful. Build in a minimum significance threshold. |

## Anti-Features

Features to explicitly NOT build for v3.1. Common mistakes in this domain.

### AF-1: AI/LLM-Powered Natural Language Insights

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Using GPT/Claude API to generate natural language analysis of demographics | Adds API cost per analysis, latency, unpredictable output quality, hallucination risk for factual claims about data. Enterprise tools charge $500+/month partly because of this cost. At sub-$50/month pricing, LLM inference cost could exceed revenue per user. Also creates a dependency on external AI API availability. | Rule-based observations (DF-2) that are deterministic, free to compute, instant, and guaranteed factual. If a rule says "skews 25-34 male," it is verifiably true from the data. LLM output cannot make this guarantee. |

### AF-2: Fuzzy/Semantic Hook Clustering

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Using embeddings or NLP to cluster semantically similar hooks (e.g., grouping "Stop using X" with "Why you should quit X") | Significant engineering complexity (embedding model, vector similarity, clustering algorithm). Unclear ROI -- most ad hooks within a single brand are either identical or very different. Semantic clustering adds value primarily across thousands of brands, not within a single brand's 20-100 ads. | Simple normalized string matching for v3.1. Group hooks that are textually identical after lowercasing and punctuation stripping. Flag semantic clustering as a v3.2+ enhancement once user feedback confirms demand. |

### AF-3: Real-Time Competitor Monitoring / Alerts

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Background jobs that automatically re-analyze saved brands on a schedule and send email/push alerts when demographics change | Requires background job infrastructure (cron, queue), significantly increases API usage against Facebook (rate limits: 200 calls/hour), needs notification system (email/push), and ongoing compute costs. This is a major infrastructure investment for a feature that is better suited to v4.0+. | Manual re-analysis (already built in v3.0) with the new temporal observations (DF-2) surfacing what changed since last analysis. Users trigger re-analysis when they want fresh data. |

### AF-4: N-Way Brand Comparison (3+ Brands)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Supporting comparison of 3, 4, or more brands simultaneously | Butterfly charts only work with 2 datasets. Grouped bar charts for 4+ brands become visually cluttered and hard to read. Pathmatics supports 20-brand comparison but has a dedicated enterprise UX team. The engineering cost of making N-way comparison usable does not justify the value for v3.1. | 2-brand comparison (TS-2) with butterfly charts. Clean, focused, immediately useful. If users request N-way, consider grouped bar charts in v3.2. |

### AF-5: Video Hook Transcription

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Transcribing video ad audio to extract spoken hooks (like Foreplay Spyder does) | Requires speech-to-text API (Whisper, etc.), video download infrastructure, significant compute cost, and the Facebook Ad Library API provides `ad_snapshot_url` but not direct video file URLs. Downloading and transcribing videos at scale is a fundamentally different infrastructure problem. | Extract hooks from `ad_creative_bodies` text only. This is the ad copy text that Facebook already provides via the API. Most Facebook ads have text hooks in the creative body, even if the video has a different spoken hook. |

## Feature Dependencies

```
TS-1: Trend Charts ──────────────────────┐
  (standalone, uses existing snapshots)   │
                                          ├──> DF-2: Pattern Observations
TS-2: Brand Comparison                    │    (uses trends for temporal observations,
  (standalone, uses existing snapshots)   │     uses hooks for hook observations)
                                          │
DF-1: Hook Extraction ───────────────────┘
  (standalone for live analysis,
   needs schema change for persistence)
```

**Dependency details:**
- **TS-1 (Trends)** and **TS-2 (Comparison)** are fully independent of each other and of DF-1. They use existing `BrandSnapshot` data with no schema changes.
- **DF-1 (Hooks)** is independent for live analysis (data already in API result). Requires a new `hooksJson` field on `BrandSnapshot` if hooks should persist for saved brands.
- **DF-2 (Observations)** depends on the data from TS-1 (temporal observations compare snapshots over time) and optionally DF-1 (hook pattern observations). However, DF-2 can ship with a subset of rules that only use single-snapshot data, making it partially independent.

**Recommended build order:**
1. TS-1 (Trend Charts) -- immediate value, no schema changes
2. TS-2 (Brand Comparison) -- immediate value, no schema changes
3. DF-1 (Hook Extraction) -- schema migration needed, medium-high complexity
4. DF-2 (Pattern Observations) -- depends on others being available for full rule set

## MVP Recommendation

For v3.1 MVP, implement all 4 features but phase them:

**Phase A (foundations, highest ROI):**
1. **TS-1: Trend Charts** -- lowest complexity, uses existing data, biggest "wow" factor for users who have re-analyzed brands
2. **TS-2: Brand Comparison** -- expected feature for any competitive intelligence tool, butterfly chart is visually impressive

**Phase B (differentiation):**
3. **DF-1: Hook Extraction** -- unique in the free/low-cost tier, requires schema migration
4. **DF-2: Pattern Observations** -- ties everything together with auto-generated insights

**Defer to post-v3.1:**
- Fuzzy hook clustering (AF-2): Wait for user feedback on simple grouping
- N-way comparison (AF-4): Start with 2-brand, expand based on demand
- Video transcription (AF-5): Fundamentally different infrastructure
- Real-time monitoring (AF-3): Major infrastructure investment

## UX Pattern Reference

### Trend Charts (TS-1)
- **Chart type:** Multi-line chart (Recharts `LineChart` with multiple `Line` elements)
- **Interaction:** Hover tooltips, clickable legend to toggle series
- **Layout:** Tabbed sections (Age | Gender | Country) on brand detail page
- **Empty state:** "Re-analyze this brand to track changes over time" with CTA button
- **Precedent:** Google Analytics audience reports, Pathmatics spend trend charts

### Brand Comparison (TS-2)
- **Chart type:** Butterfly/population pyramid chart (negative-value bar trick in Recharts)
- **Interaction:** Brand picker (2 dropdowns or cards), charts update on selection
- **Layout:** Dedicated `/dashboard/compare` page or modal. Brand A on left, Brand B on right. Shared axis labels in center.
- **Empty state:** "Save 2+ brands to compare them" with link to analysis page
- **Precedent:** Population pyramids (UN, census.gov), Pathmatics brand comparison

### Hook Extraction (DF-1)
- **Display:** Card list, each card = one hook group. Shows: hook text, frequency badge, reach metric bar
- **Interaction:** Click to expand and see all ads using that hook. Search/filter bar at top.
- **Layout:** New "Hooks" tab on brand detail page (alongside Demographics, Trends)
- **Empty state:** "No text hooks found in ads" (some ads are image-only with no creative body)
- **Precedent:** Foreplay Spyder Hooks tab, tag cloud visualizations

### Pattern Observations (DF-2)
- **Display:** Compact insight cards with icon + single sentence + optional metric badge
- **Interaction:** Non-interactive (read-only observations). Optional: click to scroll to relevant chart section.
- **Layout:** Summary row at top of brand detail page, above charts. Horizontally scrollable card strip on mobile.
- **Empty state:** Hidden entirely when no significant patterns detected (do not show "No insights found")
- **Precedent:** Google Analytics Intelligence alerts, Polymer highlights, Apple Health summaries

## Complexity Summary

| Feature | Complexity | Schema Change | New Routes | New Components | Estimated Effort |
|---------|-----------|---------------|------------|----------------|-----------------|
| TS-1: Trend Charts | Medium | None | GET snapshots history (exists) | TrendChart, TrendTabs | 2-3 tasks |
| TS-2: Brand Comparison | Medium | None | None (client-side) | ComparisonView, ButterflyChart, BrandPicker | 2-3 tasks |
| DF-1: Hook Extraction | Medium-High | `hooksJson` on BrandSnapshot | None (computed at analysis time) | HooksList, HookCard, HookExtractor (lib) | 3-4 tasks |
| DF-2: Pattern Observations | Medium | None | None (computed client-side) | ObservationCard, ObservationEngine (lib) | 2-3 tasks |

## Sources

- [Pathmatics by Sensor Tower - Features](https://sensortower.com/product/digital-advertising/pathmatics) (MEDIUM confidence - marketing page, feature claims)
- [Foreplay Spyder Ad Spy - Hook Extraction](https://www.foreplay.co/spyder-ad-spy) (HIGH confidence - product page with feature details)
- [Foreplay Spyder 2.0 - Auto Hook Extraction](https://www.foreplay.co/post/spyder-2-0) (HIGH confidence - product announcement)
- [SocialPeta Features](https://socialpeta.com/features) (MEDIUM confidence - marketing page)
- [Butterfly Chart - Data Viz Project](https://datavizproject.com/data-type/butterfly-chart/) (HIGH confidence - reference documentation)
- [Butterfly Chart - ChartExpo](https://chartexpo.com/blog/butterfly-chart) (HIGH confidence - visualization guide)
- [NN/g Comparison Tables](https://www.nngroup.com/articles/comparison-tables/) (HIGH confidence - UX research authority)
- [NN/g Choosing Chart Types](https://www.nngroup.com/articles/choosing-chart-types/) (HIGH confidence - UX research authority)
- [Moat Alternatives - Bestever](https://www.bestever.ai/post/moat-ads) (MEDIUM confidence - competitor blog)
- [Facebook Ad Library API Guide](https://admanage.ai/blog/facebook-ads-library-api) (MEDIUM confidence - third-party guide)
- [Improvado AI Reporting Tools](https://improvado.io/blog/top-ai-reporting-tools) (MEDIUM confidence - vendor content)
- [Ad Intelligence Tools - SuperAds](https://www.superads.ai/blog/ad-intelligence-tools) (LOW confidence - vendor listicle)
- [Ad Intelligence Tools - Madgicx](https://madgicx.com/blog/ad-intelligence-tools) (LOW confidence - vendor listicle)

---

*Research completed: 2026-02-02*
*Researcher: Claude (gsd-research-project)*
