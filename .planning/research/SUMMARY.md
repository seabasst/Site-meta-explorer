# Research Summary

**Project:** Ad Library Demographics Analyzer v1.1
**Domain:** Data dashboard enhancement
**Researched:** 2026-01-25

## Key Insight

**Facebook does not provide direct media URLs for ad previews.** The `ad_snapshot_url` is a Facebook-hosted page with `X-Frame-Options: DENY` — it cannot be embedded via iframe or displayed inline. For v1.1, the only reliable approach is "View on Facebook" links that open in a new tab. Thumbnail proxies (server-side screenshots) are possible but complex and should be deferred to v1.2+.

## Stack Recommendation

**Add to existing stack (keep Next.js 16, React 19, Recharts 3.6.0, Tailwind CSS 4):**

| Library | Purpose | Why |
|---------|---------|-----|
| shadcn/ui | UI components | React 19 + Tailwind v4 native; copy-paste ownership |
| Sonner | Toast notifications | shadcn's official choice; no hooks needed |
| react-to-pdf | PDF export | Simple wrapper for html2canvas |
| react-papaparse | CSV export | TypeScript-first, streaming support |
| recharts-to-png | Chart export | Export charts as PNG images |

**Installation:**
```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog dropdown-menu input select skeleton toast
npm install sonner react-to-pdf react-papaparse file-saver recharts-to-png
```

## Table Stakes Features (v1.1 MVP)

**UI/UX Polish:**
- Loading states (skeleton screens)
- Empty states with helpful messaging
- Mobile responsive layout
- Touch-friendly targets (48x48px minimum)
- Clear visual hierarchy

**Ad Preview:**
- "View on Facebook" links (reliable, no CORS issues)
- Display creative text (ad_creative_bodies — already in API)
- Media type indicators (video vs image badges)

**Charts:**
- Custom tooltips with rich context
- Responsive sizing (ResponsiveContainer)
- Click-to-filter (single chart drill-down)

**Export:**
- CSV (already implemented — verify working)
- PDF (add via react-to-pdf)

**Error Handling:**
- Clear, non-technical error messages
- Retry mechanisms for API failures
- Inline validation on inputs

## Critical Pitfalls

| Pitfall | Risk | Prevention |
|---------|------|------------|
| Facebook media embedding fails | HIGH | Use link-out approach only; research spike before planning inline previews |
| Recharts 3.x export breaks | MEDIUM | Test recharts-to-png with current version FIRST |
| CSV memory crash at 1000 ads | MEDIUM | Consider server-side generation; test with max data |
| Dashboard information overload | MEDIUM | Apply 5-metric rule; establish hierarchy before adding |
| Mobile charts unreadable | MEDIUM | Test on real devices, not simulators |

## Architecture Notes

**Current flow (preserve):**
```
page.tsx → POST /api/facebook-ads → facebook-api.ts → Client renders
```

**Changes for v1.1:**
- Add `ad_snapshot_url` field to API response (single field addition)
- Extract export UI to component (currently inline in page.tsx)
- Add `/api/export/pdf` route for PDF generation (optional, needs Vercel Pro for 60s timeout)

**No architectural rewrites needed** — all features integrate with existing patterns.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Error Handling & Foundational Polish
- Add shadcn/ui components
- Implement Sonner toast for feedback
- Clear error messages for API failures
- Loading skeletons during fetch
- **Addresses:** PITFALLS.md — foundation before features
- **Uses:** STACK.md — shadcn/ui, Sonner

### Phase 2: API Enhancement & Ad Preview
- Add `ad_snapshot_url` to facebook-api.ts response
- Create AdPreviewLink component (opens Facebook in new tab)
- Display creative text prominently
- Media type badges
- **Addresses:** ARCHITECTURE.md — simple field addition
- **Avoids:** PITFALLS.md — no iframe embedding attempt

### Phase 3: Chart Improvements
- Add Brush component for time range selection
- Custom tooltips with richer context
- Click-to-filter on country/age charts
- Number formatting with context
- **Addresses:** FEATURES.md — chart table stakes
- **Avoids:** PITFALLS.md — memoize to prevent re-render flicker

### Phase 4: Export Enhancement
- Verify CSV export works with 1000-ad data
- Add PDF export via react-to-pdf
- Add chart image export
- Export menu component refactor
- **Addresses:** FEATURES.md — export table stakes
- **Uses:** STACK.md — react-to-pdf, recharts-to-png

### Phase 5: Mobile & UI Polish
- Responsive breakpoints for charts
- Touch-friendly interactions
- Mobile-specific chart configs (fewer labels, larger targets)
- Visual hierarchy refinement
- **Addresses:** FEATURES.md — mobile is table stakes
- **Avoids:** PITFALLS.md — test on real devices

**Phase ordering rationale:**
- Error handling first = stable foundation for feature work
- API enhancement before preview UI = data available when component built
- Charts independent of preview = can parallelize with Phase 2
- Export after charts = chart export depends on chart implementation
- Mobile polish last = after features are stable

**Research flags for phases:**
- Phase 2 (Ad Preview): Needs research spike to verify what's actually possible before any implementation
- Phase 4 (Export): Test recharts-to-png with Recharts 3.6.0 early — may need alternative approach

## Deferred to v1.2+

- Video hover autoplay (browser restrictions make this complex)
- Carousel ad preview (high complexity)
- Inline ad thumbnails via screenshot proxy (requires server-side Puppeteer)
- Cross-chart filtering (click one chart filters all)
- Deep drill-down (3+ levels)
- Dark mode toggle (keep system preference only for v1.1)

## Open Questions

1. **PDF export vs Vercel timeout:** PDF generation may need Pro plan (60s timeout). Worth the requirement?
2. **Chart export compatibility:** Does recharts-to-png work with Recharts 3.6.0? Test before committing.
3. **Thumbnail proxy for v1.2:** If link-out isn't satisfying, is server-side screenshot worth the complexity?

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Stack additions | HIGH | Verified React 19 + Tailwind v4 compatibility |
| Ad preview (link approach) | HIGH | Only reliable option given Facebook restrictions |
| Export (CSV) | HIGH | Already implemented |
| Export (PDF) | MEDIUM | Pro plan may be required |
| Chart enhancements | HIGH | Recharts 3.x documented features |
| Mobile responsiveness | HIGH | Standard patterns |

---
*Research completed: 2026-01-25*
*Ready for requirements: yes*
