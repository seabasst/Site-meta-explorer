# Pitfalls Research

**Domain:** Ad Intelligence / Competitive Analysis SaaS -- v3.1 Competitive Intelligence Features
**Researched:** 2026-02-02
**Confidence:** HIGH (based on codebase analysis, API docs, Recharts GitHub issues, and domain research)

## Critical Pitfalls

### Pitfall 1: Multilingual Text Grouping Fails Silently on EU Ad Copy

**Severity:** CRITICAL

**What goes wrong:**
The `ad_creative_bodies` field from the Facebook Graph API returns ad copy in whatever language the advertiser used. EU brands frequently run the same ad concept in DE, FR, NL, ES, IT, PL, SE, etc. A German brand might have "Jetzt 20% sparen" and "Economisez 20% maintenant" as the same hook translated. Naive string-similarity grouping (Levenshtein, Jaccard on tokens) treats these as completely different hooks, fragmenting the frequency table into dozens of language-specific entries. The hook frequency table becomes useless -- showing 15 variations of the same offer instead of "discount hook used in 73% of ads."

**Why it happens:**
Developers default to string-similarity because it is simple and avoids external dependencies. It works for English-only datasets but fails catastrophically for EU multilingual data. The `ad_creative_bodies` array can even contain multiple languages within a single ad (e.g., body text in German, CTA in English).

**How to avoid:**
Since LLM is out of scope, use a pragmatic two-layer approach:
1. **Language detection first** -- group texts by detected language before similarity comparison. Use a lightweight library like `cld3` or `franc` (both work in Node.js). Compare hooks only within the same language.
2. **Normalize aggressively before comparison** -- lowercase, strip emojis/unicode punctuation, collapse whitespace, remove URLs. For "first line / hook extraction," split on `\n` and take the first sentence.
3. **Use n-gram overlap (character trigrams)** instead of word-level Jaccard for within-language similarity. Character n-grams handle morphological variation better in German/French (compound words, conjugations).
4. **Group by semantic pattern, not exact text** -- extract structural patterns: "X% off", "Free [noun]", question-format, urgency-format. Regex-based pattern classification is more useful than fuzzy string matching for hook categorization.
5. **Present results grouped by language with cross-language pattern rollups** -- "Discount hook: 45 ads (DE: 22, FR: 12, NL: 11)."

**Warning signs:**
- Hook frequency table has many entries with count=1 or count=2
- Top hooks all appear in the same language while other languages are fragmented
- Total unique hooks exceeds 50% of total ads analyzed

**Phase to address:**
Ad Creative Hooks feature (first feature phase of v3.1)

---

### Pitfall 2: Sparse and Irregular Snapshot Timelines Produce Misleading Trend Charts

**Severity:** CRITICAL

**What goes wrong:**
Trend charts require multiple snapshots over time, but snapshots are created only when a user manually re-analyzes a brand. A brand might have snapshots at: Day 1, Day 3, Day 45, Day 46, Day 120. Recharts' `LineChart` with `scale="time"` on the XAxis will either (a) compress the Day 1-3 cluster into an indistinguishable blob while stretching Day 3-45 into a long flat line, or (b) if using categorical XAxis, space all points evenly, making the Day 3-to-Day 45 gap invisible -- implying a gradual change that may have been sudden.

Both presentations are misleading. Users draw false conclusions about when demographic shifts happened.

**Why it happens:**
Recharts treats XAxis data as either purely categorical (evenly spaced) or numeric/time-scaled (proportional spacing). Neither default works well for sparse, irregular snapshots. Multiple Recharts GitHub issues (#414, #956, #2126) document this exact problem, and there is no built-in solution. The library requires manual tick generation workarounds.

**How to avoid:**
1. **Use `type="number"` + `scale="time"` + `domain={['dataMin', 'dataMax']}`** on XAxis, with data stored as Unix epoch milliseconds (not Date objects or strings). This gives proportional time spacing.
2. **Generate ticks manually with d3-scale** rather than relying on Recharts' auto-tick generation, which breaks with sparse data (missing ticks issue #2126). Import `scaleTime` from d3-scale and compute sensible tick positions.
3. **Show data points as visible dots**, not just lines. With only 3-5 snapshots, the dots ARE the data. Lines between them are interpolation assumptions.
4. **Add visual gap indicators** when the interval between consecutive snapshots exceeds a threshold (e.g., >30 days). A dashed line segment or a gap marker communicates "we have no data here."
5. **Require a minimum of 3 snapshots** before showing trend charts. With 1-2 points, show a "not enough data" message with a prompt to re-analyze later.
6. **Use `tickFormatter` to display human-readable dates** -- do not pass raw Date objects to Recharts, they render as `[object Object]` or epoch numbers.

**Warning signs:**
- Line charts appear with no visible ticks on XAxis
- Points cluster at the start/end of the chart with a long flat line in between
- Tooltip shows epoch milliseconds instead of formatted dates
- Chart looks identical whether using 2 snapshots or 10

**Phase to address:**
Trend Charts feature phase

---

### Pitfall 3: demographicsJson Schema Drift Between Snapshots

**Severity:** CRITICAL

**What goes wrong:**
The `demographicsJson` column stores the full `AggregatedDemographics` object as JSON. This object's shape comes from `aggregateDemographics()` which depends on the Facebook API response structure. If the API changes field names, adds/removes breakdown categories, or if the aggregation logic is updated between app versions, older snapshots have a different JSON shape than newer ones. Trend charts that compare `snapshot[0].demographicsJson.ageBreakdown` across time will crash or silently show incorrect data when the schema differs.

The existing code already shows this tension: `dashboard/[brandId]/page.tsx` line 91-93 has a `typeof === 'string' ? JSON.parse() : ...` guard, suggesting the JSON field is already inconsistently typed.

**Why it happens:**
JSON columns have no schema enforcement. The data written on Day 1 and the data written on Day 120 may have been produced by different code versions. There is no migration path for existing JSON blobs when the aggregation logic changes.

**How to avoid:**
1. **Version the snapshot JSON** -- add a `schemaVersion: number` field to the stored JSON. Current format is version 1.
2. **Write a normalizer function** that takes any snapshot JSON + its version and returns the current expected shape. This is the ONLY function that reads `demographicsJson` for trend comparisons.
3. **Define a TypeScript interface for the stored JSON shape** (not just `Json?` from Prisma). Use Zod or a manual validator when reading snapshots.
4. **Never assume all snapshots have the same keys.** Use optional chaining and fallback values for every field access: `snapshot.demographicsJson?.ageBreakdown ?? []`.
5. **Test trend charts with synthetic snapshots that have missing/extra fields.**

**Warning signs:**
- Type errors when comparing old vs. new snapshots
- Trend chart shows `null` or `0` for old data points
- `JSON.parse` errors in production logs

**Phase to address:**
Must be addressed BEFORE trend charts -- either as a data-layer prerequisite phase or first task in the trend charts phase.

---

### Pitfall 4: Rule-Based Observations Generating Obvious or Misleading Statements

**Severity:** CRITICAL

**What goes wrong:**
Rule-based pattern observation systems commonly fail in two opposite ways:
1. **Captain Obvious problem:** Generating statements like "The dominant gender is male" when the chart already shows a big blue bar. Users see no value -- the insight just narrates what they can already see.
2. **False significance problem:** Generating "Top country shifted from DE to FR" when DE was 24.8% and FR was 25.1% -- a difference well within noise range for the sample size. The observation implies a meaningful shift when none occurred.

Both failure modes destroy trust in the feature and cause users to ignore all observations.

**Why it happens:**
Rule-based systems trigger on threshold crossings without considering statistical significance or visual redundancy. Developers write rules like `if (topCountry !== previousTopCountry) emit("shifted")` without checking the margin. Similarly, rules that describe what the dominant category is add no value when the chart already communicates this visually.

**How to avoid:**
1. **Define minimum delta thresholds for change observations.** A country shift is only reported if the difference exceeds 5 percentage points. An age skew is only reported if one bracket exceeds the next by >10pp.
2. **Focus rules on non-obvious patterns** -- things hard to spot in charts:
   - Cross-dimension correlations: "Male skew is concentrated in 18-24, female skew in 35-44"
   - Temporal changes: "Gender ratio reversed since [date]" (requires 2+ snapshots)
   - Outliers vs. category norms: "Video percentage (78%) is unusually high" (requires establishing norms)
3. **Never re-state what a single chart already shows.** If there is an age chart, do not generate "dominant age is 25-34." Instead: "25-34 and 35-44 combined account for 72% of reach -- unusually concentrated."
4. **Rank observations by surprise value** -- how far the data deviates from a baseline or expected distribution. Show the top 3-5, not all matching rules.
5. **Add confidence qualifiers:** "likely," "appears to," "based on N snapshots" -- prevent overstatement.

**Warning signs:**
- Observations feel like chart captions, not insights
- Users never click/read the observations section
- Observations contradict each other (one says "skews male," another says "gender balanced")
- Every brand gets the same observations

**Phase to address:**
Pattern Observations feature phase (should be the LAST feature built, after trend charts provide temporal data)

---

### Pitfall 5: Side-by-Side Comparison Breaks with Mismatched Data Granularity

**Severity:** MAJOR

**What goes wrong:**
When comparing Brand A (analyzed with 500 ads, 1.2M total reach) against Brand B (analyzed with 100 ads, 15K total reach), the demographic breakdowns have vastly different statistical reliability. Brand B's "35% from Germany" is based on a handful of low-reach ads and could be noise, while Brand A's "28% from Germany" is based on a large, high-reach sample. Displaying them in mirrored charts implies equal confidence. Users make competitive strategy decisions based on unreliable comparisons.

**Why it happens:**
The comparison UI treats all snapshots as equally valid. The snapshot schema stores `totalAdsFound` and `totalReach` but these are not surfaced in the comparison context. Developers focus on visual symmetry (mirrored charts) without communicating data quality.

**How to avoid:**
1. **Display sample size and total reach alongside each brand in the comparison header.** "Brand A: 500 ads, 1.2M reach" vs. "Brand B: 100 ads, 15K reach."
2. **Add a confidence indicator** -- if one brand has <50 ads or <10K reach, show a warning badge: "Low sample size -- results may not be representative."
3. **Normalize chart scales to the same range** -- do not let Brand A's Y-axis go to 40% while Brand B's goes to 60%. Use the same scale for both so visual comparison is accurate.
4. **Use the most recent snapshot for each brand** by default, but show the snapshot date. If snapshots are weeks apart, warn: "Snapshots from different time periods."
5. **Handle missing demographic categories.** Brand A might have data for 8 countries while Brand B shows only 3. The comparison chart must show all categories from both brands, with 0% for missing ones.

**Warning signs:**
- Charts have different Y-axis scales (only noticeable if you read the numbers)
- One brand's bars are dramatically taller than the other's despite similar percentages
- Missing country bars create visual asymmetry that implies one brand does not target that country (vs. just having no data)

**Phase to address:**
Brand Comparison feature phase

---

### Pitfall 6: ad_creative_bodies Returns Array, Not String -- Silent Data Loss

**Severity:** MAJOR

**What goes wrong:**
The Facebook API field `ad_creative_bodies` is a `string[]` (array), not a single string. The current codebase extracts only the first element: `creativeBody: ad.ad_creative_bodies?.[0] || null` (facebook-api.ts line 741). This means multi-variant ads or ads with multiple text blocks lose all content except the first body. For hook extraction, this silently discards potentially the majority of creative text variations.

Additionally, a single ad can contain A/B test variants where different hooks target different audiences. Extracting only `[0]` means the hook analysis reflects only one variant, not the full creative strategy.

**Why it happens:**
The v1.0 implementation needed a single display string for ad previews, so taking `[0]` was reasonable. But hook extraction needs ALL bodies from ALL ads to accurately count hook frequency.

**How to avoid:**
1. **For hook extraction, iterate all elements in `ad_creative_bodies`**, not just `[0]`. Each element is a separate creative body that should contribute to hook frequency.
2. **Weight each body by the ad's reach divided by the number of bodies** -- since you cannot know which variant drove the reach, assume equal distribution.
3. **Deduplicate identical bodies within the same ad** before counting -- some ads repeat the same text across variants.
4. **Track the source** -- whether a hook came from body index 0 vs. index 2 may indicate primary vs. variant creative.

**Warning signs:**
- Hook extraction finds far fewer unique hooks than expected
- Brands with known multi-variant strategies show surprisingly uniform hooks
- Total hooks analyzed is much less than total ads * average bodies per ad

**Phase to address:**
Ad Creative Hooks feature phase (first task: expand text extraction beyond `[0]`)

---

### Pitfall 7: Recharts Mirrored/Butterfly Charts Are Not a Built-in Feature

**Severity:** MAJOR

**What goes wrong:**
"Side-by-side mirrored demographic charts" often implies a butterfly chart (horizontal bar chart with Brand A going left, Brand B going right, sharing a center axis). Recharts has no built-in butterfly chart component. Developers attempt to hack it with negative values on a BarChart, which creates problems: tooltips show negative numbers, axis labels are wrong, and the hack breaks on responsive resize.

**Why it happens:**
Butterfly/pyramid charts are a common data visualization pattern for comparisons but are not standard in most React charting libraries. Developers see examples online and assume it is straightforward, underestimating the customization required.

**How to avoid:**
1. **Do not use negative-value hacks for butterfly charts.** The tooltip, accessibility, and axis label problems are not worth it.
2. **Use two separate horizontal BarCharts placed side by side** with a shared category axis in the center. This is simpler, more accessible, and works responsively.
3. **Alternatively, use a grouped BarChart** with Brand A and Brand B as two series in different colors. This is the simplest Recharts-native approach and avoids all the butterfly chart hacks.
4. **Consider a simple table with inline bar indicators** for the comparison -- often more informative than charts for direct numeric comparison.
5. **Test responsive behavior at 375px** -- two side-by-side charts may not fit on mobile. Have a stacked fallback layout.

**Warning signs:**
- Negative numbers appearing in tooltips
- Chart axis labels showing "-30%" when the actual value is 30%
- Layout breaks on mobile viewport
- Excessive custom Recharts configuration (>50 lines for a single chart)

**Phase to address:**
Brand Comparison feature phase

---

### Pitfall 8: Hook Extraction Treats Full Ad Body as "Hook" Instead of First Line

**Severity:** MAJOR

**What goes wrong:**
An "ad hook" is the opening line -- the first thing a viewer reads. Facebook ad bodies can be multi-paragraph. If the extraction simply uses the full `ad_creative_bodies[i]` string as the "hook," the similarity grouping operates on entire paragraphs. Two ads with the identical opening hook but different body copy are treated as different hooks. The frequency table becomes noisy and the grouping loses its purpose.

**Why it happens:**
"Extract hooks/opening lines" seems simple -- just get the text. But ad copy formatting is inconsistent: some use `\n` for line breaks, some use `...` as a read-more indicator, some have no line breaks at all but use sentence structure. There is no universal "first line" delimiter.

**How to avoid:**
1. **Split on newline first, take the first non-empty line.** This handles the most common case.
2. **If no newline exists, split on sentence boundary** (period/exclamation/question mark followed by space). Take the first sentence.
3. **Cap hook length at ~100 characters.** If the first "line" is a full paragraph, truncate to the first clause or at a natural break.
4. **Strip leading emojis/special characters** that are decorative, not part of the hook message.
5. **Store both the extracted hook AND the full body** so users can see context when they click on a hook in the frequency table.

**Warning signs:**
- Average hook length exceeds 200 characters
- Similarity grouping finds almost no duplicates
- Hook frequency table entries are truncated awkwardly in the UI

**Phase to address:**
Ad Creative Hooks feature phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing hooks as a derived JSON field on BrandSnapshot | No schema migration needed | Cannot query/filter hooks across brands; hooks tied to snapshot lifecycle | Acceptable for v3.1 MVP; extract to normalized table if hook search is added later |
| Hardcoded rule thresholds (e.g., 5pp delta for "shift") | Ships faster, no config UI needed | Thresholds may not suit all brand sizes; no user tuning | Acceptable permanently -- keep rules opinionated, not configurable |
| Using character n-gram similarity instead of proper NLP embeddings | No external API dependency, fast, works offline | Will not catch semantic similarity across different phrasings in the same language | Acceptable given LLM is out of scope; revisit only if hook grouping accuracy complaints arise |
| Categorical XAxis as fallback for <5 snapshots | Simpler implementation, avoids d3-scale dependency | Misrepresents time gaps between snapshots | Never acceptable -- even with 3 points, time proportionality matters. Use time scale from the start |
| Comparing latest snapshot only (no snapshot picker) | Simpler comparison UI | Cannot compare brands at the same point in time | Acceptable for v3.1 MVP; add snapshot picker in v3.2 if needed |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Facebook Graph API `ad_creative_bodies` | Treating as single string (only reading `[0]`) | Iterate all array elements; each is a separate creative variant |
| Facebook Graph API `languages` field | Assuming it reliably indicates the text language | Use actual language detection on the text -- the `languages` field reflects targeting, not content language |
| Prisma JSON fields on PostgreSQL | Assuming `demographicsJson` can be queried with Prisma's JSON filters | Prisma JSON filtering works on PostgreSQL but current schema uses `Json?` type -- test JSON path queries work correctly before building features on them |
| Recharts `scale="time"` | Passing Date objects or ISO strings as XAxis data | Must use Unix epoch milliseconds (numbers) with `type="number"` and `tickFormatter` for display |
| Recharts responsive container | Assuming `ResponsiveContainer` handles all viewport sizes | At 375px mobile width, side-by-side charts overflow; need explicit breakpoint-based layout switching |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all snapshots for all brands on comparison page | Slow page load, high memory on client | Fetch only the 2 selected brands' latest snapshots; lazy-load historical data for trends | >20 brands with >10 snapshots each |
| Running hook extraction + similarity grouping client-side | UI freezes during analysis of 500+ ads | Move hook extraction to the API route that fetches ads; return pre-grouped hooks in the response | >200 ads with multi-body creatives |
| Storing full ad creative text in the snapshot JSON | Snapshot JSON blob grows from ~2KB to ~50KB+ per snapshot | Store hooks separately or store only extracted/grouped hooks, not raw text | >50 snapshots per brand with 500-ad analysis depth |
| Re-computing trend data on every page load | Slow dashboard load as snapshot count grows | Trend data is already stored in snapshots -- ensure the API returns only the fields needed for trend charts (not full demographicsJson for each point) | >20 snapshots per brand |
| N-gram similarity computation is O(n^2) on hook count | Grouping becomes slow with many unique hooks | Pre-filter exact duplicates first (O(n) with Map), then run similarity only on unique hooks; cap at top 200 unique hooks | >500 unique hook strings |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing trend chart with 1 snapshot | User sees a single dot and no line, thinks feature is broken | Show "Analyze this brand again later to see trends" message; hide trend chart until 3+ snapshots exist |
| Comparison page with no brands saved | User navigates to comparison, sees empty state with no guidance | Show a clear CTA: "Save at least 2 brands from the dashboard to compare them" |
| Hook frequency table showing 100+ entries | Information overload, cannot find patterns | Show top 10 hooks by reach-weighted frequency; add "Show all" toggle for power users |
| Pattern observations that use technical language | "Gender coefficient: 0.67 male-skewed" means nothing to marketers | Use plain language: "Your competitor reaches mostly men (67%). Women are underrepresented in their ads." |
| Trend chart with no Y-axis context | User sees a line going from 30 to 35 and thinks it is a massive shift | Always show Y-axis from 0-100% for percentage metrics; add reference lines for notable thresholds |
| Mirrored comparison charts without labels | User cannot tell which side is which brand | Color-code brands consistently across ALL charts; add brand name labels on each side |

## "Looks Done But Isn't" Checklist

- [ ] **Hook extraction:** Often missing multi-body handling -- verify hooks are extracted from ALL elements in `ad_creative_bodies`, not just `[0]`
- [ ] **Hook grouping:** Often missing language awareness -- verify that "Jetzt kaufen" and "Buy now" are not grouped as similar (they are different languages), but "Jetzt kaufen" and "Jetzt kaufen!" ARE grouped
- [ ] **Trend charts:** Often missing empty-state -- verify what happens with 0, 1, and 2 snapshots (not just the happy path of 5+)
- [ ] **Trend charts:** Often missing timezone handling -- verify `snapshotDate` is displayed in user-local time, not UTC, on the XAxis
- [ ] **Comparison:** Often missing asymmetric data -- verify comparison works when Brand A has 8 countries and Brand B has 2 (missing categories should show 0%, not be omitted)
- [ ] **Comparison:** Often missing equal Y-axis scales -- verify both brands use the same axis range so visual comparison is accurate
- [ ] **Pattern observations:** Often missing edge cases -- verify rules handle: all-equal distributions, single-country brands, brands with 0 reach, brands with only 1 snapshot (no temporal patterns possible)
- [ ] **Pattern observations:** Often missing "no patterns found" state -- verify the UI handles brands where no rules trigger (boring data is still valid)
- [ ] **Overall:** Often missing loading states -- verify skeleton loaders exist for hook extraction (slow), trend data loading, and comparison data fetching

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| demographicsJson schema drift | MEDIUM | Write a migration script that reads all existing snapshots and re-serializes through the normalizer; backfill schemaVersion field |
| Hook extraction only reading `[0]` | LOW | Update extraction to iterate all bodies; re-run extraction on next brand re-analysis (no historical data to fix) |
| Misleading trend charts (categorical axis) | LOW | Swap XAxis to `type="number"` + `scale="time"` with manual ticks; no data migration needed |
| Rule-based observations generating noise | LOW | Tighten thresholds and add delta minimums; no data migration, just logic changes |
| Comparison charts with different Y-axis scales | LOW | Add shared domain calculation: `[0, Math.max(brandAMax, brandBMax)]`; pure UI fix |
| Performance bottleneck from client-side hook grouping | MEDIUM | Move to server-side in API route; requires refactoring the data flow but no schema changes |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Multilingual text grouping fails (#1) | Ad Creative Hooks | Run hook extraction on a known multilingual brand; verify grouped hooks are same-language only; verify cross-language pattern rollups work |
| Sparse timeline misleading charts (#2) | Trend Charts | Test with 1, 2, 3, and 10 snapshots at irregular intervals; verify time-proportional spacing; verify gap indicators |
| demographicsJson schema drift (#3) | Trend Charts (prerequisite) | Write normalizer first; test with synthetic snapshots missing fields; verify trend chart handles gracefully |
| Rule-based observations noise (#4) | Pattern Observations (last phase) | Generate observations for 5+ real brands; review each for obviousness and false significance; user-test with a marketer |
| Mismatched data granularity in comparison (#5) | Brand Comparison | Compare a 500-ad brand with a 100-ad brand; verify confidence indicators display; verify shared axis scales |
| ad_creative_bodies array handling (#6) | Ad Creative Hooks (first task) | Log array lengths during extraction; verify multi-body ads contribute all bodies to hook analysis |
| Butterfly chart hack pitfalls (#7) | Brand Comparison | Use grouped BarChart, not butterfly hack; verify tooltips show correct positive values; test at 375px width |
| Hook = full body instead of first line (#8) | Ad Creative Hooks | Verify average extracted hook length is <100 chars; spot-check 20 hooks against source ads |

## Sources

- Recharts GitHub Issue #414: [Irregular time series](https://github.com/recharts/recharts/issues/414)
- Recharts GitHub Issue #956: [Time series example](https://github.com/recharts/recharts/issues/956)
- Recharts GitHub Issue #2126: [Missing X ticks for time series with gaps](https://github.com/recharts/recharts/issues/2126)
- Recharts GitHub Issue #1137: [Scale time with intervals](https://github.com/recharts/recharts/issues/1137)
- Codebase analysis: `facebook-api.ts` line 741 (`ad_creative_bodies?.[0]`), `snapshot-builder.ts`, `demographic-aggregator.ts`
- Codebase analysis: `dashboard/[brandId]/page.tsx` lines 89-93 (JSON type inconsistency)
- Prisma GitHub Issue #3786: [JSON field type in SQLite](https://github.com/prisma/prisma/issues/3786)
- [Handling Irregularly Spaced Time Series Data](https://medium.com/@kyle-t-jones/handling-irregularly-spaced-time-series-data-2399c5411832) -- Medium
- [Dashboard Design Best Practices 2025](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/) -- Smashing Magazine
- [SQLite JSON Functions Documentation](https://www.sqlite.org/json1.html)
- Facebook Graph API documentation for `ad_creative_bodies` field structure

---
*Pitfalls research for: Ad Intelligence Competitive Analysis SaaS v3.1*
*Researched: 2026-02-02*
