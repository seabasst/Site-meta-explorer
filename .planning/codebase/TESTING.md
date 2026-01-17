# Testing Patterns

**Analysis Date:** 2025-01-18

## Test Framework

**Runner:**
- Not configured - no test framework detected

**Assertion Library:**
- Not configured

**Run Commands:**
```bash
# No test scripts defined in package.json
npm run lint  # Only linting available
```

## Test File Organization

**Location:**
- No test files exist in the project
- No `__tests__` directories
- No `.test.ts` or `.spec.ts` files in `src/`

**Naming:**
- Not established

**Structure:**
- Not established

## Test Structure

**Suite Organization:**
- Not established

**Patterns:**
- Not established

## Mocking

**Framework:** Not configured

**Patterns:**
- Not established

**What to Mock (Recommended):**
- External HTTP requests (`fetch` calls for sitemaps)
- Puppeteer browser operations for ad scraping
- Next.js request/response objects for API routes

**What NOT to Mock (Recommended):**
- URL parsing logic
- Classification logic
- Data transformation utilities

## Fixtures and Factories

**Test Data:**
- Not established

**Location:**
- Not established

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Not configured
```

## Test Types

**Unit Tests:**
- Not implemented
- Recommended candidates:
  - `src/lib/url-classifier.ts` - pure functions, highly testable
  - `src/lib/sitemap-parser.ts` - XML parsing logic
  - URL validation in `src/actions/analyze-sitemap.ts`

**Integration Tests:**
- Not implemented
- Recommended candidates:
  - Server action flow (URL -> sitemap fetch -> classification)
  - API route `/api/scrape-ads`

**E2E Tests:**
- Not implemented
- Framework recommendation: Playwright (Next.js compatible)

## Common Patterns

**Async Testing:**
- Not established

**Error Testing:**
- Not established

## Recommended Test Setup

**Framework Suggestions:**
1. **Vitest** - Fast, ESM-native, works well with TypeScript/React
2. **Jest** - More established, wider ecosystem

**Minimal Setup for Vitest:**
```bash
npm install -D vitest @testing-library/react @testing-library/dom jsdom
```

**Recommended `vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Priority Test Files to Create:**

1. `src/lib/url-classifier.test.ts` - Classification logic
```typescript
import { describe, it, expect } from 'vitest';
import { classifyURLs, URLCategory } from './url-classifier';

describe('classifyURLs', () => {
  it('classifies product URLs correctly', () => {
    const urls = [{ loc: 'https://example.com/products/shoe-123' }];
    const result = classifyURLs(urls);
    expect(result.urls[0].category).toBe('product');
  });

  it('classifies landing pages correctly', () => {
    const urls = [{ loc: 'https://example.com/pages/about' }];
    const result = classifyURLs(urls);
    expect(result.urls[0].category).toBe('landing');
  });
});
```

2. `src/lib/sitemap-parser.test.ts` - XML parsing
```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchAllSitemapURLs } from './sitemap-parser';

describe('fetchAllSitemapURLs', () => {
  it('parses sitemap XML correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`
        <?xml version="1.0"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>https://example.com/page1</loc></url>
        </urlset>
      `),
    });

    const urls = await fetchAllSitemapURLs('https://example.com');
    expect(urls).toHaveLength(1);
    expect(urls[0].loc).toBe('https://example.com/page1');
  });
});
```

3. `src/actions/analyze-sitemap.test.ts` - Server action
```typescript
import { describe, it, expect, vi } from 'vitest';
import { analyzeSitemap } from './analyze-sitemap';

describe('analyzeSitemap', () => {
  it('returns error for invalid URL', async () => {
    const result = await analyzeSitemap('not-a-url');
    expect(result.success).toBe(false);
  });
});
```

## Package.json Scripts to Add

```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

*Testing analysis: 2025-01-18*
