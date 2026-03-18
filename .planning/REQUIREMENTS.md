# Requirements: Ad Library Pro — v5.1 Visual Consistency

**Defined:** 2026-03-18
**Core Value:** Help brands and agencies see what competitors are running and how they're reaching their audiences — browse, save, analyze, compare.

## v1 Requirements

Requirements for v5.1 release. Each maps to roadmap phases.

### Color & Typography

- [ ] **THEME-01**: V1 page uses `#1235e2` blue color family instead of green accent palette
- [ ] **THEME-02**: V1 heading and body font sizes match V2's typographic scale (text-sm labels, text-base body, consistent heading weights)
- [ ] **THEME-03**: V1 cards use `rounded-lg`, buttons/pills use `rounded-full`, spacing follows V2's `gap-3`/`gap-4`/`gap-6` rhythm
- [ ] **THEME-04**: Page background applies `transition-colors duration-200` to prevent jarring flash between surfaces

### Brand Identity & Navigation

- [ ] **NAV-01**: V1 displays BarChart3 icon + "Ad Library Pro" brand lockup matching landing page and V2 sidebar
- [ ] **NAV-02**: V1 has minimal header with logo linking to `/` and upgrade CTA pill linking to `/#pricing`
- [ ] **NAV-03**: V1 old navigation links (How it works, About, Contact, Feedback, Roadmap) are removed
- [ ] **NAV-04**: V1 CTA points to `/#pricing` instead of `/coming-soon`
- [ ] **NAV-05**: Contextual upgrade card appears below analysis results prompting users to explore V2 dashboard

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Dark Mode

- **DARK-01**: V1 reads darkMode preference from localStorage and applies V2's dark palette
- **DARK-02**: Single localStorage key for dark mode shared across V1 and V2

### Infrastructure

- **INFRA-01**: Unified design tokens in `:root`/`.dark` with `@theme inline` mappings
- **INFRA-02**: `next-themes` ThemeProvider wired into root layout

### Landing Page

- **LAND-01**: Minor copy/spacing tweaks for CTA consistency across surfaces

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Dark mode toggle UI on V1 | V1 is free tool, not dashboard — no UI controls |
| V1 sidebar navigation | V1 is single-purpose, not a multi-page app |
| V1 page refactor | Structural code quality, not user-visible |
| Design system extraction / Storybook | Overkill for a freemium entry point |
| New pages (/upgrade, /features) | Existing landing pricing section is sufficient |
| Animated page transitions | View Transitions API too complex for this milestone |
| V2 ternary cleanup (308 occurrences) | Separate milestone (v5.2) |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | — | Pending |
| THEME-02 | — | Pending |
| THEME-03 | — | Pending |
| THEME-04 | — | Pending |
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| NAV-04 | — | Pending |
| NAV-05 | — | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 0
- Unmapped: 9 ⚠️

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after initial definition*
