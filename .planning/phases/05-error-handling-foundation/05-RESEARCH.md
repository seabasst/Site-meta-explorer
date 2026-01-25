# Phase 5: Error Handling & Foundation - Research

**Researched:** 2026-01-25
**Domain:** Error handling, loading states, form validation (React + shadcn/ui)
**Confidence:** HIGH

## Summary

This phase establishes a stable foundation for v1.1 feature work by implementing proper error handling, loading states, and input validation. The existing codebase has basic error handling (displaying error strings) and a custom spinner component, but lacks skeleton loading, user-friendly error messages, retry functionality, and real-time validation.

The standard approach for this domain combines:
1. **shadcn/ui Skeleton** for content loading placeholders
2. **react-error-boundary** for graceful error recovery with retry
3. **shadcn/ui Form + Zod + React Hook Form** for real-time validation
4. **shadcn/ui Sonner** for toast notifications
5. **Exponential backoff** for API retry logic

**Primary recommendation:** Install shadcn/ui Skeleton, Sonner, Form components alongside react-error-boundary, then create a unified error handling layer that wraps the main page sections.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-error-boundary | 6.1.0 | Graceful error recovery with retry | De-facto standard; function component based; provides resetErrorBoundary |
| @hookform/resolvers | latest | Connect Zod to React Hook Form | Official resolver; type-safe |
| zod | latest | Schema validation | Industry standard; TypeScript-first; composable |
| react-hook-form | latest | Form state management | Minimal re-renders; excellent performance |

### shadcn/ui Components
| Component | Purpose | Why Standard |
|-----------|---------|--------------|
| Skeleton | Loading placeholders | Matches existing UI; Tailwind-based |
| Sonner | Toast notifications | Recommended over deprecated Toast; error/success variants |
| Form | Form wrapper with validation | Integrates Field, FieldError, FieldLabel |
| Alert | Static error/warning banners | destructive variant for errors |
| Spinner | Loading indicators in buttons | Consistent with existing LoadingSpinner pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-error-boundary | Class-based ErrorBoundary | react-error-boundary is more modern, hooks-based |
| Sonner | shadcn/ui Toast | Toast is deprecated; Sonner is recommended replacement |
| Zod | Yup | Zod is TypeScript-first; better inference |
| React Hook Form | Formik | RHF has better performance; less re-renders |

**Installation:**
```bash
# shadcn/ui components
pnpm dlx shadcn@latest add skeleton sonner alert form spinner

# npm packages
npm install react-error-boundary @hookform/resolvers zod react-hook-form
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── ui/                          # shadcn/ui components
│   │   ├── skeleton.tsx             # Loading placeholders
│   │   ├── sonner.tsx               # Toast provider
│   │   ├── alert.tsx                # Error banners
│   │   ├── spinner.tsx              # Loading spinner
│   │   └── form.tsx                 # Form components
│   ├── error/                       # Error handling components
│   │   ├── error-boundary.tsx       # Wrapped react-error-boundary
│   │   ├── error-fallback.tsx       # User-friendly fallback UI
│   │   └── api-error-alert.tsx      # API error display with retry
│   └── loading/                     # Loading state components
│       ├── demographics-skeleton.tsx # Skeleton for demographics section
│       ├── chart-skeleton.tsx       # Skeleton for chart areas
│       └── results-skeleton.tsx     # Skeleton for results table
├── hooks/
│   └── use-api-with-retry.ts        # Fetch wrapper with retry logic
├── lib/
│   ├── errors.ts                    # Error classes and utilities
│   ├── validation.ts                # Zod schemas for URL validation
│   └── retry.ts                     # Exponential backoff utility
└── app/
    └── layout.tsx                   # Add Toaster component here
```

### Pattern 1: Error Boundary with Retry
**What:** Wrap page sections in error boundaries that catch render errors and provide retry.
**When to use:** Around each major UI section (demographics, charts, results).
**Example:**
```typescript
// Source: react-error-boundary docs + shadcn/ui Alert
import { ErrorBoundary } from 'react-error-boundary';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>We couldn't load this section. Please try again.</span>
        <Button
          variant="outline"
          size="sm"
          onClick={resetErrorBoundary}
          className="ml-4"
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// Usage in page.tsx
<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onReset={() => {
    // Clear cached state that caused the error
  }}
>
  <DemographicsSection data={apiResult} />
</ErrorBoundary>
```

### Pattern 2: Skeleton Loading States
**What:** Show placeholder UI that matches content layout while loading.
**When to use:** Any section that fetches data asynchronously.
**Example:**
```typescript
// Source: shadcn/ui Skeleton docs
import { Skeleton } from "@/components/ui/skeleton";

function DemographicsSkeleton() {
  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      {/* Chart skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>

      {/* Summary skeleton */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Usage
{isLoading ? <DemographicsSkeleton /> : <DemographicsSummary data={data} />}
```

### Pattern 3: API Retry with Exponential Backoff
**What:** Retry failed API calls with increasing delay.
**When to use:** All fetch calls to external APIs (Facebook Graph API).
**Example:**
```typescript
// Source: exponential-backoff pattern
interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 100,
        maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unexpected: exceeded retry loop');
}
```

### Pattern 4: Real-Time URL Validation
**What:** Validate URL input on blur with debouncing; show inline errors.
**When to use:** URL input field for Ad Library URLs.
**Example:**
```typescript
// Source: React Hook Form + Zod + shadcn/ui Form
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const adLibraryUrlSchema = z.object({
  url: z
    .string()
    .min(1, "Please enter an Ad Library URL")
    .url("Please enter a valid URL")
    .refine(
      (url) => url.includes("facebook.com/ads/library"),
      "URL must be a Facebook Ad Library link"
    )
    .refine(
      (url) => url.includes("view_all_page_id="),
      "URL must include a page ID (view_all_page_id parameter)"
    ),
});

function AdLibraryForm({ onSubmit }) {
  const form = useForm({
    resolver: zodResolver(adLibraryUrlSchema),
    mode: "onBlur", // Validate on blur, not every keystroke
    defaultValues: { url: "" },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Controller
        name="url"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>Facebook Ad Library URL</FieldLabel>
            <Input
              {...field}
              placeholder="https://www.facebook.com/ads/library/?...&view_all_page_id=..."
              aria-invalid={fieldState.invalid}
            />
            {fieldState.invalid && (
              <FieldError>{fieldState.error?.message}</FieldError>
            )}
          </Field>
        )}
      />
    </form>
  );
}
```

### Pattern 5: Toast Notifications for API Errors
**What:** Non-intrusive error notifications that don't block UI.
**When to use:** API failures, network errors, transient issues.
**Example:**
```typescript
// Source: shadcn/ui Sonner docs
import { toast } from "sonner";

// In layout.tsx - add once
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}

// In component - usage
try {
  const result = await fetchWithRetry(() => fetch('/api/facebook-ads', {...}));
  // handle success
} catch (error) {
  toast.error("Failed to fetch ads", {
    description: getUserFriendlyMessage(error),
    action: {
      label: "Retry",
      onClick: () => handleRetry(),
    },
  });
}
```

### Anti-Patterns to Avoid
- **Technical error messages:** "Error: ECONNREFUSED" means nothing to users. Always translate to actionable messages.
- **Blocking spinners everywhere:** Use skeleton UI instead; it feels faster and reduces layout shift.
- **Validating on every keystroke:** Aggressive validation is annoying. Use onBlur mode.
- **No retry capability:** Users should always be able to try again without refreshing.
- **Silent failures:** Always inform users when something fails; don't swallow errors.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundaries | Class component with getDerivedStateFromError | react-error-boundary | Handles edge cases, provides resetErrorBoundary, hooks support |
| Form validation | Custom useState + regex | React Hook Form + Zod | Performance, accessibility, type safety |
| Toast notifications | Custom notification system | Sonner | Positioning, stacking, animation, accessibility |
| Loading spinners | Custom CSS animations | shadcn/ui Spinner | Consistent sizing, accessibility (role="status") |
| Retry logic | Simple setTimeout loops | Exponential backoff with jitter | Prevents thundering herd, respects server recovery |

**Key insight:** Error handling is deceptively complex. Edge cases (concurrent errors, recovery state, accessibility) are handled by established libraries.

## Common Pitfalls

### Pitfall 1: Technical Error Messages
**What goes wrong:** Showing raw error.message to users like "TypeError: Cannot read property 'data' of undefined"
**Why it happens:** Developers see errors in console and replicate in UI.
**How to avoid:** Create an error message mapper that translates known errors to user-friendly text.
**Warning signs:** Any error message containing "undefined", "null", stack traces, or HTTP codes.

```typescript
function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error) {
    // Map known errors to friendly messages
    if (error.message.includes('FACEBOOK_ACCESS_TOKEN')) {
      return 'Unable to connect to Facebook. Please try again later.';
    }
    if (error.message.includes('rate limit')) {
      return 'Too many requests. Please wait a moment and try again.';
    }
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'Network connection issue. Please check your internet and try again.';
    }
  }
  return 'Something went wrong. Please try again.';
}
```

### Pitfall 2: Skeleton Layout Mismatch
**What goes wrong:** Skeleton doesn't match actual content dimensions, causing layout shift.
**Why it happens:** Skeleton created without measuring real content.
**How to avoid:** Build skeleton after real component; match dimensions exactly.
**Warning signs:** Content "jumping" when it loads in; CLS issues.

### Pitfall 3: Missing Error Recovery
**What goes wrong:** User sees error but has no way to retry without full page refresh.
**Why it happens:** Error displayed but no action provided.
**How to avoid:** Every error display must include a retry button or clear next step.
**Warning signs:** Dead-end error states; users refreshing page frequently.

### Pitfall 4: Over-Aggressive Validation
**What goes wrong:** Error messages appear while user is still typing.
**Why it happens:** Using onChange mode instead of onBlur.
**How to avoid:** Set `mode: "onBlur"` in useForm; debounce async validation.
**Warning signs:** Error messages flickering; users can't complete input.

### Pitfall 5: Error Boundary Position
**What goes wrong:** Single error boundary wraps entire app; one error breaks everything.
**Why it happens:** Boundary placed too high in component tree.
**How to avoid:** Wrap individual sections so errors are isolated.
**Warning signs:** Entire page replaced with error UI for minor section failure.

## Code Examples

Verified patterns from official sources:

### Skeleton Component (shadcn/ui)
```typescript
// Source: https://ui.shadcn.com/docs/components/skeleton
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-[var(--bg-tertiary)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
```

### Error Boundary Setup (react-error-boundary)
```typescript
// Source: https://github.com/bvaughn/react-error-boundary
import { ErrorBoundary } from 'react-error-boundary';

function logError(error: Error, info: { componentStack: string }) {
  // Log to error reporting service
  console.error('Error caught by boundary:', error, info);
}

// Wrap sections, not entire app
<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onError={logError}
  onReset={() => {
    // Clear state that caused error
    setApiResult(null);
    setAdError(null);
  }}
  resetKeys={[adLibraryUrl]} // Reset when URL changes
>
  <DemographicsSection />
</ErrorBoundary>
```

### Form Validation with Zod (React Hook Form)
```typescript
// Source: https://ui.shadcn.com/docs/forms/react-hook-form
import { z } from "zod";

// Facebook Ad Library URL pattern
const adLibraryUrlSchema = z.object({
  url: z
    .string()
    .min(1, "URL is required")
    .url("Invalid URL format")
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return (
            parsed.hostname.includes("facebook.com") &&
            parsed.pathname.includes("/ads/library")
          );
        } catch {
          return false;
        }
      },
      { message: "Must be a Facebook Ad Library URL" }
    )
    .refine(
      (url) => url.includes("view_all_page_id="),
      { message: "URL must include a page ID" }
    ),
});
```

### Sonner Toast Usage
```typescript
// Source: https://ui.shadcn.com/docs/components/sonner
import { toast } from "sonner";

// Error toast with retry action
toast.error("Failed to analyze ads", {
  description: "The Facebook API is temporarily unavailable.",
  action: {
    label: "Try Again",
    onClick: () => handleSubmit(),
  },
});

// Success toast
toast.success("Analysis complete", {
  description: `Analyzed ${result.totalAdsFound} ads.`,
});

// Loading toast for async operations
const promise = fetchAds();
toast.promise(promise, {
  loading: "Analyzing ads...",
  success: "Analysis complete!",
  error: "Failed to analyze ads",
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn/ui Toast | Sonner | 2024 | Toast deprecated; Sonner is now default |
| Class ErrorBoundary | react-error-boundary | 2023+ | Function components; hooks support |
| Formik | React Hook Form | 2022+ | Better performance; less re-renders |
| Loading spinners only | Skeleton + spinners | 2023+ | Better perceived performance; less layout shift |

**Deprecated/outdated:**
- shadcn/ui Toast component: Deprecated in favor of Sonner
- Class-based error boundaries: Use react-error-boundary for hooks support

## Open Questions

Things that couldn't be fully resolved:

1. **Facebook API specific error codes**
   - What we know: API returns error messages in response.error
   - What's unclear: Full list of error codes and user-friendly mappings
   - Recommendation: Build error mapper incrementally as errors are encountered; log unknown errors for analysis

2. **Optimal retry count for Facebook API**
   - What we know: Standard is 3 retries with exponential backoff
   - What's unclear: Facebook's specific rate limiting behavior
   - Recommendation: Start with 3 retries, 1s base delay; adjust based on monitoring

## Sources

### Primary (HIGH confidence)
- [shadcn/ui Skeleton](https://ui.shadcn.com/docs/components/skeleton) - Installation, usage, customization
- [shadcn/ui Sonner](https://ui.shadcn.com/docs/components/sonner) - Toast notification setup and usage
- [shadcn/ui Form](https://ui.shadcn.com/docs/forms/react-hook-form) - React Hook Form integration
- [react-error-boundary GitHub](https://github.com/bvaughn/react-error-boundary) - v6.1.0 API, FallbackComponent, resetErrorBoundary

### Secondary (MEDIUM confidence)
- [Next.js Error Handling](https://nextjs.org/docs/app/getting-started/error-handling) - error.js, global-error.js patterns
- [Exponential Backoff Best Practices](https://dev.to/abhivyaktii/retrying-failed-requests-with-exponential-backoff-48ld) - Jitter, retry logic
- [React Hook Form + Zod](https://www.contentful.com/blog/react-hook-form-validation-zod/) - Validation setup

### Tertiary (LOW confidence)
- WebSearch: "Facebook Ad Library URL format validation" - Pattern observed from existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official shadcn/ui docs, react-error-boundary GitHub
- Architecture: HIGH - Patterns match existing codebase style; shadcn/ui official examples
- Pitfalls: MEDIUM - Based on general React best practices; needs validation with this specific API

**Research date:** 2026-01-25
**Valid until:** 30 days (stable libraries; shadcn/ui changes rarely)
