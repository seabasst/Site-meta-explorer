# Feature Research

**Domain:** Ad intelligence platform -- visual consistency across V1 (analyser), V2 (dashboard), and landing page
**Researched:** 2026-03-18
**Confidence:** HIGH (based on codebase analysis + SaaS design patterns)

## Current State Analysis

Three distinct visual surfaces exist today, each with its own identity:

| Surface | Theme | Colors | Typography | Navigation |
|---------|-------|--------|------------|------------|
| **Landing (/)** | Dark-only | `#101322` bg, `#1235e2` primary, white text | Instrument Serif (hero) + DM Sans | Fixed top bar: logo + "Try Free" + "Get Pro" pill |
| **V1 (/analyser)** | Light-only | Green palette (`#1a3933` accent, `#f8f8f5` bg), uses CSS custom properties | DM Sans | Sticky top bar: "Ad Analyser" text logo, How it works/About/Contact/Feedback/Roadmap, "Pro -- Coming Soon" CTA |
| **V2 (/dashboard/v2)** | Dark/Light toggle | Dark: `#101322` bg, `#1235e2` primary. Light: `#f6f6f8` bg, `#1235e2` primary | DM Sans | Sidebar with BarChart3 icon logo + "Ad Library Pro" brand |

**Key inconsistencies:**
1. V1 uses a completely different color palette (greens) vs V2/Landing (blues)
2. V1 brand text says "Ad Analyser" -- V2 and Landing say "Ad Library Pro"
3. V1 CTA says "Pro -- Coming Soon" -- Landing has "Get Pro" linking to pricing
4. V1 has no dark mode support
5. V1 nav has 5 links (How it works, About, Contact, Feedback, Roadmap) -- most irrelevant to the V2 product direction
6. Landing nav and V2 sidebar both use the BarChart3 icon + blue pill logo; V1 has plain text

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that, if missing, make the product feel unfinished or untrustworthy. A user navigating from landing to analyser to dashboard should not feel like they landed on a different product.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Unified color palette on V1** | Green palette screams "different product." Users lose trust when pages look disconnected. Reducing cognitive load is the #1 design consistency principle. | Low | Replace `--accent-green` family with `#1235e2` blue family. Keep CSS var structure, just swap values. |
| **Consistent brand identity on V1** | "Ad Analyser" vs "Ad Library Pro" is confusing. Same logo lockup (BarChart3 icon + "Ad Library Pro") must appear everywhere. | Low | Replace text-only logo with the same icon+text lockup used in landing-nav.tsx and v2-shell.tsx. |
| **Dark/light mode on V1** | V2 has it, landing is dark-only, V1 is light-only. Users who toggle dark mode in V2 then visit V1 get a jarring flash. | Medium | V1 needs to read and respect the same dark mode state. Use V2's dark palette (`#101322` bg, slate text scale). |
| **Typography alignment** | V1 already uses DM Sans (shared globals.css), but font weights and sizes may drift. | Low | Audit heading/body sizes. Ensure V1 body text, headings, and labels match V2's scale (text-sm for labels, text-base for body). |
| **Consistent spacing and border radii** | V1 uses mixed radius values and spacing. V2 has a tighter system. | Low | Standardize to V2's `rounded-lg` (cards), `rounded-full` (pills/buttons), and `gap-3`/`gap-4`/`gap-6` spacing rhythm. |
| **Correct CTA destination** | V1 currently links to `/coming-soon`. Landing links to `#pricing`. This mismatch confuses users about the product's state. | Low | V1 CTA should link to landing page pricing section (`/#pricing`) or directly to V2 dashboard. |

### Differentiators (Make V1-to-V2 Transition Feel Premium)

Features that are not strictly expected but make the product feel polished, intentional, and worth paying for. These are what separate "we updated the colors" from "this feels like a real product."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **V1 header with branded logo + upgrade CTA** | A minimal header with the BarChart3 logo, link home, and a prominent "Upgrade to Pro" or "Open Dashboard" CTA creates a clear upgrade funnel. Best freemium SaaS practice: every free surface subtly signals the paid product exists. | Low-Medium | Replace V1's 5-link nav with: [Logo link to /] ... [Upgrade CTA pill]. The Appcues pattern: "subtle but persistent reminder" without interrupting workflow. |
| **Contextual upgrade prompt below results** | After a user completes a free analysis, show a tasteful card: "Want to track this brand over time? Save ads, get AI insights." Links to V2 dashboard or pricing. | Low | More effective than banner -- users have just gotten value and are primed to want more. Conversion-centered design principle. |
| **Smooth theme transition animations** | When navigating between pages, avoid a hard flash from dark to light. Use `transition-colors duration-200` on body/background. | Low | CSS-only. Prevents the jarring "flash" when moving between surfaces. |
| **Shared dark mode persistence** | Dark mode preference set in V2 automatically applies to V1 (and vice versa). Single localStorage key or cookie. | Low | V2 already uses `useV2()` context for darkMode. V1 can read the same localStorage key directly. |
| **Landing page minor polish** | Small alignment/copy tweaks to tighten the landing-to-analyser-to-dashboard funnel. Ensure CTAs are consistent ("Try Free Analyser" and "Get Pro Dashboard"). | Low | Copy and spacing only. No structural changes. |

### Anti-Features (Do NOT Build for v5.1)

Common temptations that would bloat this milestone beyond its scope. The goal is visual consistency, not new functionality.

| Anti-Feature | Why Tempting | Why Problematic | Alternative |
|--------------|-------------|-----------------|-------------|
| **Full design system / component library extraction** | "While we're updating colors, let's build a proper design system with Storybook." | Massive scope creep. The V1 page is a freemium entry point, not a growing surface. It does not need a component library. | Update CSS variables and hardcoded colors in V1. Document the palette in a comment block. |
| **V1 feature parity with V2** | "Users on V1 should be able to toggle dark mode with a button like V2." | V1 is the free tool, not the dashboard. Adding UI controls to V1 increases maintenance surface. | V1 reads dark mode preference silently from localStorage. No toggle UI on V1 itself -- the system preference or V2 setting controls it. |
| **Rebuilding V1 page structure** | "The analyser is a 500-line monolith, let's refactor it into components." | Refactoring is not visual consistency. It adds risk and testing burden with no user-visible benefit for this milestone. | Scope to CSS/styling changes and header component swap only. Refactor in a future milestone if needed. |
| **Adding new pages or routes** | "We should add an /upgrade page or /features comparison page." | New routes = new content = new maintenance. Not needed for visual consistency. | Use existing landing page pricing section as the upgrade destination. |
| **Animated page transitions between V1 and V2** | "Let's add a smooth crossfade when users navigate from analyser to dashboard." | Requires layout groups, shared state, or View Transitions API. High complexity for low impact. | Simple `transition-colors` on body background is sufficient. |
| **V1 sidebar navigation** | "V1 should have a sidebar like V2 for consistency." | V1 is a single-purpose tool (paste URL, get analysis). Adding sidebar navigation implies it is a multi-page app, which it is not. | Keep V1 as a single-page tool with a minimal top header. |

---

## Feature Dependencies

```
Unified color palette (V1)
  |
  +-- Dark/light mode (V1)  [depends on palette being blue-based first]
  |     |
  |     +-- Shared dark mode persistence  [depends on V1 supporting dark mode]
  |
  +-- Consistent brand identity (V1)  [can happen in parallel with palette]
        |
        +-- V1 header with branded logo + upgrade CTA  [depends on brand lockup being defined]

Landing page tweaks  [independent -- can happen in parallel with all above]

Contextual upgrade prompt  [independent -- can be added after header work]
```

**Critical path:** Color palette swap must happen before dark mode support, because adding dark mode with the green palette would mean building something you immediately throw away.

---

## MVP Definition

### v5.1 Must Have

These are the items that, if shipped, make v5.1 feel complete:

1. **V1 color palette swap** -- Replace green accent family with `#1235e2` blue family in CSS variables. Update any hardcoded green values in the analyser page.
2. **V1 brand identity** -- Replace "Ad Analyser" text with BarChart3 icon + "Ad Library Pro" lockup matching landing-nav and v2-shell.
3. **V1 navigation header replacement** -- Minimal header: [Logo -> /] + [Upgrade CTA pill -> /#pricing]. Remove How it works/About/Contact/Feedback/Roadmap links (these are secondary pages, not core nav).
4. **V1 dark mode support** -- Read darkMode preference from same localStorage key V2 uses. Apply V2's dark palette. No toggle UI on V1.
5. **CTA consistency** -- V1 CTA points to `/#pricing` instead of `/coming-soon`. Copy reads "Get Pro" or "Open Dashboard" (matching landing page language).
6. **Landing page minor tweaks** -- Any copy/spacing inconsistencies between landing CTAs and V1/V2 terminology.

### Defer to Later

- **V1 page refactor** -- Structural code quality improvements. Not user-visible.
- **Design token extraction** -- Formalizing CSS variables into a shared design token file. Nice-to-have but not blocking.
- **V1 mobile nav redesign** -- Current mobile hamburger works. Polish later.
- **Animated transitions** -- View Transitions API or framer-motion page transitions. Future milestone.
- **Storybook / component library** -- Only worthwhile if V1 grows in scope, which is not planned.

---

## Feature Prioritization Matrix

| Feature | User Impact | Effort | Risk | Priority |
|---------|------------|--------|------|----------|
| V1 color palette swap | HIGH (eliminates "two different products" feeling) | LOW (CSS var changes) | LOW | P0 |
| V1 brand identity | HIGH (name consistency) | LOW (copy icon lockup from landing-nav) | LOW | P0 |
| V1 nav header replacement | HIGH (funnel improvement + declutter) | LOW-MED (new component, remove old nav) | LOW | P0 |
| V1 dark mode | MEDIUM (prevents jarring flash for dark-mode users) | MEDIUM (conditional classes throughout V1 page) | LOW-MED (V1 is a big file, many style references) | P1 |
| Shared dark mode persistence | LOW-MEDIUM (convenience) | LOW (read localStorage) | LOW | P1 |
| CTA destination fix | MEDIUM (fixes broken funnel) | LOW (href change) | LOW | P0 |
| Landing page copy tweaks | LOW-MEDIUM (polish) | LOW (text changes) | LOW | P2 |
| Contextual upgrade prompt | MEDIUM (conversion optimization) | LOW (new small component) | LOW | P2 |
| Theme transition smoothing | LOW (prevents flash) | LOW (CSS transition) | LOW | P2 |

---

## Competitor Feature Analysis

How do similar SaaS ad intelligence tools handle their free-to-paid surface?

| Product | Free Surface | Paid Surface | Consistency Approach | Upgrade Pattern |
|---------|-------------|-------------|---------------------|-----------------|
| **AdSpy** | Search page with limited results | Same page, unlocked filters | Single surface, gated features | Inline "Upgrade" on locked filters |
| **BigSpy** | Dashboard with watermarked results | Same dashboard, clean results | Unified UI, tier-gated | Persistent top banner + inline locks |
| **Meta Ad Library** | Public, free | N/A | Single surface (not SaaS) | N/A |
| **Foreplay** | Swipe file with limits | Full dashboard + boards | Different nav depth but same visual language | "Upgrade" in sidebar |
| **Motion (creative analytics)** | No free tier | Full product | N/A | N/A |

**Pattern observed:** The most polished ad intelligence tools use a single visual surface with tier-gated features rather than visually distinct free/paid pages. When they do have separate surfaces, the brand identity, color palette, and navigation style are always consistent.

**Implication for this project:** V1 and V2 being visually distinct is acceptable (V1 is simpler by design), but they MUST share the same brand identity, color palette, and navigation language. The visual gap today is too large -- it looks like two different products.

---

## Sources

- Codebase analysis: `src/app/globals.css` (CSS variables and theme definitions), `src/app/analyser/page.tsx` (V1 page structure and styling), `src/components/landing/landing-nav.tsx` (landing navigation), `src/app/dashboard/v2/v2-shell.tsx` (V2 shell and dark mode), `src/components/landing/hero-section.tsx` (landing theme)
- [SaaS UI Design Guide - The Alien Design](https://www.thealien.design/insights/saas-ui-design) -- design consistency principles
- [Navigation UX Best Practices for SaaS - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-navigation) -- navigation patterns for multi-surface products
- [Freemium Upgrade Prompts - Appcues](https://www.appcues.com/blog/best-freemium-upgrade-prompts) -- upgrade prompt design patterns
- [Conversion-Centered Design for SaaS Upgrades - The Good](https://thegood.com/insights/saas-upgrades/) -- CTA and conversion principles
- [SaaS Navigation Menu Design - Lollypop](https://lollypop.design/blog/2025/december/saas-navigation-menu-design/) -- minimal header patterns
- [Freemium Conversion Tips 2025 - 5W PR](https://www.5wpr.com/new/how-freemium-models-drive-conversions-in-saas-tips-for-2025/) -- freemium-to-paid strategy
