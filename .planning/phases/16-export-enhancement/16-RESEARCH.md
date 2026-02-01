# Phase 16: Export Enhancement - Research

**Researched:** 2026-02-01
**Domain:** PDF export quality, jsPDF + html2canvas-pro, professional formatting
**Confidence:** HIGH

## Summary

Phase 16 improves the existing PDF export (built in Phase 13-03) from a basic html2canvas screen capture to a professional, well-formatted report. The current implementation in `src/lib/pdf-export.ts` captures a single DOM element (`#analysis-results`) using html2canvas-pro at 2x scale and splits it across A4 pages using jsPDF. This approach has several known quality issues: it only captures the currently-visible tab (audience/ads/expert), rasterizes SVG charts into blurry pixels, has no headers/footers/page numbers, and can produce messy page breaks that split content mid-chart.

The recommended approach is to stay with jsPDF + html2canvas-pro (already installed: jspdf@4.0.0, html2canvas-pro@1.6.6) but significantly improve the capture and assembly process. Rather than capturing one giant DOM element, the enhancement should capture individual sections separately (summary, each chart, ad table, expert analysis) and compose them into a structured PDF with proper headers, footers, page numbers, and controlled page breaks. This avoids the "one giant screenshot split across pages" problem entirely.

**Primary recommendation:** Keep jsPDF + html2canvas-pro but switch from single-element capture to section-by-section capture with programmatic PDF composition, adding professional headers/footers/page numbers on each page.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jspdf | 4.0.0 | PDF document creation | Already installed, well-maintained, supports text/image/vector drawing |
| html2canvas-pro | 1.6.6 | DOM-to-canvas capture | Already installed, improved fork of html2canvas with better rendering |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | The existing stack is sufficient for this enhancement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| html2canvas-pro | html-to-image | Better SVG rendering via foreignObject, but different API; not worth switching since charts are custom CSS bars, not primarily SVG |
| html2canvas-pro | @react-pdf/renderer | Fully native PDF generation (no rasterization), but requires completely rewriting all components as PDF-specific elements; massive effort for incremental gain |
| Section-by-section capture | Single capture with CSS page-break hints | Simpler code but less control over layout; page breaks still unreliable |

**Installation:**
```bash
# No new packages needed - jspdf@4.0.0 and html2canvas-pro@1.6.6 already installed
```

## Architecture Patterns

### Current Implementation (What Exists)
```
src/lib/pdf-export.ts        # Single exportToPDF(result, elementId) function
src/lib/export-utils.ts      # CSV export utilities (not relevant to PDF)
src/app/page.tsx              # Export dropdown triggers exportToPDF with 'analysis-results' ID
```

### Recommended Enhanced Structure
```
src/lib/pdf-export.ts        # Enhanced with section-based capture + composition
```

Keep it as a single file enhancement - no need for a complex folder structure. The function signature should evolve to accept configuration options.

### Pattern 1: Section-by-Section Capture
**What:** Instead of capturing one giant DOM element and splitting it, capture each logical section (summary cards, each chart, ad table, etc.) as individual canvas images, then compose them into the PDF with controlled placement.
**When to use:** When content has distinct sections that should not be split across pages.
**Example:**
```typescript
// Capture individual sections
const sections = [
  { id: 'account-summary', label: 'Account Summary' },
  { id: 'demographics-summary', label: 'Key Insights' },
  { id: 'age-gender-chart', label: 'Age & Gender' },
  { id: 'country-chart', label: 'Geographic Distribution' },
  { id: 'media-type-breakdown', label: 'Ad Types' },
];

for (const section of sections) {
  const element = document.getElementById(section.id);
  if (!element) continue;
  const canvas = await html2canvas(element, captureOptions);
  // Calculate if this section fits on current page
  // If not, add new page first
  // Then place the image
}
```

### Pattern 2: Post-Generation Header/Footer Loop
**What:** After all content pages are generated, loop through every page to add consistent headers and footers.
**When to use:** Always - this is how jsPDF handles repeating page elements.
**Example:**
```typescript
const totalPages = pdf.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  pdf.setPage(i);

  // Header
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`${pageName} - Ad Library Analysis`, margin, 15);
  pdf.text(new Date().toLocaleDateString(), pdfWidth - margin, 15, { align: 'right' });

  // Divider line under header
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, 20, pdfWidth - margin, 20);

  // Footer
  pdf.text(`Page ${i} of ${totalPages}`, pdfWidth / 2, pdfHeight - 10, { align: 'center' });
  pdf.text('Generated by BrandSpy', margin, pdfHeight - 10);
}
```

### Pattern 3: Pre-Capture DOM Preparation
**What:** Before capturing, temporarily modify the DOM to optimize for PDF output (expand collapsed sections, show all tabs, remove interactive elements).
**When to use:** When the visible state of the UI does not represent the full exportable content.
**Example:**
```typescript
async function prepareForCapture(element: HTMLElement): Promise<() => void> {
  const cleanups: (() => void)[] = [];

  // Open all <details> elements
  element.querySelectorAll('details').forEach(details => {
    if (!details.open) {
      details.open = true;
      cleanups.push(() => { details.open = false; });
    }
  });

  // Hide interactive-only elements (export buttons, tab switchers)
  element.querySelectorAll('[data-pdf-hide]').forEach(el => {
    const htmlEl = el as HTMLElement;
    const prev = htmlEl.style.display;
    htmlEl.style.display = 'none';
    cleanups.push(() => { htmlEl.style.display = prev; });
  });

  // Wait for any reflow
  await new Promise(r => setTimeout(r, 100));

  return () => cleanups.forEach(fn => fn());
}
```

### Pattern 4: White Background Override for Print
**What:** Override the dark theme with a white/light background for PDF output to save ink and improve readability.
**When to use:** Professional PDF reports should use light backgrounds for printing.
**Example:**
```typescript
// Option A: Use html2canvas backgroundColor override
const canvas = await html2canvas(element, {
  backgroundColor: '#ffffff',  // Force white background
  scale: 2,
  useCORS: true,
});

// Option B: Temporarily apply light theme class before capture
element.classList.add('pdf-export-mode');
// CSS: .pdf-export-mode { --bg-primary: #fff; --text-primary: #111; ... }
```

### Anti-Patterns to Avoid
- **Capturing the entire page as one image:** Leads to uncontrolled page breaks that split charts, tables, and text mid-element. Always capture sections individually.
- **Not disabling animations before capture:** Recharts and CSS transitions can capture mid-animation states. Always disable animations before capture.
- **Relying on CSS page-break properties with html2canvas:** html2canvas rasterizes to a single image first - CSS page-break properties have zero effect. Page breaks must be controlled programmatically.
- **Using JPEG for chart images:** JPEG compression creates artifacts around sharp edges in charts. Always use PNG for chart captures.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF creation | Custom canvas-to-file binary serialization | jsPDF (already installed) | Binary PDF format is complex with cross-references, streams, fonts |
| DOM-to-image capture | Manual SVG foreignObject + canvas drawing | html2canvas-pro (already installed) | CSS rendering edge cases are enormous (transforms, filters, custom properties) |
| Page number formatting | Custom page tracking | `pdf.getNumberOfPages()` + `pdf.setPage(i)` loop | jsPDF has built-in page management |
| A4 dimensions | Manual pixel-to-point conversion | jsPDF `format: 'a4'` + `unit: 'pt'` | Library knows standard paper sizes |

**Key insight:** The enhancement is about better orchestration of the existing tools, not replacing them. The capture technology (html2canvas-pro) and PDF assembly (jsPDF) are adequate - the problem is in how they are combined.

## Common Pitfalls

### Pitfall 1: Only Capturing the Active Tab
**What goes wrong:** Current code captures `#analysis-results` which shows only one tab (audience/ads/expert). The PDF only contains whatever tab was visible when export was triggered.
**Why it happens:** The UI uses tab navigation where only one tab renders at a time.
**How to avoid:** Either (a) temporarily render all tab content during capture by removing tab visibility conditions, or (b) capture each tab's content separately by programmatically switching tabs before each capture.
**Warning signs:** Users complain PDF is "incomplete" or "missing charts."

### Pitfall 2: Collapsed Details Elements
**What goes wrong:** The `<details>` elements for Age & Gender, Country, and Media Type charts may be collapsed. html2canvas captures the collapsed state, resulting in missing chart content.
**Why it happens:** Charts are wrapped in `<details>` with `open` attribute. Users may have collapsed some.
**How to avoid:** Force all `<details>` elements open before capture, restore after.
**Warning signs:** Blank sections or just headers without chart content.

### Pitfall 3: CSS Custom Properties Not Resolving
**What goes wrong:** html2canvas has limited support for CSS custom properties (`var(--text-primary)` etc.). Colors may render incorrectly or as transparent.
**Why it happens:** html2canvas manually implements CSS rendering and may not resolve all variable references.
**How to avoid:** Test actual PDF output. If custom properties fail, add a pre-capture step that resolves variables to literal values on key elements. html2canvas-pro has better support than html2canvas, so this may not be an issue - needs testing.
**Warning signs:** Elements appearing invisible or wrong colors in the exported PDF.

### Pitfall 4: Chart Animation Mid-Capture
**What goes wrong:** Recharts charts (TimeTrends uses Recharts with `<AreaChart>`) may be mid-animation when captured, resulting in partially-rendered or empty charts.
**Why it happens:** Recharts animates on mount by default.
**How to avoid:** Either set `isAnimationActive={false}` globally for Recharts components, or add a delay before capture to ensure animations complete. A simple `await new Promise(r => setTimeout(r, 500))` before capture works.
**Warning signs:** Charts appear partially filled or at wrong scale in PDF.

### Pitfall 5: Content Exceeding Single Canvas Limits
**What goes wrong:** Very long pages with many ads can exceed browser canvas size limits (varies by browser, typically 16384px height). html2canvas silently fails or truncates.
**Why it happens:** A page with 500+ ads in a results table creates an extremely tall DOM element.
**How to avoid:** Section-by-section capture naturally avoids this since each section is reasonably sized.
**Warning signs:** PDF cuts off after a certain point; bottom sections missing.

### Pitfall 6: Cross-Origin Image Issues
**What goes wrong:** Ad preview images loaded from Facebook CDN may fail to render due to CORS.
**Why it happens:** html2canvas uses canvas which is tainted by cross-origin images.
**How to avoid:** The current code sets `useCORS: true` which is correct. For images that still fail, consider using the existing media proxy (`/api/media/[uuid]`) which already handles this. Alternatively, catch and replace failed images with a placeholder.
**Warning signs:** Blank spaces where ad preview images should be.

## Code Examples

### Enhanced PDF Export Structure
```typescript
interface PDFExportOptions {
  includeAudience?: boolean;
  includeAds?: boolean;
  includeExpert?: boolean;
  theme?: 'dark' | 'light';
}

export async function exportToPDF(
  result: FacebookApiResult,
  elementId: string,
  options: PDFExportOptions = {}
): Promise<void> {
  const jsPDF = (await import('jspdf')).default;
  const html2canvas = (await import('html2canvas-pro')).default;

  const {
    includeAudience = true,
    includeAds = true,
    includeExpert = true,
    theme = 'dark',
  } = options;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pdfWidth = 595.28;
  const pdfHeight = 841.89;
  const margin = 30;
  const headerHeight = 25;
  const footerHeight = 20;
  const contentWidth = pdfWidth - (margin * 2);
  const contentTop = margin + headerHeight;
  const contentBottom = pdfHeight - margin - footerHeight;
  let currentY = contentTop;
  let isFirstPage = true;

  const captureOptions = {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: theme === 'dark' ? '#1c1c0d' : '#ffffff',
    scrollX: 0,
    scrollY: -window.scrollY,
  };

  // Helper: add section image to PDF with page-break logic
  function addSectionToPDF(canvas: HTMLCanvasElement) {
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const scale = contentWidth / imgWidth;
    const scaledHeight = imgHeight * scale;

    // If section doesn't fit, start new page
    if (currentY + scaledHeight > contentBottom && !isFirstPage) {
      pdf.addPage();
      currentY = contentTop;
    }

    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', margin, currentY, contentWidth, scaledHeight);
    currentY += scaledHeight + 10; // 10pt gap between sections
    isFirstPage = false;
  }

  // Capture sections...
  // (section capture logic here)

  // Add headers and footers to all pages
  const totalPages = pdf.getNumberOfPages();
  const pageName = result.pageName || 'Analysis';
  const date = new Date().toLocaleDateString();

  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);

    // Header line
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(margin, margin + 15, pdfWidth - margin, margin + 15);

    // Header text
    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 130);
    pdf.text(pageName, margin, margin + 10);
    pdf.text(date, pdfWidth - margin, margin + 10, { align: 'right' });

    // Footer
    pdf.line(margin, pdfHeight - margin - 15, pdfWidth - margin, pdfHeight - margin - 15);
    pdf.text(`Page ${i} of ${totalPages}`, pdfWidth / 2, pdfHeight - margin - 5, { align: 'center' });
  }

  pdf.save(filename);
}
```

### Section ID Tagging Pattern
```typescript
// In components, add data-pdf-section attributes for easy discovery
<div data-pdf-section="account-summary">
  <AccountSummary result={apiResult} />
</div>

<div data-pdf-section="age-gender-chart">
  <AgeGenderChart data={...} />
</div>

// In pdf-export.ts, discover and capture all sections
const sections = element.querySelectorAll('[data-pdf-section]');
for (const section of sections) {
  const canvas = await html2canvas(section as HTMLElement, captureOptions);
  addSectionToPDF(canvas);
}
```

### Cover Page Pattern
```typescript
function addCoverPage(pdf: jsPDF, result: FacebookApiResult) {
  const pdfWidth = 595.28;
  const pdfHeight = 841.89;

  // Brand name as title
  pdf.setFontSize(28);
  pdf.setTextColor(50, 50, 50);
  pdf.text(result.pageName || 'Ad Analysis', pdfWidth / 2, 200, { align: 'center' });

  // Subtitle
  pdf.setFontSize(14);
  pdf.setTextColor(130, 130, 130);
  pdf.text('Facebook Ad Library Analysis Report', pdfWidth / 2, 230, { align: 'center' });

  // Key stats
  pdf.setFontSize(11);
  const stats = [
    `Total Ads: ${result.totalAdsFound}`,
    `Active Ads: ${result.ads.filter(a => a.isActive).length}`,
    `Date: ${new Date().toLocaleDateString()}`,
  ];
  stats.forEach((stat, i) => {
    pdf.text(stat, pdfWidth / 2, 280 + i * 20, { align: 'center' });
  });

  // "Generated by" footer
  pdf.setFontSize(9);
  pdf.setTextColor(180, 180, 180);
  pdf.text('Generated by BrandSpy', pdfWidth / 2, pdfHeight - 60, { align: 'center' });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| html2canvas | html2canvas-pro | 2024 | Better CSS support, improved rendering; project already uses html2canvas-pro |
| Single giant capture | Section-by-section capture | Best practice | Controlled page breaks, better quality |
| No headers/footers | Post-generation loop | jsPDF pattern | Professional appearance |
| Dark theme only | Theme-aware export | Enhancement | Better print output |

**Deprecated/outdated:**
- html2canvas (original): Project already migrated to html2canvas-pro which is the maintained fork
- @types/html2canvas: Was removed during Phase 13-03 as types did not match

## Open Questions

Things that could not be fully resolved:

1. **Should the PDF use light theme for print?**
   - What we know: Dark backgrounds waste ink and can look poor when printed. Professional reports typically use light themes.
   - What is unclear: Whether users expect the PDF to match the on-screen dark theme or prefer a print-friendly light version.
   - Recommendation: Default to light/white background for PDF. This is the standard for professional reports. Could offer a toggle later.

2. **How to handle the tab-based content?**
   - What we know: Only one tab (audience/ads/expert) is visible at a time. The current export only captures the active tab.
   - What is unclear: Should the PDF include all tabs or just the active one?
   - Recommendation: Include all tab content in the PDF report. A "full report" should be comprehensive. Use section headers to separate what were previously tabs.

3. **Should ad preview images be included?**
   - What we know: Ad preview cards load images from Facebook CDN. Cross-origin issues can cause these to fail in html2canvas. The project has a media proxy that could help.
   - What is unclear: Whether image capture is reliable enough and whether it significantly increases PDF size.
   - Recommendation: Attempt to include ad preview images but gracefully handle failures. Use the existing media proxy endpoint. Consider limiting to top 6 ads by reach to keep PDF size reasonable.

4. **Cover page - is it worth the effort?**
   - What we know: A cover page with brand name, key stats, and date adds professionalism.
   - What is unclear: Whether this is overkill for the current product stage.
   - Recommendation: Yes, add a simple cover page. It is low effort with jsPDF text drawing (no html2canvas needed) and significantly improves perceived quality.

## Sources

### Primary (HIGH confidence)
- `src/lib/pdf-export.ts` - Current implementation analyzed directly
- `src/app/page.tsx` (lines 917-970) - Export trigger and DOM structure analyzed directly
- `src/lib/export-utils.ts` - CSV export analyzed for data structure understanding
- `npm ls` output - Confirmed jspdf@4.0.0, html2canvas-pro@1.6.6, recharts@3.6.0
- Phase 13-03 SUMMARY.md - Documented decisions and implementation details

### Secondary (MEDIUM confidence)
- [jsPDF header/footer pattern](https://codepen.io/kuznetsovvn/pen/vYLVGqG) - CodePen demonstrating getNumberOfPages loop
- [html2canvas SVG issues](https://github.com/niklasvh/html2canvas/issues/1757) - Known chart capture issues
- [jsPDF GitHub issues](https://github.com/parallax/jsPDF/issues/3662) - Header/footer multi-page patterns
- [html-to-image vs html2canvas comparison](https://npm-compare.com/dom-to-image,html-to-image,html2canvas) - Ecosystem comparison

### Tertiary (LOW confidence)
- [Best HTML to Canvas Solutions 2025](https://portalzine.de/best-html-to-canvas-solutions-in-2025/) - General ecosystem overview
- [Creating Professional PDFs with jsPDF](https://medium.com/@narendraktw/generate-html-to-pdf-with-fixed-header-and-footer-and-the-body-content-is-dynamic-137671599a40) - Tutorial-level guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries already installed and verified via npm ls
- Architecture: HIGH - Patterns derived from direct analysis of existing code and known jsPDF API
- Pitfalls: HIGH - Identified from analyzing actual DOM structure (tabs, details, CSS variables) and known html2canvas limitations
- Code examples: MEDIUM - Patterns are standard but untested against this specific codebase

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (stable libraries, no rapid changes expected)
