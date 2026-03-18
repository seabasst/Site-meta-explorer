# Roadmap: Ad Library Pro — v5.1 Visual Consistency

## Overview

Align V1 analyser page with V2 dashboard and landing page branding. Two phases: first settle layout and navigation (header, brand identity, CTAs), then update V1's color palette, typography, and spacing to match V2's design system.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 44: V1 Navigation & Brand Identity** - Add branded header, remove old nav, fix CTAs
- [ ] **Phase 45: V1 Theme Update** - Swap green→blue palette, align typography and spacing

## Phase Details

### Phase 44: V1 Navigation & Brand Identity
**Goal**: V1 analyser page has consistent branding with landing page and V2 dashboard
**Depends on**: Nothing (first phase in milestone)
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04, NAV-05
**Success Criteria** (what must be TRUE):
  1. V1 displays BarChart3 icon + "Ad Library Pro" brand lockup in header
  2. V1 header has logo linking to `/` and upgrade CTA pill linking to `/#pricing`
  3. Old navigation links (How it works, About, Contact, Feedback, Roadmap) are removed
  4. All CTAs on V1 point to `/#pricing` instead of `/coming-soon`
  5. Contextual upgrade card appears below analysis results prompting users to explore V2 dashboard
**Research**: Unlikely — standard Next.js layout extraction, existing nav components to reference
**Plans**: TBD

Plans:
- [ ] 44-01: TBD

### Phase 45: V1 Theme Update
**Goal**: V1 visual design matches V2's color palette, typography, and spacing
**Depends on**: Phase 44
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04
**Success Criteria** (what must be TRUE):
  1. V1 uses `#1235e2` blue color family instead of green accent palette
  2. V1 heading and body font sizes match V2's typographic scale (text-sm labels, text-base body, consistent heading weights)
  3. V1 cards use `rounded-lg`, buttons/pills use `rounded-full`, spacing follows V2's `gap-3`/`gap-4`/`gap-6` rhythm
  4. Page background applies `transition-colors duration-200` for smooth surface transitions
**Research**: Unlikely — color and typography swaps are straightforward
**Plans**: TBD

Plans:
- [ ] 45-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 44 → 45

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 44. V1 Navigation & Brand Identity | 0/TBD | Not started | - |
| 45. V1 Theme Update | 0/TBD | Not started | - |
