# Phase 33: Benchmark Foundation - Research

**Researched:** 2026-02-06
**Domain:** Multi-brand batch analysis, rate limiting, persistent entities
**Confidence:** HIGH

## Summary

Phase 33 implements the foundation for benchmark reports, allowing users to create reports comparing up to 5 competitor ad library pages against one baseline brand. The core challenges are (1) multi-brand selection UI with baseline designation, (2) batch-fetching multiple pages with rate limit management, and (3) persisting benchmark reports as database entities.

The research confirms that **zero new npm dependencies are needed**. The existing codebase has all required patterns: `fetchWithRetry` for resilient API calls, `Promise.all` with sequential batching for rate-limited parallel fetching (already used in `facebook-api.ts` for multi-country queries), and Prisma transaction patterns for atomic entity creation. The UI can extend the existing `BrandSelector` pattern to support multi-select with a baseline toggle.

The recommended approach is to create a new `BenchmarkReport` model with a `BenchmarkBrand` join table (similar to `IndustryBrand` in the v4.5 research), implement a batch-fetch endpoint with sequential batching (3 pages at a time with delays), and build a benchmark creation flow that saves the report atomically with all brand snapshots.

**Primary recommendation:** Build the data model first, then the batch-fetch API with rate limiting, then the multi-select UI with baseline designation, finally the save/persist flow.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 6.3.1 | Database ORM | Already used for all entities |
| Next.js API Routes | 15.1.x | API endpoints | Project standard |
| React | 19.x | Component framework | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fetchWithRetry | (internal) | Resilient API calls | Wrap each page fetch |
| Tailwind CSS | 4.x | Styling multi-select | Project standard |
| Recharts | 3.6.0 | Benchmark charts (Phase 34) | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom multi-select | react-select | react-select adds 30KB; custom checkbox list sufficient for 5 items |
| Sequential batching | Promise.all all at once | Risk rate limit errors; batching is safer |
| Separate snapshot per brand | Embedded JSON | Separate records enable future re-analysis per brand |

**Installation:**
```bash
# No new installations needed - all patterns already present
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
└── schema.prisma              # Add BenchmarkReport, BenchmarkBrand models

src/
├── lib/
│   └── batch-fetch.ts         # NEW: Batch fetch multiple pages with rate limiting
├── app/api/benchmarks/
│   ├── route.ts               # POST to create, GET to list
│   └── [id]/
│       └── route.ts           # GET single, DELETE
└── components/benchmark/
    ├── benchmark-brand-selector.tsx  # NEW: Multi-select with baseline toggle
    └── benchmark-create-flow.tsx     # NEW: Multi-step creation wizard
```

### Pattern 1: Benchmark Data Model
**What:** Database schema for benchmark reports with brand relationships
**When to use:** Storing benchmark report entities
**Example:**
```prisma
// Source: Adapted from v4.5-industry-benchmarks-research.md
model BenchmarkReport {
  id          String   @id @default(cuid())
  name        String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Owner
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Brands in this benchmark (1 baseline + up to 5 competitors)
  brands      BenchmarkBrand[]
}

model BenchmarkBrand {
  id              String   @id @default(cuid())
  facebookPageId  String
  pageName        String
  adLibraryUrl    String
  isBaseline      Boolean  @default(false)  // Exactly one per report
  addedAt         DateTime @default(now())

  // Snapshot data at time of benchmark creation
  snapshotJson    Json?    // Full demographic snapshot

  // Relations
  benchmarkId     String
  benchmark       BenchmarkReport @relation(fields: [benchmarkId], references: [id], onDelete: Cascade)

  @@unique([benchmarkId, facebookPageId])
}
```

### Pattern 2: Sequential Batch Fetching with Rate Limiting
**What:** Fetch multiple pages in batches with delays between batches
**When to use:** Batch-analyzing 2-6 pages for a benchmark
**Example:**
```typescript
// Source: Adapted from facebook-api.ts lines 643-675
interface BatchFetchResult {
  pageId: string;
  pageName: string;
  success: boolean;
  data?: FacebookApiResult;
  error?: string;
}

export async function batchFetchPages(
  urls: string[],
  options: { delayBetweenBatches?: number; batchSize?: number } = {}
): Promise<BatchFetchResult[]> {
  const { delayBetweenBatches = 2000, batchSize = 2 } = options;
  const results: BatchFetchResult[] = [];

  // Process in batches of 2 to stay well under rate limits
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const pageId = extractPageIdFromUrl(url);
        if (!pageId) throw new Error(`Invalid URL: ${url}`);

        return fetchWithRetry(
          () => fetchAdsByPageUrl(url, process.env.FACEBOOK_ACCESS_TOKEN!, {
            countries: EU_COUNTRIES,
            limit: 500,  // Pro tier depth
          }),
          { maxRetries: 2, baseDelay: 2000 }
        );
      })
    );

    // Map results
    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const url = batch[j];
      const pageId = extractPageIdFromUrl(url) || '';

      if (result.status === 'fulfilled' && result.value.success) {
        results.push({
          pageId,
          pageName: result.value.pageName || '',
          success: true,
          data: result.value,
        });
      } else {
        results.push({
          pageId,
          pageName: '',
          success: false,
          error: result.status === 'rejected'
            ? result.reason.message
            : (result.value as FacebookApiError).error,
        });
      }
    }

    // Delay before next batch (except for last batch)
    if (i + batchSize < urls.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}
```

### Pattern 3: Multi-Select with Baseline Toggle
**What:** UI for selecting multiple brands with one designated as baseline
**When to use:** Benchmark creation form
**Example:**
```typescript
// Source: Adapted from brand-selector.tsx
interface BrandEntry {
  url: string;
  isBaseline: boolean;
  status: 'pending' | 'fetching' | 'success' | 'error';
  pageName?: string;
  error?: string;
}

function BenchmarkBrandSelector({
  entries,
  onAdd,
  onRemove,
  onSetBaseline,
  maxBrands = 6,  // 1 baseline + 5 competitors
}: {
  entries: BrandEntry[];
  onAdd: (url: string) => void;
  onRemove: (index: number) => void;
  onSetBaseline: (index: number) => void;
  maxBrands?: number;
}) {
  const [inputUrl, setInputUrl] = useState('');

  const handleAdd = () => {
    if (inputUrl && entries.length < maxBrands) {
      onAdd(inputUrl);
      setInputUrl('');
    }
  };

  return (
    <div className="space-y-4">
      {/* Input for adding new URL */}
      <div className="flex gap-2">
        <input
          type="url"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          placeholder="Paste Ad Library URL..."
          className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg px-3 py-2"
          disabled={entries.length >= maxBrands}
        />
        <button
          onClick={handleAdd}
          disabled={!inputUrl || entries.length >= maxBrands}
          className="px-4 py-2 bg-[var(--accent-green)] text-white rounded-lg disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {/* List of added brands */}
      <div className="space-y-2">
        {entries.map((entry, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              entry.isBaseline
                ? 'border-[var(--accent-green)] bg-[var(--accent-green)]/10'
                : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'
            }`}
          >
            <button
              onClick={() => onSetBaseline(idx)}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                entry.isBaseline
                  ? 'border-[var(--accent-green)] bg-[var(--accent-green)]'
                  : 'border-[var(--border-subtle)]'
              }`}
              title="Set as baseline"
            >
              {entry.isBaseline && <Check className="w-3 h-3 text-white" />}
            </button>
            <span className="flex-1 text-sm truncate">
              {entry.pageName || entry.url}
            </span>
            <StatusIndicator status={entry.status} error={entry.error} />
            <button onClick={() => onRemove(idx)} className="text-red-400 hover:text-red-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-[var(--text-muted)] text-center py-4">
          Add at least 2 brands to create a benchmark (1 baseline + 1 competitor)
        </p>
      )}
    </div>
  );
}
```

### Pattern 4: Atomic Benchmark Creation
**What:** Create benchmark report with all brands in a single transaction
**When to use:** Saving benchmark after successful batch fetch
**Example:**
```typescript
// Source: Adapted from brands/save/route.ts
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, brands } = await req.json() as {
    name: string;
    brands: Array<{
      facebookPageId: string;
      pageName: string;
      adLibraryUrl: string;
      isBaseline: boolean;
      snapshotData: Record<string, unknown>;
    }>;
  };

  // Validate: exactly one baseline
  const baselineCount = brands.filter(b => b.isBaseline).length;
  if (baselineCount !== 1) {
    return NextResponse.json(
      { error: 'Exactly one brand must be designated as baseline' },
      { status: 400 }
    );
  }

  // Create in transaction
  const report = await prisma.$transaction(async (tx) => {
    const newReport = await tx.benchmarkReport.create({
      data: {
        name,
        userId: session.user!.id!,
      },
    });

    await tx.benchmarkBrand.createMany({
      data: brands.map(b => ({
        facebookPageId: b.facebookPageId,
        pageName: b.pageName,
        adLibraryUrl: b.adLibraryUrl,
        isBaseline: b.isBaseline,
        snapshotJson: b.snapshotData,
        benchmarkId: newReport.id,
      })),
    });

    return newReport;
  });

  return NextResponse.json({ report });
}
```

### Anti-Patterns to Avoid
- **Fetching all pages in parallel without delays:** Will trigger rate limit errors (HTTP 429). Use sequential batching with 2-second delays.
- **Storing raw ad data per brand:** Storage bloat. Store aggregated snapshot only (like BrandSnapshot).
- **Allowing more than one baseline:** Validation must enforce exactly one baseline per report.
- **Blocking UI during batch fetch:** Use progress indicator showing "Fetching brand 2/5...".

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Retry with backoff | Manual setTimeout loops | `fetchWithRetry` from `lib/retry.ts` | Handles jitter, exponential backoff correctly |
| Rate limiting | Custom token bucket | Sequential batching (2 at a time, 2s delay) | Simple, matches existing facebook-api.ts pattern |
| Multi-select state | Complex useState array | Simple `BrandEntry[]` with add/remove/setBaseline | 6 items max; no need for complex state management |
| Snapshot building | Manual field extraction | `buildSnapshotFromApiResult` from `lib/snapshot-builder.ts` | Already handles all edge cases |
| Transaction rollback | Manual cleanup on failure | Prisma `$transaction` | Automatic rollback on any error |

**Key insight:** The existing codebase already has batch-processing patterns (facebook-api.ts multi-country fetching) and atomic creation patterns (brands/save transaction). Reuse these patterns.

## Common Pitfalls

### Pitfall 1: Rate Limit Errors During Batch Fetch
**What goes wrong:** Fetching 5 pages simultaneously triggers Facebook API rate limiting (HTTP 429).
**Why it happens:** Facebook enforces ~200 calls/user/hour with per-minute burst limits.
**How to avoid:**
1. Fetch in batches of 2 pages at a time
2. Add 2-second delay between batches
3. Wrap each fetch in `fetchWithRetry` with exponential backoff
4. Use `Promise.allSettled` to continue even if one page fails
**Warning signs:** HTTP 429 responses; `X-App-Usage` header showing >80% utilization.

### Pitfall 2: No Baseline Designated
**What goes wrong:** User saves benchmark without selecting a baseline brand.
**Why it happens:** UI allows saving without validation; API accepts the request.
**How to avoid:**
1. Default first added brand as baseline
2. Disable "Create Benchmark" button until baseline is selected
3. Server-side validation: reject if baseline count !== 1
**Warning signs:** Phase 34 aggregation fails because no baseline exists.

### Pitfall 3: Partial Fetch Failure
**What goes wrong:** 3 of 5 pages fetch successfully, 2 fail; user loses all progress.
**Why it happens:** Using `Promise.all` instead of `Promise.allSettled`; not showing partial results.
**How to avoid:**
1. Use `Promise.allSettled` to capture all results
2. Show partial results with error indicators for failed pages
3. Allow saving benchmark with only successful pages (minimum 2)
4. Store error message per failed brand for debugging
**Warning signs:** User sees "failed" toast with no detail on which pages failed.

### Pitfall 4: Large Snapshot JSON Bloat
**What goes wrong:** Storing full `rawAdBodies` or `ads` array in `snapshotJson` causes massive database rows.
**Why it happens:** Passing entire API result instead of aggregated snapshot.
**How to avoid:**
1. Use `buildSnapshotFromApiResult` to extract only aggregated data
2. Store ~50 fields max, not raw ad arrays
3. Verify payload size before insert (<100KB per brand)
**Warning signs:** Database file grows rapidly; slow benchmark list queries.

### Pitfall 5: Duplicate Page ID in Same Benchmark
**What goes wrong:** User adds same page URL twice (perhaps with different query params).
**Why it happens:** URL strings differ but extract to same pageId.
**How to avoid:**
1. Extract `pageId` on add and check for duplicates
2. Database constraint: `@@unique([benchmarkId, facebookPageId])`
3. Show user-friendly error: "This page is already in the benchmark"
**Warning signs:** Prisma unique constraint violation error.

## Code Examples

Verified patterns from official sources and existing codebase:

### Prisma Schema for Benchmark Entities
```prisma
// Source: Derived from existing TrackedBrand + BrandSnapshot pattern
model BenchmarkReport {
  id          String   @id @default(cuid())
  name        String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  brands      BenchmarkBrand[]
}

model BenchmarkBrand {
  id              String   @id @default(cuid())
  facebookPageId  String
  pageName        String
  adLibraryUrl    String
  isBaseline      Boolean  @default(false)
  addedAt         DateTime @default(now())

  // Aggregated snapshot data
  totalAdsFound     Int?
  activeAdsCount    Int?
  totalReach        BigInt?
  avgReachPerAd     Float?
  estimatedSpendUsd Float?
  videoPercentage   Float?
  imagePercentage   Float?
  carouselPercentage Float?
  dominantGender    String?
  dominantAgeRange  String?
  demographicsJson  Json?

  benchmarkId     String
  benchmark       BenchmarkReport @relation(fields: [benchmarkId], references: [id], onDelete: Cascade)

  @@unique([benchmarkId, facebookPageId])
  @@index([benchmarkId])
}
```

### Batch Fetch API Endpoint
```typescript
// Source: Pattern from facebook-api.ts multi-country fetching
// POST /api/benchmarks/batch-fetch
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { urls } = await req.json();

  if (!Array.isArray(urls) || urls.length < 2 || urls.length > 6) {
    return NextResponse.json(
      { error: 'Must provide 2-6 Ad Library URLs' },
      { status: 400 }
    );
  }

  const results = await batchFetchPages(urls, {
    batchSize: 2,
    delayBetweenBatches: 2000,
  });

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return NextResponse.json({
    results,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
    },
  });
}
```

### Progress Indicator During Fetch
```typescript
// Source: Pattern from existing loading states
function FetchProgress({
  total,
  completed,
  current,
}: {
  total: number;
  completed: number;
  current: string | null;
}) {
  return (
    <div className="glass rounded-2xl p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-[var(--accent-green)] border-t-transparent animate-spin" />
      <p className="text-[var(--text-primary)] font-medium mb-2">
        Analyzing brands...
      </p>
      <p className="text-sm text-[var(--text-muted)]">
        {completed} of {total} complete
        {current && <span className="block mt-1">Currently: {current}</span>}
      </p>
      <div className="mt-4 w-full bg-[var(--bg-tertiary)] rounded-full h-2">
        <div
          className="bg-[var(--accent-green)] h-2 rounded-full transition-all"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Promise.all for batch requests | Promise.allSettled with error handling | ES2020 | Partial success handling |
| Fixed retry delays | Exponential backoff with jitter | Best practice | Prevents thundering herd |
| Single API call for all pages | Sequential batching with delays | 2024 rate limit changes | Reliable under load |
| Inline snapshot building | Shared `buildSnapshotFromApiResult` | v3.0 | DRY, consistent snapshots |

**Deprecated/outdated:**
- Fetching all pages in parallel without delays (triggers rate limits)
- Storing raw ad arrays in snapshots (storage bloat)
- Using Promise.all without error handling per item (all-or-nothing failures)

## Open Questions

Things that couldn't be fully resolved:

1. **Benchmark report naming**
   - What we know: Reports need a name for the dashboard list
   - What's unclear: Auto-generate from baseline brand name, or require user input?
   - Recommendation: Default to "Benchmark: {baseline.pageName}" with optional user override

2. **Minimum brands for valid benchmark**
   - What we know: Need at least 1 baseline + 1 competitor
   - What's unclear: If one competitor fails to fetch, can we still save with 1+1?
   - Recommendation: Yes, allow saving with minimum 2 successfully fetched brands

3. **Re-fetch individual failed brand**
   - What we know: Some brands may fail due to transient errors
   - What's unclear: Should there be a "retry this brand" button?
   - Recommendation: Defer to Phase 34 or v4.1; for now, just show error and allow proceeding without it

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/lib/facebook-api.ts` (batch fetching pattern, lines 643-675)
- Codebase analysis: `src/lib/retry.ts` (exponential backoff)
- Codebase analysis: `src/lib/snapshot-builder.ts` (snapshot extraction)
- Codebase analysis: `src/app/api/brands/save/route.ts` (transaction pattern)
- Codebase analysis: `prisma/schema.prisma` (entity patterns)
- `.planning/v4.5-industry-benchmarks-research.md` (data model reference)

### Secondary (MEDIUM confidence)
- [Facebook Ads Library API Guide](https://admanage.ai/blog/facebook-ads-library-api) - Rate limit patterns
- [Facebook API Rate Limits](https://moldstud.com/articles/p-understanding-facebook-api-rate-limits-how-to-manage-usage-for-your-applications) - 200 calls/hour limit
- [Headless UI Select](https://headlessui.com/react/listbox) - Multi-select patterns

### Tertiary (LOW confidence)
- General web search for "batch request best practices 2025"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all patterns verified in existing codebase
- Architecture: HIGH - Follows established patterns from brands/save and facebook-api.ts
- Pitfalls: HIGH - Rate limiting well-documented; batch patterns proven in codebase
- Data model: HIGH - Derived from existing TrackedBrand/BrandSnapshot + v4.5 research

**Research date:** 2026-02-06
**Valid until:** 2026-03-06 (30 days - stable domain)
