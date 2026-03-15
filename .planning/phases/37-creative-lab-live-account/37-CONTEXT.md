# Phase 37: Creative Lab Live Account Analysis - Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect to a user's Meta Ads Manager account via Marketing API OAuth, pull real ad performance data, and run Andromeda best practice analysis against actual metrics. This adds a "Live Account" mode to the existing Creative Lab, powered by real performance data instead of public Ad Library metadata.

</domain>

<decisions>
## Implementation Decisions

### UX — Auth & Account Connection
- OAuth popup flow for Meta account connection (no manual token paste)
- After OAuth, user selects one ad account at a time to analyze
- Can switch ad accounts later, but analysis runs against one account per session
- Meta Marketing API permissions needed: `ads_read`, `ads_management`, `read_insights`

### Content — Metrics to Pull
**Core delivery:** Impressions, reach, frequency, CPM, spend
**Engagement & conversion:** CTR, CPC, CPA, conversion rate, ROAS
**Creative fatigue signals:** Frequency over time, CTR decay, cost increase trends
**Audience breakdown:** Performance by age, gender, placement, device

### Content — Andromeda Scoring (Real Data)
All four Andromeda dimensions, now powered by actual performance:
1. **Creative diversity score** — Cluster active creatives, measure similarity, score against Andromeda's >60% similarity penalty threshold. Use real performance data to weight clusters.
2. **Refresh cadence** — Flag ads running >3 weeks with declining CTR/rising CPM. Show optimal refresh windows based on actual fatigue curves.
3. **Funnel balance** — Map campaigns to awareness/consideration/conversion, compare spend distribution against ideal ~40/30/30 split.
4. **Winner/loser analysis** — Identify top and bottom performers with specific reasons (hook quality, format effectiveness, audience match). Generate actionable next steps.

### UI — Placement & Style
- Lives inside the existing Creative Lab as a tab/toggle: "Ad Library Analysis" vs "Live Account Analysis"
- Insight-driven narrative style (like current Creative Lab) — scores, recommendations, actionable insights
- Metrics support the story rather than being the primary focus
- Real performance data makes the insights and recommendations much more concrete and actionable

### Claude's Discretion
- OAuth token storage and refresh mechanism
- How to map campaigns to funnel stages (naming conventions, objective types, or AI classification)
- Creative clustering approach with real data (visual similarity, copy similarity, or performance correlation)
- How many days of data to pull by default (7d, 14d, 30d)
- Rate limiting strategy for Marketing API calls

</decisions>

<specifics>
## Specific Ideas

- The current Creative Lab already has Five Pillars diversity analysis and Andromeda metrics — the live account version should feel like an upgrade of the same experience, not a different tool
- With real CTR/CPM data, fatigue detection becomes much more accurate than the heuristic-based approach in the current analyzer
- Winner/loser analysis should include specific "do more of this" / "pause this" recommendations
- Audience breakdown data enables "this creative works best with women 25-34" type insights that aren't possible with public Ad Library data

</specifics>

<deferred>
## Deferred Ideas

- Auto-pausing underperforming ads via Marketing API (requires `ads_management` write permissions) — future phase
- A/B test recommendations based on winner analysis — future phase
- Budget reallocation suggestions across campaigns — future phase
- Connecting Google Ads or TikTok Ads accounts — separate integration phases

</deferred>

---

*Phase: 37-creative-lab-live-account*
*Context gathered: 2026-03-15*
