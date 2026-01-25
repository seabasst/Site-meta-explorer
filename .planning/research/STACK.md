# Stack Research

**Domain:** Data dashboard enhancement (v1.1)
**Researched:** 2026-01-25
**Confidence:** HIGH

## Executive Summary

The existing stack (Next.js 16.1.2, React 19.2.3, Recharts 3.6.0, Tailwind CSS 4) is modern and well-suited for enhancement. The recommended additions focus on:

1. **shadcn/ui** for consistent, accessible UI components (fully compatible with React 19 + Tailwind v4)
2. **Sonner** for toast notifications (shadcn/ui's official choice)
3. **react-to-pdf + react-papaparse** for export functionality
4. **recharts-to-png** for chart image export
5. **lucide-react** for icons (already used by shadcn/ui)

All recommendations are verified compatible with React 19 and Tailwind CSS 4.

---

## Recommended Stack Additions

### UI Enhancement Libraries

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| shadcn/ui | latest (CLI) | Component system | React 19 + Tailwind v4 compatible; copy-paste components you own; built on Radix primitives for accessibility; no version lock-in |
| lucide-react | ^0.562.0 | Icons | Optimized for React 19; tree-shakable; SVG-based; shadcn/ui default |
| class-variance-authority | ^0.7.1 | Component variants | Type-safe variant management for Tailwind components |
| clsx | ^2.1.1 | Conditional classes | Tiny utility for dynamic classNames |
| tailwind-merge | ^3.0.1 | Class deduplication | Prevents Tailwind class conflicts when overriding |
| tw-animate-css | latest | Animations | Tailwind v4 replacement for tailwindcss-animate |

**The `cn()` utility pattern:**
```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Rationale:** shadcn/ui is the clear winner for React 19 + Tailwind v4 projects. Unlike traditional component libraries, you copy the source code into your project, meaning:
- Full customization without fighting library constraints
- No peer dependency conflicts
- Components use Radix primitives for accessibility (keyboard nav, focus management, screen readers)
- Official Tailwind v4 support with OKLCH colors and `@theme` directive

### Toast/Error Notifications

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| sonner | ^2.0.0 | Toast notifications | shadcn/ui's official toast; no hooks required; TypeScript-first; trigger from anywhere |

**Rationale:** Sonner is the modern standard for React toast notifications. It's:
- Lightweight and fast
- Works without React state management (call `toast()` from anywhere)
- Has excellent defaults with full customization
- Officially integrated with shadcn/ui

**Usage:**
```typescript
import { toast } from "sonner";

// Trigger from anywhere - no hooks needed
toast.success("Analysis complete!");
toast.error("Failed to fetch data");
```

### Chart Enhancement

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| recharts | ^3.6.0 (existing) | Charts | Already installed; supports Treemap, Sankey, Pie, Radar, etc. |
| recharts-to-png | ^3.0.1 | Chart export | Export Recharts to PNG; wrapper around html2canvas |

**Rationale:** Recharts 3.6.0 is already installed and comprehensive. Rather than replacing it, enhance with:

1. **More chart types already available in Recharts:**
   - `Treemap` - for hierarchical data visualization
   - `PieChart` - for demographic distribution
   - `RadarChart` - for multi-dimensional comparisons
   - `Sankey` - for flow visualization

2. **Chart export via recharts-to-png:**
```typescript
import { useCurrentPng } from "recharts-to-png";

const [getPng, { ref, isLoading }] = useCurrentPng();

const handleDownload = async () => {
  const png = await getPng();
  if (png) {
    // Use file-saver or download directly
    FileSaver.saveAs(png, "chart.png");
  }
};

return <LineChart ref={ref} ... />;
```

**NOT recommended:** Replacing Recharts with alternatives like Chart.js or Visx. Recharts is already integrated and performant.

### Export Libraries

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| react-to-pdf | ^3.0.0 | PDF export | Simple API; wraps jsPDF + html2canvas; supports React hooks |
| react-papaparse | ^4.4.0 | CSV export | Fast parsing/generation; CSVDownloader component; TypeScript support |
| file-saver | ^2.0.5 | File downloads | Trigger browser downloads; works with blobs and URLs |
| @types/file-saver | ^2.0.7 | TypeScript types | Type definitions for file-saver |

**PDF Export Approach:**
```typescript
import { usePDF } from "react-to-pdf";

function ExportButton() {
  const { toPDF, targetRef } = usePDF({
    filename: "demographics-report.pdf",
    page: { format: "A4" }
  });

  return (
    <>
      <div ref={targetRef}>
        {/* Content to export */}
      </div>
      <button onClick={() => toPDF()}>Download PDF</button>
    </>
  );
}
```

**CSV Export Approach:**
```typescript
import { CSVDownloader, jsonToCSV } from "react-papaparse";

function CSVExportButton({ data }) {
  return (
    <CSVDownloader
      data={data}
      filename="demographics"
      bom={true} // UTF-8 BOM for Excel compatibility
    >
      Download CSV
    </CSVDownloader>
  );
}
```

**PDF Quality Note:** react-to-pdf creates screenshot-based PDFs (not vectorized). For dashboard exports this is acceptable, but text won't be selectable. For higher quality, use `scale: 2` in html2canvas options.

### Media Display (Ad Previews)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| next/image | built-in | Image optimization | Already in Next.js; WebP, lazy loading, responsive |
| next/video | built-in | Video handling | Native HTML5 video with Next.js best practices |

**Rationale:** Next.js 16 provides excellent built-in media handling. No external libraries needed.

**Image handling:**
```typescript
import Image from "next/image";

<Image
  src={adCreative.imageUrl}
  alt={adCreative.title}
  width={300}
  height={200}
  placeholder="blur"
  blurDataURL={adCreative.blurDataUrl} // optional
/>
```

**Video handling:**
```typescript
<video
  src={adCreative.videoUrl}
  controls
  muted
  playsInline
  preload="metadata"
  className="rounded-lg"
/>
```

**Next.js 16 changes:** The `priority` prop is deprecated; use `preload` instead. Quality allowlist is now required in next.config.ts.

---

## Installation

```bash
# Core UI (shadcn/ui + dependencies)
npx shadcn@latest init

# After init, add components as needed:
npx shadcn@latest add button card dialog dropdown-menu input select skeleton toast

# Install Sonner (if not added by shadcn toast)
npm install sonner

# Export libraries
npm install react-to-pdf react-papaparse file-saver recharts-to-png
npm install -D @types/file-saver

# Note: shadcn init will install these automatically:
# - class-variance-authority
# - clsx
# - tailwind-merge
# - lucide-react
# - tw-animate-css
```

**shadcn/ui init will prompt for:**
- Style preference (New York or Default)
- Base color
- CSS variables usage
- React Server Components
- Component location (`@/components/ui`)

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| UI Components | shadcn/ui | Radix Themes | Radix Themes is more opinionated; shadcn gives full control |
| UI Components | shadcn/ui | Material UI | Heavy bundle; different design language; React 19 support lagging |
| UI Components | shadcn/ui | Chakra UI | Less Tailwind-native; different styling paradigm |
| Icons | lucide-react | react-icons | Larger bundle; lucide is shadcn default |
| Toast | Sonner | react-hot-toast | Both good; Sonner is shadcn official choice |
| Toast | Sonner | react-toastify | Heavier; more configuration required |
| Charts | Recharts | Chart.js | Already using Recharts; no reason to switch |
| Charts | Recharts | Visx | Lower-level; Recharts already meets needs |
| PDF | react-to-pdf | @react-pdf/renderer | @react-pdf requires rewriting components; overkill for screenshots |
| PDF | react-to-pdf | jsPDF raw | react-to-pdf is simpler wrapper |
| CSV | react-papaparse | react-csv | react-papaparse more actively maintained; better features |

---

## What NOT to Use

### Libraries with React 19 Compatibility Issues

| Library | Issue | Alternative |
|---------|-------|-------------|
| Material UI v5 | Peer dependency warnings; ref forwarding issues | shadcn/ui |
| Chakra UI v2 | Not yet fully React 19 compatible | shadcn/ui |
| tailwindcss-animate | Deprecated for Tailwind v4 | tw-animate-css |
| react-icons | Bloated; includes all icon sets | lucide-react |

### Libraries That Don't Add Value

| Library | Why Skip |
|---------|----------|
| Framer Motion | Overkill for dashboard; CSS animations sufficient |
| React Query/TanStack Query | App uses Server Actions; not needed |
| Zustand/Redux | Simple state; React 19 hooks sufficient |
| Axios | fetch is sufficient; Next.js optimizes it |

### Anti-patterns

1. **Don't install multiple chart libraries** - Recharts 3.6.0 covers all needed chart types
2. **Don't use CSS-in-JS** (styled-components, Emotion) - Tailwind v4 handles all styling needs
3. **Don't add a separate form library** - shadcn/ui forms + React 19 form actions are sufficient
4. **Don't add date-fns/moment** - Native Intl.DateTimeFormat handles date formatting

---

## Compatibility Matrix

| Library | React 19 | Tailwind v4 | Next.js 16 | Notes |
|---------|----------|-------------|------------|-------|
| shadcn/ui | Yes | Yes | Yes | Full support; CLI handles setup |
| Radix UI | Yes | N/A | Yes | Primitives used by shadcn |
| Sonner | Yes | Yes | Yes | No special config needed |
| lucide-react | Yes* | N/A | Yes | May need --force flag for npm |
| react-to-pdf | Yes | N/A | Yes | Uses html2canvas under hood |
| react-papaparse | Yes | N/A | Yes | Framework-agnostic |
| recharts-to-png | Yes | N/A | Yes | Compatible with Recharts 3.x |
| file-saver | Yes | N/A | Yes | Framework-agnostic |

*lucide-react: peer dependency warning can be ignored or use `--force`

---

## Configuration Notes

### Next.js 16 Config for lucide-react

```typescript
// next.config.ts
export default {
  experimental: {
    optimizePackageImports: ['lucide-react']
  }
}
```

### Tailwind v4 Theme for shadcn

shadcn/ui will generate a CSS file with OKLCH colors. The `@theme` directive replaces `tailwind.config.js` theme extensions:

```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

@theme inline {
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(10% 0 0);
  /* ... more tokens */
}
```

### PDF Export Quality Settings

For higher quality PDF exports:

```typescript
const { toPDF, targetRef } = usePDF({
  canvas: {
    scale: 2, // Higher resolution
    useCORS: true, // For external images
  },
  page: {
    format: "A4",
    margin: 20
  }
});
```

---

## Sources

### HIGH Confidence (Official Documentation)

- [shadcn/ui React 19 + Tailwind v4 Support](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next)
- [Radix Primitives React 19 Compatibility](https://www.radix-ui.com/primitives/docs/overview/releases)
- [Next.js Image Component](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js Video Guide](https://nextjs.org/docs/app/guides/videos)
- [Recharts GitHub](https://github.com/recharts/recharts)
- [Sonner Documentation](https://sonner.emilkowal.ski/)
- [react-to-pdf GitHub](https://github.com/ivmarcos/react-to-pdf)
- [react-papaparse Documentation](https://react-papaparse.js.org/)

### MEDIUM Confidence (Verified with Multiple Sources)

- [Lucide React Guide](https://lucide.dev/guide/packages/lucide-react)
- [recharts-to-png npm](https://www.npmjs.com/package/recharts-to-png)
- [Class Variance Authority Docs](https://cva.style/docs)
- [Tailwind Merge + clsx Pattern](https://ui.shadcn.com/docs/installation/manual)
- [file-saver npm](https://www.npmjs.com/package/file-saver)

### Supporting Research

- [LogRocket: React Toast Libraries Compared 2025](https://blog.logrocket.com/react-toast-libraries-compared-2025/)
- [npm Compare: CSV Libraries](https://npm-compare.com/react-csv,react-csv-downloader,react-csv-reader,react-papaparse)
- [PDF Generation Libraries Comparison](https://dmitriiboikov.com/posts/2025/01/pdf-generation-comarison/)
