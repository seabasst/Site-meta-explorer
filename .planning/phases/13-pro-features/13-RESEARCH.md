# Phase 13: Pro Features - Research

**Researched:** 2026-01-27
**Domain:** Feature gating, ad previews, chart enhancements, export functionality
**Confidence:** HIGH

## Summary

Phase 13 builds gated Pro capabilities on top of the existing tier infrastructure from Phase 12. The codebase already has:
- Comprehensive tier configuration in `src/lib/tiers.ts` with feature flags for `deepAnalysis`, `export`, and `adPreviews`
- `useTierAccess` hook providing `isPro`, `config.features.*` checks
- `ProBadge` component for tier indication
- Existing CSV export utilities in `src/lib/export-utils.ts`
- Ad preview cards that already display creative text and link to Facebook
- Charts using Recharts v3.6.0 with ResponsiveContainer

The implementation focuses on three feature areas:
1. **Ad Previews**: Gate existing `AdPreviewCard` visibility by tier, enhance with media type distinction
2. **Enhanced Charts**: Add better tooltips, labels, and responsive behavior (already using Recharts v3)
3. **Export**: Add PDF export capability alongside existing CSV exports, gate behind tier

**Primary recommendation:** Use conditional rendering with `useTierAccess().config.features.*` to gate Pro features, showing teaser/locked states for free users. For PDF export, use `jspdf` + `html2canvas` (client-side, no server dependency) as the project already has similar patterns.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.6.0 | Chart visualization | Already used, v3 is current |
| lucide-react | 0.563.0 | Icons | Already used throughout |
| tailwind | 4.x | Styling | Already used |

### To Add
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jspdf | ^2.5.2 | PDF generation | 30K+ stars, 2.6M weekly downloads, client-side |
| html2canvas | ^1.4.1 | HTML to canvas for PDF | Required by jspdf for HTML rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jspdf + html2canvas | @react-pdf/renderer | More React-native but requires restructuring data for PDF primitives; jspdf captures existing HTML as-is |
| jspdf + html2canvas | puppeteer server-side | Better quality but requires server; current stack is client-side focused |
| jspdf + html2canvas | pdfme | Better for forms/templates; overkill for report export |

**Installation:**
```bash
npm install jspdf html2canvas
npm install --save-dev @types/html2canvas
```

## Architecture Patterns

### Existing Tier Gating Pattern
The codebase already establishes the tier gating pattern in `DepthSelector`:

```typescript
// Pattern from src/components/tier/depth-selector.tsx
const { canUseDepth, isPro, isLoading } = useTierAccess();
const { data: session } = useSession();

const handleLockedClick = () => {
  if (!session) {
    signIn(); // Redirect to sign in
  } else {
    startTransition(() => createCheckoutSession()); // Start checkout
  }
};

// Conditional rendering based on tier
{isLocked && <ProBadge size="sm" />}
```

### Recommended Feature Gating Pattern
```typescript
// For feature-level gating (not depth-level)
function ProFeatureWrapper({
  featureKey,
  children,
  teaser
}: {
  featureKey: keyof TierConfig['features'];
  children: React.ReactNode;
  teaser: React.ReactNode;
}) {
  const { config, isPro, isLoading } = useTierAccess();

  if (isLoading) return <Skeleton />;

  const hasAccess = config.features[featureKey];

  if (hasAccess) return <>{children}</>;

  // Show teaser with upgrade CTA
  return (
    <div className="relative">
      {teaser}
      <LockedOverlay featureKey={featureKey} />
    </div>
  );
}
```

### Recommended Project Structure Additions
```
src/
├── components/
│   ├── tier/
│   │   ├── pro-badge.tsx         # Existing
│   │   ├── depth-selector.tsx    # Existing
│   │   ├── feature-gate.tsx      # NEW: Generic feature gating wrapper
│   │   └── locked-overlay.tsx    # NEW: Overlay for locked features
│   ├── ads/
│   │   ├── ad-preview-card.tsx   # Existing - enhance
│   │   └── ad-preview-grid.tsx   # NEW: Grid with tier gating
│   └── export/
│       └── export-button.tsx     # NEW: PDF export with tier gating
└── lib/
    ├── export-utils.ts           # Existing CSV - add PDF
    └── pdf-export.ts             # NEW: PDF generation logic
```

### Anti-Patterns to Avoid
- **Duplicating tier checks:** Use centralized `useTierAccess` hook, don't check subscription status directly
- **Server-side PDF for simple exports:** Adds complexity; client-side jspdf sufficient for report PDFs
- **Gating at data level for display features:** Gate at UI level, data is already fetched
- **Complex PDF layouts initially:** Start with simple HTML-to-PDF capture, iterate

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom canvas drawing | jspdf + html2canvas | Edge cases with fonts, images, multi-page |
| Feature flag system | Custom context | Existing `useTierAccess` | Already has subscription status, tier config |
| Upgrade flow | Manual redirect logic | Existing `createCheckoutSession` | Already handles Stripe integration |
| Tooltip customization | Custom tooltip component | Recharts built-in `content` prop | Recharts v3 has full customization support |

**Key insight:** The tier infrastructure from Phase 12 handles the hard parts (subscription status, Stripe integration, session management). Phase 13 just needs conditional rendering based on `config.features.*`.

## Common Pitfalls

### Pitfall 1: PDF Quality Issues with html2canvas
**What goes wrong:** PDFs appear blurry, text not searchable, styles missing
**Why it happens:** html2canvas captures at screen DPI; CSS variables may not capture
**How to avoid:**
- Set `scale: 2` or higher in html2canvas options for better quality
- Use explicit color values in PDF-targeted elements (not CSS variables)
- Accept that text won't be searchable (image-based approach)
**Warning signs:** Blurry text in exported PDF, missing gradients

### Pitfall 2: Recharts ResponsiveContainer Label Disappearing
**What goes wrong:** Labels disappear when window resizes
**Why it happens:** Known Recharts issue since 2019, still present
**How to avoid:**
- Use fixed container heights where possible
- Add debounce to resize handling
- Test resize behavior during development
**Warning signs:** Labels visible initially, gone after resize

### Pitfall 3: Showing Pro Features During Loading
**What goes wrong:** Free user briefly sees Pro content before tier check completes
**Why it happens:** `useTierAccess` has loading state while fetching subscription
**How to avoid:**
- Always check `isLoading` before rendering
- Use skeleton/placeholder during loading
- Default to showing locked state, not unlocked
**Warning signs:** Flash of Pro content on page load

### Pitfall 4: Gating Server-Fetched Data at UI Level Only
**What goes wrong:** Pro data visible in network tab even for free users
**Why it happens:** Data fetched regardless of tier, only display gated
**How to avoid:**
- For display features (previews, enhanced charts): UI gating is fine
- For data-sensitive features: gate at API level (already done in Phase 12)
**Warning signs:** Free users can see Pro data in browser DevTools

### Pitfall 5: PDF Export Blocking Main Thread
**What goes wrong:** UI freezes during PDF generation
**Why it happens:** jspdf is synchronous, large documents take time
**How to avoid:**
- Show loading indicator during export
- Use `useTransition` for non-urgent updates
- Keep exported content reasonable size
**Warning signs:** UI unresponsive during export

## Code Examples

### Feature Gate Component
```typescript
// src/components/tier/feature-gate.tsx
'use client';

import { useTierAccess } from '@/hooks/use-tier-access';
import { ProBadge } from './pro-badge';
import { createCheckoutSession } from '@/app/actions/stripe';
import { useSession } from 'next-auth/react';
import { signIn } from 'next-auth/react';
import { useTransition } from 'react';
import { Lock } from 'lucide-react';

interface FeatureGateProps {
  feature: 'deepAnalysis' | 'export' | 'adPreviews';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showTeaser?: boolean;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showTeaser = true
}: FeatureGateProps) {
  const { config, isLoading } = useTierAccess();
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  if (isLoading) {
    return fallback || <div className="animate-pulse bg-[var(--bg-tertiary)] rounded-lg h-32" />;
  }

  const hasAccess = config.features[feature];

  if (hasAccess) {
    return <>{children}</>;
  }

  if (!showTeaser) {
    return null;
  }

  const handleUpgrade = () => {
    if (!session) {
      signIn();
    } else {
      startTransition(() => createCheckoutSession());
    }
  };

  return (
    <div className="relative">
      {/* Teaser content - blurred/faded */}
      <div className="opacity-50 pointer-events-none blur-sm">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)]/60 rounded-lg">
        <div className="text-center p-4">
          <Lock className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)]" />
          <div className="flex items-center gap-2 justify-center mb-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Pro Feature</span>
            <ProBadge size="sm" />
          </div>
          <button
            onClick={handleUpgrade}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent-green)] text-white hover:bg-[var(--accent-green)]/90 transition-colors"
          >
            {isPending ? 'Loading...' : 'Upgrade to Pro'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### PDF Export Utility
```typescript
// src/lib/pdf-export.ts
import type { FacebookApiResult } from './facebook-api';

export async function exportToPDF(
  result: FacebookApiResult,
  elementId: string
): Promise<void> {
  // Dynamic imports to avoid bundle bloat
  const jsPDF = (await import('jspdf')).default;
  const html2canvas = (await import('html2canvas')).default;

  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Element not found for PDF export');
  }

  // Capture element as canvas with high DPI
  const canvas = await html2canvas(element, {
    scale: 2, // 2x for better quality
    useCORS: true,
    logging: false,
    backgroundColor: '#1c1c0d', // Match dark theme
    scrollX: 0,
    scrollY: -window.scrollY, // Handle scroll position
  });

  const imgData = canvas.toDataURL('image/png');
  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let heightLeft = imgHeight;
  let position = 0;

  // First page
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  // Additional pages if needed
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const pageName = result.pageName?.replace(/[^a-zA-Z0-9]/g, '_') || 'report';
  pdf.save(`${pageName}_analysis_${new Date().toISOString().split('T')[0]}.pdf`);
}
```

### Enhanced Tooltip for Charts
```typescript
// Pattern for Recharts v3 custom tooltip
// Source: Recharts v3 documentation

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: Record<string, unknown>;
  }>;
  label?: string;
}

function EnhancedTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-[var(--bg-secondary)] border-[var(--border-subtle)] px-3 py-2 text-sm shadow-md">
      <div className="mb-1 font-medium text-[var(--text-primary)]">{label}</div>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">
            {entry.dataKey}:
          </span>
          <span className="font-medium text-[var(--text-primary)]">
            {typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Usage in chart:
<Tooltip content={<EnhancedTooltip />} />
```

### Ad Preview with Tier Gating
```typescript
// Pattern for gating ad previews
// Wrap existing AdPreviewCard grid with FeatureGate

function AdPreviewSection({ ads }: { ads: FacebookAdResult[] }) {
  const topAds = [...ads]
    .sort((a, b) => b.euTotalReach - a.euTotalReach)
    .slice(0, 6);

  return (
    <FeatureGate feature="adPreviews">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {topAds.map((ad, index) => (
          <AdPreviewCard key={ad.adArchiveId || index} ad={ad} />
        ))}
      </div>
    </FeatureGate>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom PDF canvas drawing | jspdf + html2canvas | Stable since 2020 | Captures existing HTML/CSS directly |
| Recharts v2 formatter prop | Recharts v3 content prop | 2024 | Use `content` prop for custom tooltips |
| Server-side PDF generation | Client-side with jspdf | Ongoing | Simpler architecture, no server load |

**Deprecated/outdated:**
- Recharts Tooltip `formatter` prop through chart components: Use `content` prop instead in v3
- `Customized` component in Recharts v3: Can now use custom components directly as children

## Data Available for Ad Previews

From `FacebookAdResult` in `src/lib/facebook-api.ts`, these fields are available for ad previews:

| Field | Type | Description | Currently Used |
|-------|------|-------------|----------------|
| `adArchiveId` | string | Unique ad identifier | Yes - for links |
| `creativeBody` | string \| null | Ad creative text | Yes - displayed |
| `linkTitle` | string \| null | Ad headline | Yes - displayed |
| `linkCaption` | string \| null | Caption text | No |
| `linkUrl` | string \| null | Destination URL | Yes - domain shown |
| `snapshotUrl` | string \| null | Facebook ad snapshot URL | No - could link to preview |
| `mediaType` | 'video' \| 'image' \| 'unknown' | Ad format | Yes - badge shown |
| `euTotalReach` | number | EU reach count | Yes - displayed |
| `startedRunning` | string \| null | Start date | Yes - displayed |

**Enhancment opportunities:**
- Show `linkCaption` as additional context
- Link to `snapshotUrl` when available (alternative to ad library link)
- Clearer video vs image visual distinction

## Open Questions

1. **PDF Export Scope**
   - What we know: CSV exports exist for full report, ads only, demographics
   - What's unclear: Should PDF include charts (more complex capture)?
   - Recommendation: Start with text/data sections only, add charts in v1.1

2. **Chart Enhancement Scope**
   - What we know: Charts work, use Recharts v3
   - What's unclear: What specific "enhanced" features are wanted beyond tooltips?
   - Recommendation: Focus on better tooltips and labels; leave chart type additions for later

3. **Ad Preview Teaser Content**
   - What we know: Free users should see "locked/teased" state
   - What's unclear: Should teaser show blurred preview or just placeholder?
   - Recommendation: Show blurred preview with lock overlay (more compelling)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/tiers.ts`, `src/hooks/use-tier-access.ts`, `src/lib/export-utils.ts`
- Codebase analysis: `src/components/tier/depth-selector.tsx`, `src/components/ads/ad-preview-card.tsx`
- Codebase analysis: `src/lib/facebook-api.ts` (FacebookAdResult type)
- [Recharts API - Tooltip](https://recharts.github.io/en-US/api/Tooltip/) - v3 tooltip customization
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) - breaking changes

### Secondary (MEDIUM confidence)
- [jsPDF GitHub](https://github.com/parallax/jsPDF) - client-side PDF generation
- [Top JS PDF libraries 2025](https://www.nutrient.io/blog/top-js-pdf-libraries/) - library comparison
- [6 Open-Source PDF Libraries for React](https://blog.react-pdf.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025) - library overview

### Tertiary (LOW confidence)
- WebSearch results on ResponsiveContainer issues - ongoing GitHub issues

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - jspdf widely used, recharts already installed
- Architecture: HIGH - patterns established in Phase 12 codebase
- Pitfalls: MEDIUM - some based on known issues, some extrapolated
- Feature scope: MEDIUM - requirements clear but implementation details flexible

**Research date:** 2026-01-27
**Valid until:** 60 days (stable libraries, established patterns)
