# V2 Dashboard UI Review

**Reviewed:** 22 files (shell, context, layout, `ads/**`, `saved/page.tsx`, `brands/page.tsx`, `creators/page.tsx`, `categories/[slug]/page.tsx`, `page.tsx`, `page-old-analytics.tsx`, `chat-panel.tsx`, `hikaru/page.tsx` spot, `src/components/dashboard/kpi-card.tsx`, `src/components/dashboard/top-brands-table.tsx`)
**Date:** 2026-04-18

## Summary

The v2 UI is functional and visually consistent on the happy path, but it's almost entirely client-rendered: every page is `'use client'` with `useEffect` fetch waterfalls, no server components, no `loading.tsx`/`error.tsx` boundaries at any level, and no `next/image` usage despite rendering 48+ ad creatives per batch. The `ad-library → ads` rename is clean at the UI route level — no broken internal links — but the old `page-old-analytics.tsx` now sits as dead code in the route folder, and an `ad-library/` folder of backup `.orig` files likely exists on disk per the git status. Accessibility is the weakest leg: zero `<label>`, `aria-label`, `role="dialog"`, or keyboard handlers across the entire `ads/**` subtree, and clickable `<div>`s are used for card selection and modal backdrops without fallbacks. Design system consistency is reasonable but `#1235e2` is hardcoded 130+ times rather than defined as a Tailwind token, and multiple pages re-implement the same filter/card primitives differently (compare `ads/components/filter-dropdown.tsx` with the native `<select>`s in `creators/page.tsx`).

## Findings

### P0 — ship-blockers

- **[a11y/UX] Ad detail lightbox has no focus trap, no aria-modal, and no focus return** — `src/app/dashboard/v2/ads/components/ad-detail-lightbox.tsx:293-305` — The dialog is a plain `<div>` with no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, or initial focus. Tab key escapes to the background, screen readers don't announce it, and after close focus is lost (not returned to the triggering card). Same issue on the login modal at `src/app/dashboard/v2/ads/page.tsx:536-613` and the creator lightbox at `src/app/dashboard/v2/creators/page.tsx:134-141`. Fix: add `role="dialog"`, `aria-modal="true"`, a heading id tied to `aria-labelledby`, a focus trap, and return focus on close.

- **[a11y] Clickable `<div>` on AdCard with no keyboard handler** — `src/app/dashboard/v2/ads/components/ad-card.tsx:66-74` — The entire card is `onClick={onSelect}` with `cursor-pointer` but no `role="button"`, `tabIndex`, or `onKeyDown` for Enter/Space. Keyboard users cannot open the lightbox. Same pattern in `src/app/dashboard/v2/creators/page.tsx:343-350` (CreatorCard). Fix: use `<button>` or add the trio.

- **[rename-rot] Dead `page-old-analytics.tsx` inside the route folder** — `src/app/dashboard/v2/page-old-analytics.tsx:1-250` — Not referenced from anywhere (verified via grep). Still imports many chart components (`AdsTimelineChart`, `FormatDistributionChart`, `PlatformBreakdownChart`, `TopPartnershipBrands`, `DashboardFilters`, `ConfigManager`) that exist only for this page and bloat the codebase. Delete or move outside `src/app/`.

- **[perf] Raw `<img>` for every ad creative — no `next/image` anywhere** — `src/app/dashboard/v2/ads/components/ad-card.tsx:45-50`, `src/app/dashboard/v2/ads/[pageId]/page.tsx:696-702`, `src/app/dashboard/v2/saved/page.tsx:216`, `src/app/dashboard/v2/page.tsx:201,311,343,456,577`, plus brand avatars throughout. With 48 ads per initial batch and `loading="lazy"` only, users pay full-resolution R2 bytes, no srcset, no blur placeholder, no CLS prevention. For an ad library this is the single biggest perf line-item. Either migrate to `next/image` with `remotePatterns` for the R2 host, or at minimum add `width`/`height` attrs and explicit `aspect-ratio` to stop CLS.

### P1 — important

- **[boundaries] Zero `loading.tsx` / `error.tsx` / `not-found.tsx` in v2** — `src/app/dashboard/v2/` — Every page hand-rolls its own `loading` boolean and `V2Skeleton`; any uncaught error surfaces as a blank screen. Add a `dashboard/v2/error.tsx` + `loading.tsx` at minimum; the `ads/[pageId]` route should have a `not-found.tsx` given the 404 path handling in `[pageId]/page.tsx:143-148`.

- **[data-fetching] Everything is client-fetch with waterfalls** — `src/app/dashboard/v2/ads/page.tsx:146-174, 216-256`, `src/app/dashboard/v2/ads/[pageId]/page.tsx:137-184`, `src/app/dashboard/v2/page.tsx:610-623` — No server components at all, so first paint is skeleton → fetch → render. The brand detail page fires three independent waterfalls: (1) `/api/ad-library/brands/${pageId}` in `fetchBrandDetail`, (2) `/api/ad-library/brands/monitor/check` in a second `useEffect` gated on `brand.id`, (3) `/api/ad-library/brands/${pageId}/copy-analysis` inside `CopyAnalysis`. Convert the static brand header + initial ad list to a server component with `React.use(fetchBrand(pageId))` and keep only mutations on the client.

- **[hydration/UX] `useState` lazy init reads `localStorage` — hydration mismatch risk** — `src/app/dashboard/v2/ads/page.tsx:94-99` — `useState(() => { if (typeof window !== 'undefined') return localStorage.getItem('demographicPeekCollapsed') === 'true'; return false; })`. Server will render `false`, client first paint `true` → React will silently swap but demographic peek flickers expanded-then-collapsed. Fix: initialize to `false` and `useEffect` to read from storage after mount.

- **[theme persistence] Dark mode does not persist** — `src/app/dashboard/v2/v2-context.tsx:12-14` — `useState(false)` every mount, no localStorage, no system preference detection, no SSR cookie. Every reload resets to light mode, which for a "design polish" app is a UX regression. The V2Provider is also missing `'use client'` (ReactNode ctx is fine here since it's imported from a client layout, but still should be explicit).

- **[ux-bug] Category detail links to `/dashboard/v2/ads?brandPageId=...` — but that route has no brand context bar on first load** — `src/app/dashboard/v2/categories/[slug]/page.tsx:332` and `src/components/dashboard/top-brands-table.tsx:116` — These link with a query param; `ads/page.tsx` reads `urlBrandPageId` into the initial `brandFilter` state but there is no chip or context UI announcing "filtered by X" until the brand-info fetch at line 126 resolves. OK functionally, but users see the un-filtered grid briefly. Consider gating the grid render on the brand-info promise when the param is present.

- **[perf] Missing `React.memo` on `AdCard`** — `src/app/dashboard/v2/ads/components/ad-card.tsx:15` — Every filter/sort change re-renders the whole ad grid (up to 48–72 cards). `toggleSaveAd` and `onSelect` are recreated in the parent so even with memo the props wouldn't match, but a memo + `useCallback`d parent handlers would stop one-card-updates from propagating.

- **[perf] Filter-dropdown has no click-outside; relies on each button toggling `openDropdown`** — `src/app/dashboard/v2/ads/components/filter-dropdown.tsx:5-55` — The `onClose` prop is received but never wired (`_onClose`). Clicking anywhere outside a dropdown leaves it open until you click another dropdown button. The shell's `UserMenu` (`v2-shell.tsx:110-116`) has the right pattern; port it here.

- **[ts/runtime] `CopyAnalysis` uses three `any` casts on untyped API shape** — `src/app/dashboard/v2/ads/components/copy-analysis.tsx:183,195,202` — Normalization code quietly coerces; if the API changes shape this silently produces empty charts. Type the raw response or add a Zod schema.

- **[data-fetch] `AdLibraryContent` depends on `buildFilterParams` being in `fetchAds` deps, which effectively refetches on every keystroke of sort/filter** — `src/app/dashboard/v2/ads/page.tsx:216-256` — Correct behavior, but `buildFilterParams` also includes `searchDebounce`; on mount it fires a fetch even before the debounce timer runs because initial state is empty string. Fine in practice but you load twice when the user types quickly (once on mount, again after 400ms) and every filter change fires a fresh fetch from page 1 without cancelling the in-flight one — add an `AbortController`.

- **[sort order] Confusing "default sort" state** — `src/app/dashboard/v2/ads/page.tsx:81-82` — `sortBy='reachEstimate'` / `sortOrder='desc'` is correct per user preferences, but `activeFilterCount` at line 296 treats any non-reach sort as "active", and the chip at line 388 shows only when sortBy !== 'reachEstimate' — so sort-order (asc vs desc) silently flips without appearing as a chip. Worth a visual indicator when user flips to ascending.

- **[a11y] Filter bar search input has no label** — `src/app/dashboard/v2/ads/components/filter-bar.tsx:99-108` — No `<label>`, no `aria-label`. Placeholder is not a substitute. Same for brands search (`brands/page.tsx:237-248`), category search (creators page `530-543`), and the credentials inputs in the inline login modal (`ads/page.tsx:576-597` use placeholder-only labels).

- **[error-state] Dashboard `Failed to load dashboard` state has no retry** — `src/app/dashboard/v2/page.tsx:629-636` — Tells users to "try refreshing" — but the window-reload escape hatch is only on the ads page (line 373). Add a retry button.

- **[empty-state-vs-error] Creators empty state indistinguishable from loading error** — `src/app/dashboard/v2/creators/page.tsx:662-674` — The API error path at line 490 just logs and leaves `creators = []`, so a 500 renders the same copy as "no matching creators". Surface a real error state.

- **[data-fetch] Brand detail + Copy Analysis fire without auth context, then gracefully 401-ignore** — `src/app/dashboard/v2/ads/[pageId]/page.tsx:172-184` — The monitor check call `POST` fires an empty catch; fine for unauth, but any other error (500) is also silenced. Distinguish 401 from 5xx.

- **[ux-bug] "Hide carousel" chip absent from active-filter chip row even when it's the *only* active filter** — `src/app/dashboard/v2/ads/page.tsx:296-300, 367-394` — `hideCarousel=true` is the default, so it's correctly excluded from `activeFilterCount`, but toggling it off doesn't reveal a chip either — making the feature state invisible once the Row-2 button scrolls out of view on mobile.

- **[design-system] Mixed segmented-control vs dropdown APIs across pages** — `ads/components/filter-bar.tsx` uses a custom `FilterDropdown` + `FilterChip` system with consistent active/open states; `creators/page.tsx:548-617` uses native `<select>` elements for the same concept; `share-of-voice` / `benchmarks` pages not reviewed but likely diverge further. Pick one and share a primitive.

- **[types] `any` in `copy-analysis` normalization** — `src/app/dashboard/v2/ads/components/copy-analysis.tsx:183,195,202` — see above. Replace with a `RawCopyAnalysisResponse` type or Zod.

- **[ui-bug] `selectedFormats` chip removal deletes an empty string** — `src/app/dashboard/v2/ads/components/filter-bar.tsx:376` — `onRemove={() => onToggleFormat('')}` when the user clicks the X on the "Format: X, Y" chip. `toggleFormat('')` adds/removes the empty-string key to the Set rather than clearing all selected formats. Clearing multi-select is broken — either break this into per-format chips or expose `clearFormats`.

- **[a11y/semantic] Bell icon button is a non-functional decorative element** — `src/app/dashboard/v2/v2-shell.tsx:307-311` — Renders a button with no `onClick`, no `aria-label`, no tooltip. Either remove or wire up.

### P2 — nits

- **[design-token] Brand color `#1235e2` is hardcoded ~130 times in the `ads/**` subtree alone** — Every component re-types the hex. Add `colors: { brand: '#1235e2' }` in `tailwind.config.ts` and use `bg-brand`, `text-brand`, `bg-brand/10` etc. Same applies to `#101322`, `#f6f6f8`, `#161b2e`, `#181b2e`.

- **[design] Hardcoded scaffold colors in demographic peek charts** — `src/app/dashboard/v2/ads/components/demographic-peek.tsx:31-34, 42-54, 87, 167` — `#3b82f6`, `#ec4899`, `#22c55e` are fine but should live with other chart tokens; tooltip colors hardcoded per `darkMode` twice.

- **[design] `BRAND_COLORS` palette duplicated** — `src/app/dashboard/v2/categories/[slug]/page.tsx:167-171` and implicitly `dashboard/v2/creative-lab/*`. Centralize.

- **[design/spacing] Card paddings mix `p-4/p-5/p-6`** — Compare `ads/components/filter-bar.tsx:93` (`p-4`), `ads/components/ad-card.tsx:106` (`p-4`), `ads/[pageId]/page.tsx:269` (`p-6`), `brands/page.tsx:316` (`p-5`). Pick a default.

- **[typography] Mix of font weights for the same hierarchy level** — `V2SectionTitle` uses `text-xl font-bold` (`v2-shell.tsx:338`) but brand detail uses `text-2xl font-bold` (`ads/[pageId]/page.tsx:291`) and ad card body uses `text-sm font-bold`. Establish a scale.

- **[copy] "Ads" vs "Ad Library" tab label** — Sidebar item label is "Ads" (`v2-shell.tsx:74`) but section titles in `ads/page.tsx:490` say "Browse Ads", back links at `ads/[pageId]/page.tsx:217, 265` say "Back to Ad Library". Pick one name.

- **[copy] Shell says "Ad Library Pro | Analysis Tool"** — `v2-shell.tsx:209-210` — Brand feels disjointed with the product-refocus plans. Future brand pass.

- **[a11y] `title="Ascending"` / `title="Descending"` tooltip only on the sort-order toggle** — `ads/components/filter-bar.tsx:155-156` — Should also be in `aria-label` so screen readers pick it up.

- **[perf] Demographic peek Recharts bundle imported always in the ads page** — `ads/components/demographic-peek.tsx:5-12` — Recharts is ~95KB gzipped and only renders for brand-filtered views. Dynamic import with `next/dynamic` to defer until brand filter is active.

- **[perf] `AdLibraryContent` runs `useEffect` -> `fetchAds` on every sort/filter change, and on mount fires `fetchAds` + the initial filters fetch in parallel** — OK, but the initial `fetchInitial` in a separate effect means 3 parallel XHRs on mount (brands, filters, ads). Merge filters + first-page ads into one endpoint or prefetch at the server layer.

- **[ui-detail] Save button in `AdCard` also acts as the "View on Meta" section divider** — `src/app/dashboard/v2/ads/components/ad-card.tsx:147-167` — Two stacked `border-t` rows glue without spacing; visually looks like one section.

- **[ui-detail] Login modal hardcodes demo credentials in placeholder/`defaultValue`** — `src/app/dashboard/v2/ads/page.tsx:579-591, 607-609` — Fine for the demo, but for any non-demo deploy this leaks "Demo: demo@example.com / demo123" to every unauth user viewing the modal.

- **[ui-detail] `DemographicPeek` mounted with `collapsed=false` default in `[pageId]/page.tsx:126` but `true`-default-from-localStorage in `ads/page.tsx:94-99`** — Inconsistent default between the two places.

- **[motion] No motion tokens / reduced-motion opt-out** — `transition-colors`, `transition-all`, `duration-700` scattered. Add `motion-reduce:transition-none` where animations are load-bearing, and a shared `transition` config.

- **[ui-detail] FilterChip close `X` has `hover:bg-red-500/20`** — `ads/components/filter-chip.tsx:25` — Red for a non-destructive remove on a brand-colored chip is jarring; match brand hover.

- **[ui-detail] "Showing X of Y" appears twice** — `ads/page.tsx:486-488` (V2SectionTitle action) and `ads/components/load-more-button.tsx:24-26` below the grid. Pick one.

- **[ui-detail] `format-format-label` and `capitalize` class interact unpredictably** — `ads/components/ad-card.tsx:85` — `formatFormatLabel` already capitalizes the first char, but the badge uses `uppercase`. OK here but elsewhere (filter chips) you capitalize via Tailwind on already-capitalized strings.

- **[type-safety] `useParams()` result coerced with `as string`** — `src/app/dashboard/v2/ads/[pageId]/page.tsx:113` and `categories/[slug]/page.tsx:61` — Will crash if the param is missing. Guard with `if (!pageId) return null;` earlier (currently done for pageId but not slug).

- **[type-safety] Three non-null assertions** — `src/app/dashboard/v2/chat-panel.tsx:152` (`res.body!`), `src/app/dashboard/v2/categories/[slug]/page.tsx:146` (`data!.brands`), `src/app/dashboard/v2/creative-lab/strategy-view.tsx:160,189,204` — replace with guards.

## Rename-rot inventory

- **`page-old-analytics.tsx` leftover at `src/app/dashboard/v2/page-old-analytics.tsx`** — no imports to it; dead code with transitive imports into `src/components/dashboard/ads-timeline-chart.tsx`, `format-distribution-chart.tsx`, `platform-breakdown-chart.tsx`, `top-partnership-brands.tsx`, `dashboard-filters.tsx`, `config-manager.tsx`, `kpi-card.tsx`, `top-brands-table.tsx` — these may or may not be used elsewhere. `KpiCard` and `TopBrandsTable` are used by the new `page.tsx`; the rest are only referenced here. Candidate cleanup: delete this file and prune the chart components that only it imports. (Git status also shows `page-old-analytics.tsx` as untracked? No — it's in the tree.)
- **Git status shows uncommitted backups with `.orig` / duplicated folders** — `RM src/app/dashboard/v2/ad-library/...` rename marker indicates git knows the files moved, but double-check `.gitignore` / stash to ensure no `ad-library/` directory lingers in the working tree (it's not visible via `ls`, so likely clean).
- **API paths still use `/api/ad-library/...` throughout** — intentional (API dir not renamed), but worth verifying that's the desired final state. All consumers: `ads/page.tsx`, `ads/[pageId]/page.tsx`, `saved/page.tsx`, `brands/page.tsx`, `creators/page.tsx`, `downloads/page.tsx`, `onboarding/wizard-steps.tsx`, `settings/brand-profiles/*`, `ads/components/copy-analysis.tsx`, `src/components/dashboard/top-partnership-brands.tsx`.
- **UI route `/dashboard/v2/ad-library/...` fully removed** — grep shows zero matches for `Link href="/dashboard/v2/ad-library"` or `router.push('/dashboard/v2/ad-library...')`. Clean.
- **Types file comment stale** — `src/app/dashboard/v2/ads/[pageId]/page.tsx:31` says "Types (match API response from /api/ad-library/brands/[pageId])" — still accurate (the API keeps `ad-library`), but grep for "ad library" strings in user-facing copy too.
- **User-facing "Ad Library" copy** — `ads/[pageId]/page.tsx:217, 265` ("Back to Ad Library"), `saved/page.tsx:115, 155` ("Browse Ad Library", "Save ads from the Ad Library"), `brand-guidelines/*` may have more. Decide whether product name is "Ads" (sidebar) or "Ad Library" (copy) and unify.

## Patterns worth addressing globally

1. **Client-everywhere architecture** — every `page.tsx` in v2 starts with `'use client'` and fetches in `useEffect`. This negates Next 16 / React 19 / server components / Suspense-based data fetching. The biggest shifts available: (a) make page-level shells server components with `async` data fetching and pass initial data as props to a client child that handles mutations; (b) co-locate `loading.tsx` per route; (c) use `React.use(promise)` in children for parallel waterfalls.

2. **No shared design tokens** — `#1235e2` appears in 130+ locations in the `ads/` subtree alone. Add a Tailwind color config (`brand`, `surface`, `surface-dark`, `muted`, `muted-dark`) and the dark/light `bg-[#101322]`/`bg-[#f6f6f8]` values. Every component conditionally rendering different class strings based on `darkMode` is a symptom of not using Tailwind's dark mode variants (`dark:bg-...`).

3. **Dark mode is prop-drilled instead of using Tailwind's `dark:`** — Every component takes `darkMode: boolean` and does `darkMode ? 'bg-x' : 'bg-y'` string concat. This doubles the rendered class count, makes refactors brittle, and runs into hydration risks once the state starts persisting. Adopt `dark:` variants on the root `<html>` or body, keep `darkMode` in a context only for the toggle button state, and let CSS cascade handle the rest.

4. **Accessibility regressions across the board** — no `<label>`, no `aria-label`, no `role="dialog"`, no focus traps, no keyboard handlers on clickable `<div>`s. For a "high design bar" product, this is the single-biggest invisible debt.

5. **Lightbox/modal primitives are reinvented 3 times** — `AdDetailLightbox`, the login modal inside `ads/page.tsx`, and `CreatorLightbox` in `creators/page.tsx` all hand-roll the same pattern with slightly different escape-key handling, scroll-lock handling, and styling. Extract one `<V2Modal>` primitive with correct a11y.

6. **No `next/image` anywhere** — given this is literally an ad-browsing product, this is the single biggest perf line-item. Migrate to `next/image` with `remotePatterns` for the R2 CDN.

7. **Error/loading boundaries are hand-rolled and inconsistent** — Each page has its own `loading` bool, its own error copy, its own empty-state. Consolidate into `loading.tsx` + `error.tsx` + shared `<EmptyState/>` component.

8. **`any` typed narrowly but present** — three `any` casts in `copy-analysis.tsx`; multiple `as string` coercions for `useParams`. Minor, but a pattern that tends to spread.

## Coverage notes

**Thorough:** `v2-shell.tsx`, `layout.tsx`, `v2-context.tsx`, `page.tsx`, `ads/page.tsx`, `ads/[pageId]/page.tsx`, all 8 components under `ads/components/`, `ads/types.ts`, `saved/page.tsx`, `brands/page.tsx`, `categories/[slug]/page.tsx`, `page-old-analytics.tsx`, `chat-panel.tsx`, plus shared `src/components/dashboard/kpi-card.tsx` and `top-brands-table.tsx`.

**Skimmed:** `creators/page.tsx` (read first 700 lines), `hikaru/page.tsx` (opening 50 lines + grep for patterns), `categories/page.tsx` (index), `creative-lab/**` (grep-only for `any`/`!` usage).

**Not reviewed:** `benchmarks/`, `brand-guidelines/`, `competitors/`, `downloads/`, `requests/`, `settings/brand-profiles/**`, `share-of-voice/`, `onboarding/**`, `creative-lab/**` (except via grep), remaining files in `src/components/dashboard/` (`comparison-table`, `brand-setup-modal`, `competitor-card`, `config-manager`, `delete-brand-dialog`, `demographic-trend-chart`, `demographics-comparison`, `hook-card`, `hook-explorer`, `media-mix-chart`, `observation-card`, `observation-list`, `own-brand-card`, `performance-insights`, `reach-over-time-chart`, `top-hooks`, `trend-chart`). These would likely add ~10–20 more P1/P2 findings of the same categories (client-only fetching, raw `<img>`, hex-inline colors, a11y gaps, prop-drilled darkMode). The priorities above are already representative; fixing them in the shell + `ads/**` will pay dividends everywhere else.
