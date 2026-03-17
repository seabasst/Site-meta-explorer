# Phase 42: Landing Page - Research

**Researched:** 2026-03-17
**Domain:** Landing page / conversion / routing architecture
**Confidence:** HIGH

## Summary

The current `/` route is a 1,639-line monolithic client component (`src/app/page.tsx`) that serves as the V1 "Ad Analyser" tool. It is a fully functional search-and-analyze interface allowing users to search for brands and get demographics, reach data, and audience insights from the Facebook Ad Library API. The V2 dashboard lives at `/dashboard/v2/` with a sidebar-based layout featuring Dashboard, Creative Lab, Ad Library, Saved Ads, Brands, Categories, and Hikaru AI pages.

The landing page needs to replace the current `/` with a marketing/conversion page while preserving the V1 tool as a freemium teaser. Stripe checkout is already wired up (server action `createCheckoutSession` with `STRIPE_PRO_PRICE_ID`), and the subscription model (free/pro/past_due/cancelled) is in place. The `FeatureGate` component currently passes all features through (all unlocked), so tier enforcement is a separate concern.

**Primary recommendation:** Create a new landing page component at `/` that includes: (1) a hero section with value prop and CTA, (2) a V2 feature showcase section, (3) an embedded or linked V1 tool section as the freemium teaser, and (4) a pricing/upgrade section leveraging existing Stripe integration. Move the current V1 page to `/analyser` or keep it inline as a section.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.2 | App router, pages | Already in use |
| React | 19.2.3 | UI components | Already in use |
| Tailwind CSS | v4 | Styling | Already in use |
| Lucide React | 0.563.0 | Icons | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next-auth | 5.0.0-beta.30 | Auth for sign-in CTA | Already configured |
| Stripe (@stripe/stripe-js) | 8.6.4 | Pro upgrade checkout | Already configured |
| Recharts | 3.6.0 | Could use for animated demo charts | Already in use in V2 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom animations | Framer Motion | Would add a dependency; `tw-animate-css` is already installed and CSS animations exist in globals.css |
| Static screenshots | Live V2 embed | Live embeds are complex; static screenshots or short videos are simpler for a landing page |

**Installation:** No new packages needed. Everything required is already installed.

## Architecture Patterns

### Recommended Routing Strategy

There are two viable approaches for handling the V1 tool vs landing page:

**Option A: Move V1 to `/analyser`, new landing page at `/` (RECOMMENDED)**
```
src/app/
  page.tsx              # NEW landing page (marketing/conversion)
  analyser/
    page.tsx            # MOVED current V1 page (the free tool)
  dashboard/v2/         # Existing V2 dashboard (Pro)
```

**Why Option A:** Clean separation of concerns. The landing page is a marketing page, the analyser is a tool. The landing page can link to `/analyser` for the freemium teaser. URLs are clear and SEO-friendly.

**Option B: Landing page wraps V1 inline**
The landing page would have a hero section followed by the V1 tool embedded as a section below. This is more complex because the V1 page is 1,639 lines of stateful client code. It would require extracting the V1 tool into a separate component.

### Recommended Landing Page Structure
```
src/app/
  page.tsx                          # Landing page (new)
  analyser/page.tsx                 # V1 tool (moved from current page.tsx)
  components/landing/
    hero-section.tsx                # Hero with value prop + CTA
    feature-showcase.tsx            # V2 feature highlights
    v2-preview-section.tsx          # Screenshots/glimpse of V2 dashboard
    pricing-section.tsx             # Free vs Pro comparison + upgrade CTA
    social-proof-section.tsx        # Testimonials/stats (optional)
    footer.tsx                      # Landing page footer
```

### Pattern: Server Component Landing Page with Client Islands

**What:** The landing page should be a Server Component by default, with small client components only where interactivity is needed (e.g., upgrade button, mobile menu toggle).

**When to use:** Always for landing/marketing pages -- faster load, better SEO.

**Example:**
```typescript
// src/app/page.tsx (Server Component - no 'use client')
import { HeroSection } from '@/components/landing/hero-section';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { V2PreviewSection } from '@/components/landing/v2-preview-section';
import { PricingSection } from '@/components/landing/pricing-section';

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <FeatureShowcase />
      <V2PreviewSection />
      <PricingSection />
    </main>
  );
}
```

### Pattern: Reusing Existing Design Tokens

The V1 page uses CSS custom properties (green/gold theme: `--accent-green`, `--accent-gold`), while the V2 dashboard uses the `#1235e2` blue color directly via Tailwind classes (e.g., `bg-[#1235e2]`, `text-[#1235e2]`). The V2 also uses `darkMode` state from `v2-context`.

**For the landing page:** Use the V2 design system (`#1235e2` primary, `#101322` dark, `#f6f6f8` light) since the landing page is selling the V2 product. This aligns with the stated design system in the project memory.

### Anti-Patterns to Avoid
- **Embedding the full V1 page inline:** The V1 is a 1,639-line stateful client component. Embedding it would bloat the landing page bundle and hurt load time. Link to it instead.
- **Making the entire landing page a client component:** Landing pages should be mostly static/server-rendered for performance and SEO.
- **Building a custom payment flow:** Stripe Checkout is already configured. Use the existing `createCheckoutSession` server action.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment/checkout | Custom payment form | `createCheckoutSession` server action (src/app/actions/stripe.ts) | Already wired to Stripe with `STRIPE_PRO_PRICE_ID`, handles customer creation, metadata, promo codes |
| Auth state in CTA | Custom auth check | `useSession` from next-auth + existing `SignInButton` component | Already handles auth state, redirects |
| Upgrade button | New upgrade component | Existing `UpgradeButton` from `src/components/subscription/upgrade-button.tsx` | Already styled, handles loading state, calls correct server action |
| CSS animations | JS animation library | Existing CSS classes: `animate-fade-in-up`, `stagger-1` through `stagger-5`, `animate-pulse-subtle` in globals.css | Already defined and used across the app |
| Glass/card effects | Custom card styles | Existing `.glass` and `.dashboard-card` CSS classes | Already defined in globals.css |
| Background effects | Custom backgrounds | Existing `.gradient-mesh` and `.noise-overlay` classes | Already used on V1 page and coming-soon page |

**Key insight:** The coming-soon page (`src/app/coming-soon/page.tsx`) is essentially a proto-landing page. It already has: hero section, feature grid, email signup form, and "what stays free" section. Use it as a structural template.

## Common Pitfalls

### Pitfall 1: Breaking the V1 Tool URL
**What goes wrong:** Moving the V1 tool from `/` to `/analyser` breaks existing bookmarks, shared links, and any external references.
**Why it happens:** The current `/` IS the product for existing users.
**How to avoid:** Add a redirect from key URL patterns or include the V1 functionality on the landing page in a way that preserves the workflow. Consider a smooth scroll or tab that shows the analyser.
**Warning signs:** Users complaining they can't find the tool.

### Pitfall 2: Slow Landing Page Load
**What goes wrong:** If the landing page imports heavy V1/V2 components, the bundle gets large and the page loads slowly.
**Why it happens:** The V1 page imports many heavy dependencies (Recharts charts, PDF export, etc.).
**How to avoid:** Keep the landing page as a Server Component. Use static images/screenshots for V2 preview. Only import lightweight components. Lazy-load any interactive sections.
**Warning signs:** Large JS bundle on initial load. Run `next build` and check page sizes.

### Pitfall 3: Auth-Gated CTAs Without Graceful Fallback
**What goes wrong:** The "Upgrade to Pro" button currently returns `null` if user is not logged in. On a landing page, unauthenticated visitors are the primary audience.
**Why it happens:** The existing `UpgradeButton` was designed for in-app use.
**How to avoid:** Create a landing-page-specific CTA that either: (a) signs user in first then redirects to checkout, or (b) shows "Sign up for Pro" which goes to `/auth/signin?callbackUrl=/dashboard/v2`.
**Warning signs:** CTA not visible to unauthenticated users.

### Pitfall 4: Stripe Checkout Success URL
**What goes wrong:** The current `success_url` in `createCheckoutSession` redirects to `/?upgrade=success` -- if `/` becomes the landing page, this redirect doesn't make sense for a post-payment flow.
**Why it happens:** It was written when `/` was the V1 tool.
**How to avoid:** Update `success_url` and `cancel_url` in `src/app/actions/stripe.ts` to redirect to `/dashboard/v2?upgrade=success`.
**Warning signs:** Users land back on the marketing page after paying.

### Pitfall 5: SEO Metadata Not Updated
**What goes wrong:** The current metadata says "Facebook Ad Library Analyser" which is tool-focused, not conversion-focused.
**Why it happens:** Metadata in `src/app/layout.tsx` was for the V1 tool.
**How to avoid:** Update the page-level metadata export in the new landing page to have conversion-oriented title/description. Keep the layout metadata generic.

## Code Examples

### Existing Stripe Checkout Integration (reuse as-is)
```typescript
// src/app/actions/stripe.ts - already exists
// Handles: customer creation, checkout session, redirect to Stripe
// Price: process.env.STRIPE_PRO_PRICE_ID
// Success URL: ${process.env.NEXT_PUBLIC_APP_URL}/?upgrade=success
// Cancel URL: ${process.env.NEXT_PUBLIC_APP_URL}/?upgrade=cancelled
```

### Existing Coming-Soon Page Structure (template)
```typescript
// src/app/coming-soon/page.tsx already has:
// - Hero section with badge + heading + subheading
// - Feature grid (6 features in 2-col grid)
// - "What stays free" section
// - Email signup form
// - Footer
// Reuse this layout pattern for the new landing page
```

### Landing Page CTA for Unauthenticated Users
```typescript
// New pattern needed - landing page CTA that handles auth
'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { createCheckoutSession } from '@/app/actions/stripe';

export function ProCTA() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleClick = () => {
    if (!session) {
      // Send to sign-in, then redirect to checkout or V2
      router.push('/auth/signin?callbackUrl=/dashboard/v2');
    } else {
      // Already authenticated, go to checkout
      createCheckoutSession();
    }
  };

  return (
    <button onClick={handleClick} className="...">
      {session ? 'Upgrade to Pro' : 'Get Started with Pro'}
    </button>
  );
}
```

### V2 Feature List (for showcase section)
Based on V2 shell navigation, the features to highlight are:
```
1. Analytics Dashboard - KPI cards, timeline charts, format distribution, platform breakdown
2. Creative Lab - Brand analysis with pillar distribution, diversity scores, hook analysis
3. Ad Library - Full database browsing with filters, saved ads
4. Brand & Category browsing - organized by category
5. Hikaru AI - AI-powered ad analysis chat with chart rendering
6. Downloads (coming soon)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1 at `/` as the product | Landing page at `/`, V1 as freemium at `/analyser` | This phase | Users hit a marketing page first, not the raw tool |
| "Pro -- Coming Soon" CTA in V1 nav | Direct "Start Free" / "Get Pro" CTAs | This phase | Active conversion vs passive interest collection |
| `coming-soon` page with email signup | Direct Stripe checkout for Pro | Already exists in Stripe integration | Can convert immediately, no waitlist needed |

**Deprecated/outdated:**
- The `/coming-soon` page can be retired or redirected after the landing page launches
- The "Pro -- Coming Soon" nav link in V1 should become a real "Get Pro" link
- `FeatureGate` currently passes everything through (comment says "free until March 1st") -- this needs updating alongside this phase

## Key Existing Assets to Reference

### V1 Page (current `/`)
- **File:** `src/app/page.tsx` (1,639 lines, 'use client')
- **Function:** `Home()` component
- **Features:** Brand search, URL paste, region/active filters, demographics charts, ad previews, brand comparison, PDF export, CSV export, brand analysis
- **Nav:** Logo, "How it works", About, Contact, Feedback, Roadmap, "Pro -- Coming Soon" CTA
- **Example brands:** Ninepine, Zeeksack, Daniel Wellington, RevolutionRace, Stronger, CAIA Cosmetics

### V2 Shell & Navigation
- **File:** `src/app/dashboard/v2/v2-shell.tsx`
- **Brand name:** "Ad Library Pro" with blue icon
- **Nav sections:** Dashboard, Creative Lab | Ad Library, Saved Ads, Brands, Categories | Hikaru AI | Settings
- **Design:** Dark mode (#101322) / light mode (#f6f6f8), #1235e2 primary blue

### Stripe Integration
- **Server action:** `src/app/actions/stripe.ts` (createCheckoutSession, createPortalSession)
- **Price ID:** `process.env.STRIPE_PRO_PRICE_ID` (not hardcoded -- configured in env)
- **Subscription lib:** `src/lib/subscription.ts` (getSubscriptionStatus, isPro, syncSubscriptionStatus)
- **Webhook:** `src/app/api/webhooks/stripe/route.ts`
- **UI components:** `UpgradeButton`, `ManageSubscriptionButton`, `SubscriptionStatus`

### Design System
- **V1 theme (green/gold):** CSS vars `--accent-green: #1a3933`, `--accent-gold`, `--accent-yellow: #f59e0b`
- **V2 theme (blue):** `#1235e2` primary, `#101322` dark bg, `#f6f6f8` light bg
- **Fonts:** DM Sans (sans), Instrument Serif (serif headings)
- **Utility classes:** `.glass`, `.gradient-mesh`, `.noise-overlay`, `.dashboard-card`, `.animate-fade-in-up`, `.stagger-N`

## Open Questions

1. **V1 route handling**
   - What we know: V1 is currently at `/`, needs to remain accessible as freemium teaser
   - What's unclear: Should it move to `/analyser` (clean separation) or be embedded/scrolled-to on the landing page?
   - Recommendation: Move to `/analyser` with a prominent "Try Free" CTA on landing page linking there. Simpler, faster, cleaner bundle.

2. **Design system for landing page**
   - What we know: V1 uses green/gold theme, V2 uses blue (#1235e2) theme
   - What's unclear: Should the landing page use the V2 blue theme (since it's selling V2) or a new theme?
   - Recommendation: Use V2 blue theme since that's the product being sold. The V1 at `/analyser` can keep its green theme.

3. **$99/month pricing display**
   - What we know: Stripe integration exists with `STRIPE_PRO_PRICE_ID`. The requirement says $99/month.
   - What's unclear: Is this price configured in Stripe already? Should it be hardcoded on the landing page or fetched from Stripe?
   - Recommendation: Hardcode "$99/mo" on the landing page for simplicity. The actual price is enforced by Stripe at checkout.

4. **"Feature preview/glimpse" of V2**
   - What we know: LAND-03 requires a preview/glimpse of V2 features
   - What's unclear: Should this be static screenshots, a video, a blurred/locked live embed, or just feature descriptions?
   - Recommendation: Static screenshots or mockup images of V2 dashboard, Creative Lab, and Hikaru AI. Keep it simple. Can use `next/image` with optimized screenshots stored in `/public`.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files mentioned above
- `src/app/page.tsx` - V1 tool structure and imports
- `src/app/dashboard/v2/v2-shell.tsx` - V2 navigation and features
- `src/app/actions/stripe.ts` - Stripe checkout integration
- `src/lib/subscription.ts` - Subscription model
- `src/app/coming-soon/page.tsx` - Existing proto-landing page
- `src/app/globals.css` - Design tokens and utility classes
- `package.json` - Dependencies and versions

### Secondary (MEDIUM confidence)
- None needed - all findings from direct codebase analysis

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - direct from package.json and codebase
- Architecture: HIGH - based on thorough analysis of existing routing and components
- Pitfalls: HIGH - identified from actual code patterns and configuration
- Code examples: HIGH - from existing codebase, verified

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable domain, internal codebase)
