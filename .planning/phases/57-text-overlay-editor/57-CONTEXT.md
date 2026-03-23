# Phase 57: AI Creative Generation — Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

AI-driven creative ad generation: the system analyzes the user's ads + competitor top performers + brand guidelines, then generates high-performing ad creatives with minimal user input. This REPLACES the old "Text Overlay Editor" concept — no manual template editing.

Entry point: User clicks from analysis gaps to generate ads that fill identified weaknesses.

</domain>

<decisions>
## Implementation Decisions

### UX — Generation Flow
- Entry from analysis gaps: user sees benchmark analysis, AI highlights gaps, user clicks to generate
- Single config screen (not wizard): all options on one page
- AI pre-fills everything: formats, quantity, style direction, copy angles — based on analysis gaps + brand guidelines + competitor top performers
- User reviews and tweaks if desired, then hits Generate
- Advanced settings (models, locations, etc.) hidden behind "Customize" — mostly pre-chosen based on past performing ads

### Content — AI Suggestions & Reasoning
- Each suggestion shows brief reasoning: WHY this ad was suggested (e.g., "Your competitors are heavy on story ads but you have none")
- Reasoning draws from analysis gaps, competitor benchmarks, and brand positioning

### Results — Post-Generation
- Gallery view of generated ads
- Download individual images or all as a zip
- No editing post-generation in v1 — just review and download
- Rate/favorite is optional nice-to-have

### Claude's Discretion
- Config screen layout and information density
- How to display AI reasoning (inline, tooltip, expandable)
- Gallery grid layout and image sizing
- Loading/progress states during generation

</decisions>

<specifics>
## Specific Ideas

- "The user should do as little as possible" — this is an AI tool, not an editor
- The AI is the creative strategist — it proposes based on data, user confirms
- Products, formats, languages, quantity are configurable but AI suggests defaults
- Optional deep controls: models, locations — but mostly pre-chosen based on past performing ads
- Examples of suggestions should be visible before generating (show what the AI plans to create)

</specifics>

<deferred>
## Deferred Ideas

- Light post-generation editing (text copy tweaks, color swaps) — future phase
- Regenerate/variations of specific results — future phase
- Campaign history / saved generations — future phase
- Batch scheduling / campaign planning — future milestone

</deferred>

---

*Phase: 57-text-overlay-editor (being repurposed as AI Creative Generation)*
*Context gathered: 2026-03-23*
