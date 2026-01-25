# Pitfalls Research

**Domain:** Data dashboard enhancement (v1.1)
**Researched:** 2026-01-25
**Confidence:** HIGH (well-documented domain problems)

## Critical Pitfalls

### Pitfall 1: Facebook Ad Media Cannot Be Directly Embedded

**What goes wrong:** Attempting to directly embed ad images/videos from Facebook URLs results in broken images, CORS errors, or X-Frame-Options blocks. The `ad_snapshot_url` returns a Facebook page URL, not a direct media file, and Facebook explicitly blocks iframe embedding via `X-Frame-Options: DENY`.

**Why it happens:**
- Facebook Ad Library API does not return direct media file URLs in the response payload
- The `ad_snapshot_url` is a link to `https://www.facebook.com/ads/archive/render_ad/?id=<id>&access_token=<token>` - a Facebook-hosted page, not raw media
- Facebook sets `X-Frame-Options: DENY` on all facebook.com pages to prevent clickjacking
- Hotlinking protection may block images even if you find direct URLs
- Meta's oEmbed API (updated April 2025) requires app registration and access tokens

**How to avoid:**
1. **Do not plan iframe embedding of `ad_snapshot_url`** - it will fail
2. **Options in order of reliability:**
   - **Link out:** Provide clickable link to `https://www.facebook.com/ads/library/?id=<id>` (opens in new tab)
   - **Screenshot preview:** Use a server-side screenshot service (Puppeteer, Playwright, or API) to capture preview images
   - **Proxy fetch:** Server-side fetch of any available media URLs and serve from your own domain

**Warning signs:**
- Broken image icons in development
- Console errors mentioning CORS, X-Frame-Options, or Refused to display
- 403 Forbidden responses when fetching images

**Phase to address:** Ad Preview phase - research spike FIRST, before any implementation

**Fallback:** If all embedding approaches fail, use "View on Facebook" links with thumbnail placeholder. This is a valid MVP approach.

**Sources:**
- [Facebook Ad Library API Complete Guide 2025](https://admanage.ai/blog/facebook-ads-library-api)
- [Meta oEmbed Read Explained](https://www.bluehost.com/blog/meta-oembed-read-explained/)
- [X-Frame-Options Bypass Discussion](https://requestly.com/blog/bypass-iframe-busting-header/)

---

### Pitfall 2: Recharts 3.x Export Compatibility Issues

**What goes wrong:** The recharts-to-png library that enables PNG export from Recharts charts has compatibility issues with Recharts 3.x (the project uses Recharts 3.6.0). Charts export as blank or corrupted images.

**Why it happens:**
- Recharts 3.x included breaking changes that affected recharts-to-png compatibility
- The library relies on specific DOM structure and ref handling that changed in v3
- html2canvas (underlying technology) can fail on certain SVG elements

**How to avoid:**
1. **Test export immediately** after implementing any chart changes
2. **Pin compatible versions:** Check recharts-to-png docs for version matrix
3. **Alternative approach:** Use Recharts' built-in SVG access + canvas conversion instead of recharts-to-png
4. **Consider FusionCharts or similar** if export is critical path

**Warning signs:**
- Blank exported images
- Missing chart elements in exports
- "Cannot read property of undefined" errors during export

**Phase to address:** Export phase - test early with current Recharts 3.6.0 version

**Fallback:** Implement browser print-to-PDF functionality (`window.print()` with print stylesheet) as baseline export.

**Sources:**
- [recharts-to-png GitHub](https://github.com/brammitch/recharts-to-png)
- [Recharts Export Issue #1027](https://github.com/recharts/recharts/issues/1027)

---

### Pitfall 3: Client-Side CSV Export Memory Crashes

**What goes wrong:** Exporting large datasets (1000+ ads with demographic data) to CSV crashes the browser tab with out-of-memory errors, particularly in Chrome and Edge.

**Why it happens:**
- Client-side CSV generation builds the entire file in memory before download
- DataTables/similar libraries show crashes between 2000-4000 rows with many columns
- Chrome/Edge have stricter memory limits than Firefox
- The app's "1000 ads" analysis mode could hit these limits with full demographic data

**How to avoid:**
1. **Limit export size:** Cap at 500 rows or implement pagination
2. **Server-side generation:** Generate CSV on Next.js API route, stream to client
3. **Use streaming/chunking:** Blob streaming instead of building full string
4. **Test with maximum data:** Always test export with 1000-ad analysis results

**Warning signs:**
- Browser tab becomes unresponsive during export
- "Aw, Snap!" errors in Chrome
- Export works with small data but fails with full analysis

**Phase to address:** Export phase - decide architecture (client vs server) upfront

**Fallback:** Limit export to current page/visible data only, with "full export coming soon" message for large datasets.

**Sources:**
- [DataTables Large Dataset Export Crash](https://datatables.net/forums/discussion/76897/chrome-and-edge-crashing-when-exporting-large-dataset)
- [Node Streams for Large Files](https://www.coreycleary.me/loading-tons-of-data-performantly-using-node-js-streams)

---

## UX Pitfalls

### Pitfall 4: Information Overload in Dashboard

**What goes wrong:** Adding more metrics, charts, and data points makes the dashboard overwhelming. Users cannot find the insights they need.

**Why it happens:**
- Feature creep: "while we're at it, let's also show X"
- Designer assumption that more data = more value
- Lack of clear hierarchy - everything competes for attention
- Cramming desktop layout into smaller screens

**How to avoid:**
1. **Apply 5-metric rule:** No more than 5 primary metrics visible at once
2. **Clear visual hierarchy:** Critical data in upper-left, use size/color to show importance
3. **Progressive disclosure:** Summary first, details on interaction
4. **Remove before adding:** For each new element, ask "what can we remove?"

**Warning signs:**
- Users asking "where is X?" when it's on screen
- No clear eye path through the interface
- Scrolling required to see primary data
- Dashboard "looks like Christmas tree" (too many colors)

**Phase to address:** UI/UX Overhaul phase - establish hierarchy first

**Fallback:** If cluttered, default to hiding secondary metrics behind tabs/accordions.

**Sources:**
- [Databox Bad Dashboard Examples](https://databox.com/bad-dashboard-examples)
- [Smashing Magazine Real-Time Dashboard UX](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)

---

### Pitfall 5: Wrong Chart Type Selection

**What goes wrong:** Using pie charts for too many categories, 3D charts that distort values, or line charts for non-sequential data. Users misinterpret the data.

**Why it happens:**
- Aesthetic preference over clarity
- Not considering what the data actually represents
- Copy-pasting "cool" chart types from templates
- Pie charts are default but rarely optimal

**How to avoid:**
1. **Pie charts:** Maximum 3-4 slices (current country breakdown may have 20+)
2. **Bar charts:** For comparisons between categories
3. **Line charts:** Only for time-series or continuous data
4. **Test comprehension:** Can someone understand the takeaway in 5 seconds?

**Warning signs:**
- Pie chart with 10+ slices
- Horizontal scroll in charts
- Users misreporting what chart shows

**Phase to address:** Chart Improvements phase - audit existing charts first

**Fallback:** When in doubt, use horizontal bar charts - they work for almost anything.

**Sources:**
- [OWOX Bad Data Visualization Examples](https://www.owox.com/blog/articles/bad-data-visualization-examples)
- [Analytics Insight Visualization Mistakes 2025](https://www.analyticsinsight.net/data-science/avoid-these-7-data-visualization-mistakes-in-2025)

---

### Pitfall 6: Mobile Charts Are Unreadable

**What goes wrong:** Charts that look good on desktop become illegible on mobile - overlapping labels, tiny touch targets, impossible to see details.

**Why it happens:**
- Charts designed for desktop first
- Recharts (and most chart libraries) don't automatically simplify for mobile
- Label text doesn't scale proportionally
- Touch targets too small (need 48x48px minimum)

**How to avoid:**
1. **Test on real devices** - not just browser resize
2. **Reduce data points:** Limit mobile bar charts to 5-7 bars max
3. **Use responsive breakpoints:** Different chart configs for mobile
4. **Simplify labels:** Abbreviate or angle on small screens
5. **Touch-friendly:** Larger tap targets, swipe interactions

**Warning signs:**
- Labels overlap on mobile
- Cannot tap individual chart elements
- Charts require horizontal scroll
- Text smaller than 12px on mobile

**Phase to address:** UI/UX Overhaul phase (mobile support) AND Chart Improvements phase

**Fallback:** On mobile, show simplified data tables instead of charts.

**Sources:**
- [Toptal Mobile Dashboard UI](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)
- [Lightning Ventures Mobile Dashboard Tips](https://www.lightningventures.com.au/blogs/10-tips-for-mobile-friendly-dashboards)

---

### Pitfall 7: No Context for Numbers

**What goes wrong:** Displaying "Reach: 1,234,567" without explaining if that's good, bad, average, or what it means for decision-making.

**Why it happens:**
- Developer knows context, assumes user does too
- Metrics displayed in isolation
- Missing benchmarks or comparisons
- No trend indicators

**How to avoid:**
1. **Add comparison context:** "vs. average", "top 10%", trending arrows
2. **Use explanatory labels:** Tooltips explaining what metric means
3. **Provide ranges:** "Low/Medium/High" alongside raw numbers
4. **Show relative values:** Percentages alongside absolutes

**Warning signs:**
- Users asking "is this good?" about displayed numbers
- Data displayed with no labels/legends
- Raw numbers with no formatting (1234567 vs 1.2M)

**Phase to address:** Chart Improvements phase - context in tooltips/labels

**Fallback:** At minimum, format all numbers with commas/abbreviations.

**Sources:**
- [UXPin Dashboard Design Principles](https://www.uxpin.com/studio/blog/dashboard-design-principles/)

---

## Performance Traps

### Pitfall 8: Blocking UI During Export

**What goes wrong:** Export process freezes the UI for several seconds while generating file, user thinks app crashed.

**Why it happens:**
- Synchronous file generation on main thread
- No progress indicator for long operations
- Heavy PDF rendering blocking user interaction

**How to avoid:**
1. **Web Workers:** Move export generation to background thread
2. **Progress indicators:** Show "Generating export... 45%"
3. **Async with feedback:** Disable button, show spinner, re-enable on complete
4. **Timeout fallback:** If export takes >5s, offer to email results

**Warning signs:**
- Unresponsive UI during export
- Users clicking export button multiple times
- Browser "page unresponsive" dialogs

**Phase to address:** Export phase - plan async architecture from start

**Fallback:** Add "Please wait, generating..." overlay that blocks interaction but shows progress.

**Sources:**
- [Medium Offline-First PDF/CSV Challenges](https://medium.com/@sanjayajosep/offline-first-challenge-making-csv-pdf-reports-right-on-android-faf2ee7946dc)

---

### Pitfall 9: Re-rendering Charts on Every Interaction

**What goes wrong:** Charts re-render completely on minor state changes, causing visible flickering and performance degradation.

**Why it happens:**
- React state updates triggering full component re-renders
- Chart data not properly memoized
- Parent component state changes cascading to chart children
- Animation replaying on every render

**How to avoid:**
1. **Memoize chart data:** useMemo for computed chart data
2. **Isolate chart state:** Charts in their own components with stable props
3. **Disable unnecessary animations:** Especially for data updates
4. **Use keys carefully:** Avoid key changes that force remounts

**Warning signs:**
- Charts "flashing" on unrelated interactions
- Animation replaying when it shouldn't
- React DevTools showing excessive re-renders

**Phase to address:** Chart Improvements phase - performance audit

**Fallback:** React.memo wrapper on chart components as quick fix.

**Sources:**
- [Medium Optimizing Chart Rendering in React](https://medium.com/@balakumaran428/optimizing-chart-rendering-in-react-ensuring-smooth-performance-in-print-and-export-78206813496f)

---

## "Looks Done But Isn't" Checklist

Before marking any phase complete, verify:

### Ad Preview Phase
- [ ] Tested with ads that have VIDEO (not just images)
- [ ] Tested with ads that have MULTIPLE images (carousel)
- [ ] Tested with ads where media is UNAVAILABLE
- [ ] Tested with ads that have LONG text content
- [ ] Fallback UI renders when media fails to load
- [ ] "View on Facebook" link works and opens correct page

### Chart Improvements Phase
- [ ] All charts tested on mobile Safari AND mobile Chrome
- [ ] Labels readable at smallest viewport (320px)
- [ ] Touch interactions work (tap, swipe)
- [ ] Empty state renders when no data
- [ ] Charts work with extreme values (0%, 100%, negative)
- [ ] Animations disabled in reduced-motion preference

### Export Phase
- [ ] Tested with MAXIMUM data (1000 ads analysis)
- [ ] Export works in Safari (different blob handling)
- [ ] Exported file opens correctly in Excel AND Google Sheets
- [ ] Charts appear correctly in PDF (not blank)
- [ ] Progress indicator shown for exports >1s
- [ ] Error handling if export fails mid-generation

### UI/UX Overhaul Phase
- [ ] Tested on REAL iPhone (not just simulator)
- [ ] Works in landscape orientation
- [ ] Form inputs don't zoom on mobile (16px+ font)
- [ ] Error states styled, not raw browser errors
- [ ] Loading states for ALL async operations
- [ ] Tab order logical for keyboard navigation

---

## Pitfall-to-Phase Mapping

| Pitfall | Affected Phase | Action Required |
|---------|---------------|-----------------|
| Facebook media embedding blocks | Ad Preview | Research spike BEFORE implementation |
| Recharts 3.x export compatibility | Export | Test early, plan fallback |
| CSV memory crashes | Export | Decide client vs server-side upfront |
| Information overload | UI/UX Overhaul | Establish hierarchy first |
| Wrong chart types | Chart Improvements | Audit existing charts |
| Mobile chart readability | UI/UX + Charts | Test real devices, not simulators |
| Missing number context | Chart Improvements | Add tooltips/comparisons |
| Blocking UI during export | Export | Plan async architecture |
| Chart re-rendering | Chart Improvements | Memoization audit |

---

## Phase-Specific Research Flags

Based on pitfall severity, these phases likely need deeper research spikes:

| Phase | Research Needed | Risk if Skipped |
|-------|----------------|-----------------|
| Ad Preview | HIGH - Must verify what's actually possible with Facebook media | Could plan features that are impossible |
| Export | MEDIUM - Test Recharts 3.x compatibility before committing | May need different export approach |
| UI/UX Overhaul | LOW - Standard patterns, well-documented | Minor polish issues only |
| Chart Improvements | LOW - Recharts well-documented | Performance edge cases |

---

## Sources

### Facebook Ad Library & Media Embedding
- [Facebook Ads Library API Complete Guide 2025](https://admanage.ai/blog/facebook-ads-library-api)
- [Meta oEmbed Read Explained](https://www.bluehost.com/blog/meta-oembed-read-explained/)
- [Bypass X-Frame-Options Discussion](https://requestly.com/blog/bypass-iframe-busting-header/)
- [CORS Workarounds](https://medium.com/@dtkatz/3-ways-to-fix-the-cors-error-and-how-access-control-allow-origin-works-d97d55946d9)

### Dashboard UX Best Practices
- [UXPin Dashboard Design Principles 2025](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [Smashing Magazine Real-Time Dashboard UX](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [Databox Bad Dashboard Examples](https://databox.com/bad-dashboard-examples)
- [OWOX Bad Data Visualization Examples](https://www.owox.com/blog/articles/bad-data-visualization-examples)

### Mobile Dashboard Design
- [Toptal Mobile Dashboard UI Best Practices](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)
- [Lightning Ventures Mobile-Friendly Dashboards](https://www.lightningventures.com.au/blogs/10-tips-for-mobile-friendly-dashboards)
- [Pencil & Paper Dashboard UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)

### Chart Export
- [recharts-to-png npm](https://www.npmjs.com/package/recharts-to-png)
- [Recharts Export Issue Discussion](https://github.com/recharts/recharts/issues/1027)
- [DEV.to Export Charts to PDF with React](https://dev.to/ramonak/export-multiple-charts-to-pdf-with-react-and-jspdf-b47)

### Export Memory & Performance
- [DataTables Large Dataset Export Crash](https://datatables.net/forums/discussion/76897/chrome-and-edge-crashing-when-exporting-large-dataset)
- [Node.js Streams for Large Data](https://www.coreycleary.me/loading-tons-of-data-performantly-using-node-js-streams)

### Hotlinking & Image Protection
- [Cloudflare Hotlink Protection](https://developers.cloudflare.com/waf/tools/scrape-shield/hotlink-protection/)
- [WPOven Hotlinking Prevention](https://www.wpoven.com/blog/hotlinking/)
