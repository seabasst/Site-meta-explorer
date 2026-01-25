# Feature Research

**Domain:** Data dashboard enhancement (v1.1) - Ad Library Demographics Analyzer
**Researched:** 2026-01-25
**Confidence:** HIGH (verified against multiple industry sources and current UX patterns)

## UI/UX Polish Features

### Table Stakes

Features users expect from a polished data dashboard. Missing these makes the product feel unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Visual hierarchy** | Users should find critical info in <5 seconds | Low | Top-down layout: KPIs at top, trends middle, details bottom |
| **Consistent styling** | Reduces cognitive load, builds mental model | Low | Same colors, fonts, chart types across all views |
| **Loading states** | Users need feedback during data fetches | Low | Skeleton screens for 1-3s waits; progress indicators for longer |
| **Empty states** | Missing these feels "rackety" vs polished | Low | Meaningful messaging when no data available |
| **Microinteractions** | Shows system is responsive | Low | Button hovers, chart tooltips, filter loading animations |
| **Accessible colors** | 8% of males are colorblind | Low | Blues/oranges instead of red/green; don't rely on color alone |
| **Responsive layout** | Mobile access is expected | Medium | Single-column on mobile, prioritize critical KPIs |
| **Touch-friendly targets** | Mobile requires 48x48px minimum | Low | Buttons, chart interactions must be thumb-friendly |
| **Clear typography** | Readability is baseline expectation | Low | Proper hierarchy with font weight/size, not just color |

### Differentiators

Features that elevate the experience above baseline expectations.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Dark mode** | Reduces eye strain, modern feel | Medium | Use CSS variables (already in place), respect system preference |
| **Animated transitions** | Makes data changes feel fluid | Low | Recharts supports animation natively |
| **Keyboard navigation** | Power user efficiency, accessibility | Medium | Tab through filters, arrow keys in charts |
| **Gesture-based interactions** | Natural on mobile | Medium | Swipe to change time ranges, pinch to zoom charts |
| **Contextual tooltips** | Self-documenting UI | Low | Explain what metrics mean on hover |
| **Breadcrumb navigation** | Clear context when drilling down | Low | Show path back to overview |

## Ad Preview Features

### Expected Behavior

How ad preview displays typically work based on Facebook Ad Library patterns and industry standards.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Thumbnail gallery** | Visual overview of ad creative | Medium | Grid layout with uniform sizing; current ad highlighted |
| **Full ad copy display** | Users need to read complete text | Low | Expandable/collapsible for long copy |
| **Media type indicators** | Video vs image distinction | Low | Icons/badges showing content type |
| **Click to expand** | See full-size creative | Medium | Modal or lightbox pattern |
| **Link to Ad Library** | Reference back to source | Low | Already have `ad_library_links`, expose them |

### Media Handling

Patterns for displaying images, videos, and text in ad previews.

| Media Type | Expected Pattern | Complexity | Implementation Notes |
|------------|------------------|------------|---------------------|
| **Images** | Thumbnail with click-to-expand | Medium | Use `image_urls` from API; lazy load for performance |
| **Videos** | Static thumbnail + play icon | Medium | Use `ad_snapshot_url` for thumbnail; click-to-play in modal |
| **Video autoplay** | Hover-to-preview (muted) | High | Optional enhancement; must be muted by default (browser policy) |
| **Text (creative body)** | Truncated with "show more" | Low | Use `ad_creative_bodies` from API |
| **Link titles** | Display as headline | Low | Use `ad_creative_link_titles` from API |
| **Carousel ads** | Swipeable card view | High | Multiple images in sequence; defer to v1.2 |

### Video Preview Patterns

Best practices for video ad previews based on OTT platform patterns (Netflix, Hulu, YouTube).

| Pattern | Description | Recommendation |
|---------|-------------|----------------|
| **Hover-to-preview** | Video plays muted on hover | DEFER - High complexity, browser autoplay restrictions |
| **Click-to-play** | Static thumbnail, modal opens with player | RECOMMEND - Simple, reliable, no autoplay issues |
| **Play icon overlay** | Clear visual indicator video will play | REQUIRED - Users must know content is video |
| **Muted by default** | Audio starts muted | REQUIRED - Browser policy; let user unmute |
| **Loading state** | Show spinner while video loads | REQUIRED - Prevent confusion during buffering |

### Ad Preview Layout Recommendations

Based on Meta Ad Library patterns and UX research.

```
+------------------+------------------+
|                  |  Ad Details      |
|   Media Preview  |  - Page name     |
|   (image/video)  |  - Start date    |
|                  |  - Status        |
+------------------+------------------+
|  Creative Text (expandable)         |
+-------------------------------------+
|  [View in Ad Library] [Copy Link]   |
+-------------------------------------+
```

## Chart Enhancement Features

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Tooltips** | Show exact values on hover | Low | Recharts `<Tooltip>` component; already using |
| **Legends** | Explain what colors mean | Low | Position consistently; make clickable to filter |
| **Axis labels** | Context for data points | Low | Clear, readable, formatted numbers |
| **Responsive sizing** | Charts must fit container | Low | Use `ResponsiveContainer` wrapper (Recharts) |
| **Number formatting** | Locale-aware, readable | Low | Use Intl.NumberFormat; abbreviate large numbers (1.2M) |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Click-to-filter** | Drill down by clicking chart element | Medium | Click country bar to filter other charts |
| **Cross-chart filtering** | Filter propagates to all visualizations | Medium | Unified filter state; all charts respond |
| **Animated transitions** | Smooth data updates | Low | Recharts supports via `animationDuration` prop |
| **Custom tooltips** | Richer context on hover | Low | Custom React component in `content` prop |
| **Export chart as image** | Save/share visualizations | Medium | Canvas-based screenshot (html2canvas) |
| **Drill-down navigation** | Country -> Region -> City | High | Requires hierarchical data; defer to v1.2 |
| **Comparison mode** | Side-by-side brand comparison | High | Already have brand-comparison.tsx; enhance |

### Chart Type Recommendations

Based on data types in the current application.

| Data | Current | Recommendation | Why |
|------|---------|----------------|-----|
| Age/Gender | Custom bar chart | Keep custom OR Recharts BarChart | Current implementation is solid |
| Country distribution | Bar chart | Horizontal bar chart | Easier to read country names |
| Time trends | LineChart | Keep LineChart, add area fill | Already using Recharts |
| Media type breakdown | None visible | PieChart or DonutChart | Percentage-based data |
| Ad count over time | LineChart | Keep, add tooltips | Already implemented |

## Export Features

### Table Stakes

| Format | Why Expected | Complexity | Notes |
|--------|--------------|------------|-------|
| **CSV** | Universal, spreadsheet-compatible | Low | Already have `export-utils.ts`; verify it works |
| **PDF** | Printable, shareable reports | Medium | Use browser print or html2pdf library |

### Differentiators

| Format | Value Proposition | Complexity | Notes |
|--------|-------------------|------------|-------|
| **Excel (XLSX)** | Preserves formatting, multiple sheets | Medium | Use SheetJS library |
| **PNG/JPG (charts)** | Visual sharing | Medium | html2canvas for chart screenshots |
| **Scheduled exports** | Automation | High | Requires backend; defer |

### Export UX Patterns

| Pattern | Description | Recommendation |
|---------|-------------|----------------|
| **Export button placement** | Consistent location | Top-right of data section |
| **Format selector** | Dropdown or button group | Dropdown if 3+ formats; buttons if 2 |
| **Download feedback** | User knows export started | Toast notification; disable button during generation |
| **Filename convention** | Predictable, descriptive | `{brand}-demographics-{date}.{ext}` |
| **Include filters** | Export shows applied filters | Metadata row in CSV; header in PDF |

## Error Handling UX

### Table Stakes

| Scenario | Pattern | Complexity | Notes |
|----------|---------|------------|-------|
| **API failure** | Clear error message + retry option | Low | Red accent, alert icon, non-technical language |
| **Invalid input** | Inline validation with suggestions | Low | Real-time feedback, not just on submit |
| **Empty results** | Meaningful empty state | Low | Explain why, suggest actions |
| **Network timeout** | Retry with exponential backoff | Medium | Show progress, offer cancel |
| **Rate limiting** | Explain and suggest wait time | Low | Facebook API returns specific error codes |

### Error Message Best Practices

| Instead of | Use | Why |
|------------|-----|-----|
| "Error 500" | "Something went wrong. Please try again." | Non-technical, actionable |
| "Invalid input" | "Page ID should be numbers only" | Specific, helpful |
| "Network error" | "Couldn't connect. Check your internet." | Actionable |
| "No data" | "No active ads found for this page" | Explains situation |

### Loading State Guidelines

| Duration | Feedback Type | Example |
|----------|---------------|---------|
| <100ms | None needed | Instant response |
| 100ms-1s | Inline spinner, disable input | Button spinner (already implemented) |
| 1-3s | Skeleton screen | Gray placeholders for charts |
| 3s+ | Progress indicator + cancel option | "Fetching ads... 45%" |

## Anti-Features

Features to deliberately NOT build in v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **AI chatbot interface** | 2025 trend but adds massive complexity; not core value | Focus on traditional UI polish first |
| **Real-time live updates** | Overkill for ad analysis; adds complexity | Manual refresh is sufficient |
| **Complex customizable dashboards** | Drag-and-drop widgets adds complexity; low value for this use case | Provide sensible defaults |
| **Social sharing buttons** | Privacy concerns with ad data; low value | Copy link to clipboard instead |
| **User accounts/auth** | Scope creep; not needed for single-user tool | Keep stateless |
| **Carousel/multi-image preview** | High complexity; rare ad format | Show first image only; link to Ad Library for full view |
| **Video hover autoplay** | Browser restrictions; performance issues | Click-to-play only |
| **Deep drill-down (3+ levels)** | Adds complexity; data may not support | Single-level drill-down max |
| **Offline mode** | Requires service worker complexity; low value | Online-only is fine |
| **Notification system** | No async operations need it | Show inline feedback |

## Feature Dependencies

```
                    +------------------+
                    |   Mobile Layout  |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+         +---------v---------+
    | Touch Targets     |         | Responsive Charts |
    | (48px minimum)    |         | (ResponsiveContainer)|
    +-------------------+         +-------------------+
              |
              v
    +-------------------+
    | Gesture Support   |
    | (swipe, pinch)    |
    +-------------------+

    +------------------+
    |   Ad Preview     |
    +--------+---------+
             |
    +--------v---------+
    | Image Loading    |<---- Requires: lazy loading, error states
    | (image_urls)     |
    +--------+---------+
             |
    +--------v---------+
    | Video Preview    |<---- Requires: snapshot_url, click-to-play modal
    | (optional)       |
    +--------+---------+

    +------------------+
    |   Chart Polish   |
    +--------+---------+
             |
    +--------v---------+
    | Tooltips/Legends |<---- Already using Recharts
    +--------+---------+
             |
    +--------v---------+
    | Click-to-Filter  |<---- Requires: unified filter state
    +--------+---------+
             |
    +--------v---------+
    | Cross-Chart      |<---- Requires: click-to-filter working first
    | Filtering        |
    +--------+---------+

    +------------------+
    |   Export         |
    +--------+---------+
             |
    +--------v---------+
    | CSV Export       |<---- Already have export-utils.ts
    +--------+---------+
             |
    +--------v---------+
    | PDF Export       |<---- Requires: html2pdf or similar
    +--------+---------+

    +------------------+
    |   Error Handling |
    +--------+---------+
             |
    +--------v---------+
    | Error Messages   |<---- Low dependency, can do anytime
    +--------+---------+
             |
    +--------v---------+
    | Loading States   |<---- Already have spinner; add skeletons
    +--------+---------+
```

## MVP vs Post-MVP Recommendation

### v1.1 MVP (This Milestone)

**UI/UX Polish:**
1. Loading states (skeleton screens) - Low complexity, high impact
2. Empty states - Low complexity, polishes feel
3. Mobile responsive layout - Medium complexity, expected feature
4. Touch-friendly targets - Low complexity, required for mobile
5. Microinteractions (hover states, transitions) - Low complexity, high polish

**Ad Preview:**
1. Image thumbnail gallery - Medium complexity, core feature
2. Click-to-expand modal - Medium complexity, expected
3. Full creative text display - Low complexity, already have data
4. Media type indicators - Low complexity, visual clarity

**Charts:**
1. Custom tooltips with rich content - Low complexity, Recharts native
2. Responsive sizing - Low complexity, wrap in ResponsiveContainer
3. Click-to-filter (single chart) - Medium complexity, good ROI

**Export:**
1. CSV export (verify working) - Already implemented
2. PDF export - Medium complexity, expected for reports

**Error Handling:**
1. Clear error messages - Low complexity, high impact
2. Inline validation - Low complexity, prevents frustration
3. Retry mechanisms - Low complexity, essential for API calls

### Defer to v1.2

- Video hover autoplay
- Carousel ad preview
- Cross-chart filtering
- Deep drill-down navigation
- Excel export
- Chart image export
- Gesture-based interactions (swipe, pinch)
- Dark mode toggle (keep system preference only)

## Sources

### Dashboard UX Best Practices
- [20 Best Dashboard UI/UX Design Principles 2025 - Medium](https://medium.com/@allclonescript/20-best-dashboard-ui-ux-design-principles-you-need-in-2025-30b661f2f795)
- [Dashboard Design UX Patterns - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards)
- [Effective Dashboard Design Principles 2025 - UXPin](https://www.uxpin.com/studio/blog/dashboard-design-principles/)
- [Top Dashboard Design Trends 2025 - Fuselab Creative](https://fuselabcreative.com/top-dashboard-design-trends-2025/)

### Thumbnail & Gallery Patterns
- [Always Use Thumbnails for Product Images - Baymard](https://baymard.com/blog/always-use-thumbnails-additional-images)
- [Gallery UI Design Best Practices - Mobbin](https://mobbin.com/glossary/gallery)
- [List Thumbnails on Mobile - NN/g](https://www.nngroup.com/articles/mobile-list-thumbnail/)

### Video Preview UX
- [React Hover Video Player](https://react-hover-video-player.dev/)
- [Video Previews Increase Engagement - Diagnal](https://www.diagnal.com/video-previews-increase-engagement-on-your-ott-platform/)
- [Best UX for Video - FlowMapp](https://www.flowmapp.com/blog/qa/how-to-provide-the-best-ux-for-video)

### Export Functionality
- [Dashboard Export Formats - MicroStrategy](https://www2.microstrategy.com/producthelp/Current/Workstation/en-us/Content/disable_dashboard_exports.htm)
- [Export Dashboard to PDF, Image, Excel - Bold BI](https://help.boldbi.com/working-with-dashboards/preview-dashboard/dashboard-settings/)

### Error Handling & Loading States
- [Error Message UX Patterns - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-error-feedback)
- [UX Design Patterns for Loading - Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-loading-feedback)
- [Designing Effective Error States 2025 - Medium](https://medium.com/design-bootcamp/designing-effective-error-states-turning-frustration-into-opportunity-in-2025-ux-998e5dc204fc)

### Chart Interactivity
- [Interactive Data Visualization Guide - GoodData](https://www.gooddata.com/blog/interactive-data-visualization/)
- [5 Interactive Features You Should Know - Bold BI](https://www.boldbi.com/blog/5-interactive-data-visualization-features-you-should-know/)
- [Recharts Tooltip API](https://recharts.github.io/en-US/api/Tooltip/)

### Mobile Dashboard Design
- [Mobile Dashboard UI Best Practices - Toptal](https://www.toptal.com/designers/dashboard-design/mobile-dashboard-ui)
- [10 Tips for Mobile-Friendly Dashboards - Lightning Ventures](https://www.lightningventures.com.au/blogs/10-tips-for-mobile-friendly-dashboards)
- [Effective Mobile Dashboard Design - ANODA](https://www.anoda.mobi/ux-blog/effective-mobile-dashboard-design-tips)

### Facebook Ad Library
- [How to Use Facebook Ad Library - Shopify](https://www.shopify.com/blog/ad-library-facebook)
- [Facebook Ads Library Guide 2025 - Foreplay](https://www.foreplay.co/post/facebook-ads-library)
