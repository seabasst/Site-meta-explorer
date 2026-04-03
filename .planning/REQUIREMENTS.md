# Requirements: Ad Library Intelligence Platform — v9.0 Brand Profile & AI Context System

**Defined:** 2026-04-03
**Core Value:** Help brands and agencies see what competitors are running and how they're reaching their audiences — browse, save, analyze, compare.

## v1 Requirements

Requirements for v9.0 milestone. Each maps to roadmap phases.

### Brand Profile

- [ ] **PROF-01**: User can create a brand profile with voice, audience, positioning, competitors, and pain points
- [ ] **PROF-02**: Brand profile stored as multi-table structure (BrandProfile + related tables) with BrandGuidelines migration
- [ ] **PROF-03**: User can view and edit brand profile via tab-based settings page
- [ ] **PROF-04**: User can link competitor brands (from existing DB) to their brand profile
- [ ] **PROF-05**: User can delete a brand profile

### Context Injection

- [ ] **CTXI-01**: Brand context injected into Hikaru chat system prompt (under 2K tokens, XML-tagged sections)
- [ ] **CTXI-02**: Brand context injected into Creative Lab generation and analysis flows
- [ ] **CTXI-03**: User can select active brand via dropdown in chat header (URL param `?brand=` for shareability)
- [ ] **CTXI-04**: Context compiler selects relevant profile fields per query to stay within token budget

### Onboarding

- [ ] **ONBD-01**: User sees soft onboarding prompt on first Creative Lab or Hikaru visit (never blocks access)
- [ ] **ONBD-02**: User can complete 3-5 step form wizard (name/URL, voice/tone, audience, competitors, visual identity)
- [ ] **ONBD-03**: Wizard auto-saves drafts to prevent state loss on navigation
- [ ] **ONBD-04**: User can alternatively use AI interview to build profile from natural language conversation

### Auto-Enrichment

- [ ] **ENRC-01**: User can auto-populate brand profile from existing ad library data (classifications, analyses, metadata)
- [ ] **ENRC-02**: User can auto-populate brand profile from website URL crawl (voice, colors, audience extraction)
- [ ] **ENRC-03**: Auto-enrichment respects cost budgets and uses change detection to avoid redundant runs

### Manus Integration

- [ ] **MANS-01**: Deep research queries route to Manus API as async tasks with polling UI
- [ ] **MANS-02**: Simple/fast queries continue routing to Claude for instant streaming responses
- [ ] **MANS-03**: Manus task results display with clear async state ("Researching... usually takes 2-5 minutes")
- [ ] **MANS-04**: Routing is keyword-based + UI toggle ("Deep Research" mode), not LLM-classified

### Brand Intelligence

- [ ] **INTL-01**: User sees auto-generated brand health overview comparing their ads to linked competitors
- [ ] **INTL-02**: Creative Lab strategy view uses full brand profile for personalized gap analysis and recommendations

## v2 Requirements

Deferred to future release (v9.1+). Tracked but not in current roadmap.

### Creative Velocity

- **VLCT-01**: User sees creative velocity metrics (ads/week, format diversification trend)
- **VLCT-02**: Staleness indicators highlight when a brand hasn't shipped new formats

### Brand Context (Advanced)

- **BRND-02**: Extract voice, positioning, and pain points from ad copy text patterns
- **BRND-03**: Auto-detect brand personality shifts over time

### Auto-Enrichment (Advanced)

- **ENRC-04**: Scheduled monthly re-enrichment of brand profiles
- **ENRC-05**: Manus research results shown as "suggested updates" requiring user approval before profile changes

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full brand guidelines editor (Canva/Figma-style) | Design tool scope creep; minimal visual identity is sufficient |
| Real-time Manus streaming | Manus is async by design; faking real-time creates fragile UX |
| AI model selection UI | Users want answers, not model menus; route automatically |
| Mandatory onboarding | Never block access; all features work without brand profile |
| Per-user brand profiles | Brand profiles are workspace-level; plan for sharing even if v9.0 is single-user |
| Auto-sync Manus results to profile | AI hallucination risk; require human review before profile changes |
| Complex RBAC for brand access | Premature for v9.0; simple ownership model until paying teams exist |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROF-01 | — | Pending |
| PROF-02 | — | Pending |
| PROF-03 | — | Pending |
| PROF-04 | — | Pending |
| PROF-05 | — | Pending |
| CTXI-01 | — | Pending |
| CTXI-02 | — | Pending |
| CTXI-03 | — | Pending |
| CTXI-04 | — | Pending |
| ONBD-01 | — | Pending |
| ONBD-02 | — | Pending |
| ONBD-03 | — | Pending |
| ONBD-04 | — | Pending |
| ENRC-01 | — | Pending |
| ENRC-02 | — | Pending |
| ENRC-03 | — | Pending |
| MANS-01 | — | Pending |
| MANS-02 | — | Pending |
| MANS-03 | — | Pending |
| MANS-04 | — | Pending |
| INTL-01 | — | Pending |
| INTL-02 | — | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22 (awaiting roadmap creation)

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 after v9.0 initial definition*
