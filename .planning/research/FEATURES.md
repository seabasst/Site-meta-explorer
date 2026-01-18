# Features Research

**Domain:** Facebook Ad Library Demographic Analysis Tools
**Researched:** 2026-01-18
**Confidence:** MEDIUM (based on WebSearch verification across multiple sources)

## Executive Summary

The Facebook Ad Library analysis tool market is divided into two tiers: free tools (Meta's native Ad Library) that lack aggregation and export, and paid spy tools ($50-250/month) that focus on creative inspiration over demographic analysis. The demographic aggregation use case is underserved — most tools show per-ad data without combining it into actionable audience insights.

**Key opportunity:** No tool currently aggregates demographic data from multiple ads into a single audience profile. This is the core differentiator for this project.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| URL input validation | Users paste URLs — must handle variations | Low | Ad Library URLs have predictable patterns |
| Ad discovery from page | Shows the ads being analyzed | Medium | Already implemented in current scraper |
| Demographic breakdown display | Core value proposition | Medium | Age, gender, country percentages |
| Loading/progress indication | Scraping takes time, users need feedback | Low | Critical for 60s operations |
| Error handling with clear messages | Scraping can fail — users need actionable feedback | Low | Rate limits, missing data, invalid URLs |
| Mobile-responsive display | Users may check on phone | Low | Already using Tailwind |
| Top performer identification | Users want winning ads, not all ads | Medium | By reach range or ad duration |

### Why These Are Table Stakes

Based on competitor tool reviews, users abandon tools that:
- Fail silently without explaining why
- Don't show progress during long operations
- Display raw data without meaningful organization
- Can't handle basic URL variations

---

## Differentiators

Features that set the product apart. Not expected, but highly valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Aggregated demographic summary** | See WHO competitors reach across all top ads, not one at a time | High | Core differentiator — no competitor does this well |
| **Weighted aggregation by reach** | Higher-reach ads contribute more to summary | Medium | More accurate audience profile |
| **Visual demographic charts** | Instant comprehension vs reading numbers | Medium | Population pyramids, pie/donut charts |
| **Country/region breakdown** | Geographic targeting insights | Medium | Available in EU Ad Library data |
| **Ad duration as proxy for success** | Long-running = profitable | Low | Calculate from start date |
| **Single-page summary view** | No clicking around — all insights at glance | Low | UX differentiator |
| **No account/login required** | Friction-free analysis | Low | Unlike paid spy tools |

### Aggregation Detail

The killer feature is aggregation. Current landscape:
- **Meta Ad Library:** Shows demographics per-ad, no aggregation
- **Spy tools (AdSpy, BigSpy, etc.):** Focus on creative discovery, demographics as secondary
- **No tool:** Answers "What audience does this competitor reach across their top ads?"

The aggregation algorithm should:
1. Pull demographic percentages from each top-performing ad
2. Weight by reach (higher reach = larger sample = more weight)
3. Combine into single audience profile
4. Display as unified summary

### Visual Presentation

Best practices from demographic visualization research:
- **Age/Gender:** Population pyramid or horizontal bar chart
- **Countries:** Horizontal bar chart or choropleth map
- **Percentages:** Donut charts for part-of-whole relationships
- **Keep simple:** Max 2-3 visualizations, not a dashboard overload

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Per-ad demographic breakdown** | Too granular, adds complexity without value | Aggregated summary only |
| **Creative download/saving** | Different product category (swipe file tools) | Link to original ad |
| **Historical tracking/trends** | Requires database, recurring scraping, storage | Point-in-time analysis |
| **Account system/saved searches** | Adds complexity, auth, database requirements | Stateless tool |
| **Export to CSV/Excel** | Scope creep for v1, can add later | Display only |
| **Competitor monitoring/alerts** | Different product (monitoring vs analysis) | Single query tool |
| **AI-powered insights** | Buzzword feature, unclear value | Clear data presentation |
| **Multi-platform support** | TikTok, Google Ads = different APIs/scrapers | Facebook-only |
| **Engagement metrics** | Not available in Ad Library (likes, comments) | Focus on available data |
| **Spend estimation** | Only ranges available, low accuracy | Show raw ranges if useful |

### Why These Are Anti-Features

From user complaints about existing tools:
- Feature bloat leads to overwhelming UX
- Paid tools charge $100-250/month for features users don't need
- "Simple tool that does one thing well" is underserved
- Data export = user expectation of ongoing relationship/account

---

## Feature Dependencies

```
                    URL Input + Validation
                            |
                            v
                    Ad Discovery (existing)
                            |
                            v
              Top Performer Identification
                            |
                            v
              Per-Ad Demographic Extraction  <-- New scraping logic
                            |
                            v
              Aggregation Algorithm
                            |
                            v
               +------------+------------+
               |                         |
               v                         v
        Summary Display            Visual Charts
```

### Critical Path

1. **Per-ad demographic extraction** (new) - Must extract data from ad detail pages
2. **Top performer identification** - Need criteria: reach range or duration
3. **Aggregation algorithm** - Weight and combine demographic data
4. **Display** - Show aggregated results (summary + optional charts)

### Independent Additions

These can be added without affecting the critical path:
- Visual charts (enhancement to display)
- Additional demographic dimensions (if available in data)
- URL validation improvements

---

## MVP Recommendation

For MVP (v1), prioritize:

### Must Have
1. **URL input with validation** (table stakes, existing)
2. **Ad discovery** (table stakes, existing)
3. **Per-ad demographic extraction** (core new functionality)
4. **Aggregated demographic summary** (key differentiator)
5. **Loading/progress indication** (table stakes)
6. **Error handling** (table stakes)

### Should Have
1. **Top performer filtering** (by duration or reach)
2. **Weighted aggregation** (accuracy improvement)
3. **Basic visualization** (one chart type for age/gender)

### Defer to Post-MVP
- Multiple visualization types
- Country-level detail views
- Export functionality
- Saved analyses/history
- Performance optimizations beyond 60s timeout

---

## Competitive Landscape Summary

| Tool | Price | Demographic Aggregation | Key Focus |
|------|-------|------------------------|-----------|
| Meta Ad Library | Free | No (per-ad only) | Transparency |
| AdSpy | $149/mo | No | Creative search |
| BigSpy | $9-99/mo | No | Multi-platform ads |
| Minea | $49/mo | No | Dropshipping ads |
| Foreplay | $49/mo+ | No | Creative swipe files |
| PowerAdSpy | $49/mo+ | No | Targeting data |
| **This Project** | Free | **Yes** | Audience insights |

**Gap in market:** No tool aggregates demographic data from multiple ads into a unified audience profile. All existing tools are either:
- Per-ad viewers (Meta Ad Library)
- Creative discovery tools (spy tools)
- Performance dashboards (require ad account access)

---

## Data Availability Notes

### What's Available in Ad Library

| Data Point | Availability | Notes |
|------------|--------------|-------|
| Age breakdown | EU/UK ads, political ads | Percentage by age bracket |
| Gender breakdown | EU/UK ads, political ads | Male/female percentages |
| Country/region | EU/UK ads, political ads | Geographic reach split |
| Reach | EU/UK ads, political ads | Total reach number |
| Impressions | EU/UK ads, political ads | Range (1K-5K, etc.) |
| Ad start date | All ads | Used for duration calculation |
| Ad status | All ads | Active/inactive |

### Limitations

- **Non-EU/UK, non-political ads:** Limited demographic data available
- **Reach data:** Shown as ranges, not exact numbers
- **No engagement:** Likes, comments, shares not in Ad Library
- **No targeting info:** Can't see advertiser's targeting settings (only delivery results)

**Implication:** Tool will be most valuable for analyzing EU/UK ads or political/issue ads where full demographic data is available.

---

## Sources

### Primary Sources
- [Facebook Ads Library API Guide (AdManage)](https://admanage.ai/blog/facebook-ads-library-api)
- [Data Collection of Facebook Ads (Data Knowledge Hub)](https://data-knowledge-hub.com/docs/data-collection/03_00_platform-specific%20guidelines/03_04_data-collection_meta_ads/)
- [Meta Ad Library Tools (Transparency Center)](https://transparency.meta.com/researchtools/ad-library-tools/)

### Competitor Analysis
- [Best Facebook Ad Spy Tools (Cropink)](https://cropink.com/best-facebook-ads-spy-tools)
- [Facebook Ad Spy Tools Comparison (Proven SaaS)](https://proven-saas.com/blog/12-best-facebook-ads-spy-tools-for-2025-find-winning-ads)
- [BigSpy Review (ClickHive)](https://www.clickhive.co.uk/post/bigspy-review)
- [Foreplay Features](https://www.foreplay.co/)

### Feature Research
- [Facebook Ads Library Definitive Guide (Foreplay)](https://www.foreplay.co/post/facebook-ads-library)
- [Meta Ads Library Guide (Shopify)](https://www.shopify.com/blog/ad-library-facebook)
- [Demographic Visualization Best Practices (Depict Data Studio)](https://depictdatastudio.com/how-to-visualize-demographic-data-from-boring-bullet-points-into-great-graphs/)

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Table stakes features | HIGH | Consistent across all competitor tools |
| Differentiator (aggregation) | HIGH | Verified gap in market across multiple sources |
| Anti-features | MEDIUM | Based on user complaints, may miss edge cases |
| Data availability | MEDIUM | EU/political data confirmed, other regions unclear |
| Visualization approaches | HIGH | Standard data visualization practices |
