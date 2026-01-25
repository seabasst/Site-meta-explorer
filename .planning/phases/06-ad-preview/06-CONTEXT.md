# Phase 6: Ad Preview - Context

**Gathered:** 2026-01-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable users to view ad creatives and access Facebook ad pages. Users can see ad text, distinguish media types, and click through to view ads on Facebook. This phase does NOT include playing videos inline or downloading ad assets.

</domain>

<decisions>
## Implementation Decisions

### UI — Creative Text Display
- Show full ad creative text always (no truncation or expand)
- Text displays inline within the ad card

### UI — Media Type Indicators
- Small icon badge to distinguish video vs image ads
- Badge positioned in top-right corner of ad card
- Use recognizable icons (video play icon, image icon)

### UX — Facebook Link
- Entire ad card is clickable (opens Facebook ad page in new tab)
- Hover effect on card (highlight/elevation change)
- Pointer cursor on hover
- Small external link icon visible to indicate new tab behavior

### Claude's Discretion
- Exact hover effect styling (shadow, scale, background)
- External link icon placement (corner vs inline)
- Ad card layout and spacing decisions
- Error handling if Facebook link is unavailable

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-ad-preview*
*Context gathered: 2026-01-25*
