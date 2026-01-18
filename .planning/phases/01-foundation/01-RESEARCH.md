# Phase 1: Foundation - Research

**Researched:** 2026-01-18
**Domain:** Browser automation anti-detection (puppeteer-core to rebrowser-puppeteer-core migration)
**Confidence:** HIGH

## Summary

This research addresses the migration from `puppeteer-core` to `rebrowser-puppeteer-core` for anti-detection capabilities. The existing scraper uses puppeteer-core 24.35.0 with @sparticuz/chromium-min for serverless deployment on Vercel.

**Key finding:** rebrowser-puppeteer-core is a true drop-in replacement requiring minimal code changes. However, the pre-built package version (24.8.1) lags behind the current puppeteer-core (24.35.0). Two migration paths exist: (1) use the older rebrowser version, or (2) manually patch the newer puppeteer-core.

**Primary recommendation:** Use npm aliasing to swap packages without code changes. Downgrade to version 24.8.1 for simplicity, as there are no breaking API changes between 24.8 and 24.35.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rebrowser-puppeteer-core | 24.8.1 | Drop-in puppeteer-core replacement with anti-detection patches | Fixes Runtime.Enable CDP leak that triggers Cloudflare/DataDome detection |
| @sparticuz/chromium-min | ^143.0.4 | Serverless Chromium binary | Already in use; remains compatible with rebrowser |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| rebrowser-patches | latest | Manual patching tool | Only if you need latest puppeteer-core (24.35) with anti-detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rebrowser-puppeteer-core | Manual patching via npx rebrowser-patches | More complexity but allows using latest puppeteer version |
| rebrowser-puppeteer-core | puppeteer-real-browser | More comprehensive anti-detection but requires xvfb on Linux, more complex setup |
| rebrowser-puppeteer-core | puppeteer-extra-plugin-stealth | AVOID: Discontinued Feb 2025, actively detected by Cloudflare/DataDome |

**Installation (Recommended - npm aliasing):**
```bash
# In package.json, change:
#   "puppeteer-core": "^24.35.0"
# To:
#   "puppeteer-core": "npm:rebrowser-puppeteer-core@^24.8.1"

npm install
```

**Alternative (direct package replacement):**
```bash
npm uninstall puppeteer-core
npm install rebrowser-puppeteer-core@24.8.1
# Then update import statements in code
```

## Architecture Patterns

### Recommended Approach: npm Aliasing (Zero Code Changes)

**What:** Use npm's aliasing feature to substitute rebrowser-puppeteer-core for puppeteer-core at the package level.

**When to use:** When you want a drop-in replacement with no source code modifications.

**Example package.json:**
```json
{
  "dependencies": {
    "puppeteer-core": "npm:rebrowser-puppeteer-core@^24.8.1",
    "@sparticuz/chromium-min": "^143.0.4"
  }
}
```

**Result:** All existing code continues to work without modification:
```typescript
// This import continues to work unchanged
import puppeteer, { Browser, HTTPResponse } from 'puppeteer-core';
```

### Alternative Approach: Direct Package Replacement

**What:** Replace the package name in code and package.json.

**When to use:** When you want explicit clarity about which package is being used.

**Example:**
```typescript
// Change from:
import puppeteer, { Browser, HTTPResponse } from 'puppeteer-core';

// To:
import puppeteer, { Browser, HTTPResponse } from 'rebrowser-puppeteer-core';
```

### Anti-Patterns to Avoid
- **Using puppeteer-extra-plugin-stealth:** Discontinued Feb 2025, actively detected
- **Applying manual patches without post-install hook:** Patches get overwritten on npm install
- **Mixing rebrowser package with puppeteer-extra:** Requires special addExtra() integration, adds complexity

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Anti-detection stealth | Custom user-agent rotation, custom timing | rebrowser-puppeteer-core | Fixes CDP-level leaks that surface-level approaches can't address |
| Runtime.Enable CDP leak | Custom CDP command interception | rebrowser-patches | This specific leak is detected by Cloudflare/DataDome; requires deep puppeteer patching |

**Key insight:** Detection happens at the CDP (Chrome DevTools Protocol) level, not just browser fingerprinting. Surface-level evasion (user-agents, delays) is insufficient against modern anti-bot systems.

## Common Pitfalls

### Pitfall 1: Version Mismatch After npm Install
**What goes wrong:** Running `npm install` after adding new dependencies overwrites rebrowser patches if using manual patching.
**Why it happens:** npm reinstalls packages, reverting any post-install patches.
**How to avoid:** Use npm aliasing (recommended) OR add postinstall script to reapply patches.
**Warning signs:** Scraper suddenly gets blocked after dependency updates.

### Pitfall 2: Expecting Bulletproof Anti-Detection
**What goes wrong:** Assuming rebrowser alone makes the scraper undetectable.
**Why it happens:** rebrowser-patches only fix the Runtime.Enable leak. Other detection vectors remain.
**How to avoid:** Combine with:
  - Proper user-agent rotation
  - Random delays between actions
  - Realistic viewport sizes
  - Request rate limiting
**Warning signs:** CAPTCHAs appearing despite using rebrowser.

### Pitfall 3: page.pause() Not Working
**What goes wrong:** Debugging with page.pause() fails silently.
**Why it happens:** The runtime fix in rebrowser conflicts with page.pause().
**How to avoid:** Set `REBROWSER_PATCHES_RUNTIME_FIX_MODE=0` when debugging.
**Warning signs:** Debugger doesn't pause as expected.

### Pitfall 4: TypeScript Import Types
**What goes wrong:** TypeScript types not resolving when using npm aliasing.
**Why it happens:** Type definitions may not be properly aliased.
**How to avoid:** If using aliasing, types should work automatically since rebrowser maintains same API. If issues occur, ensure @types are not conflicting.
**Warning signs:** TypeScript compilation errors about missing types.

## Code Examples

Verified patterns from official sources:

### Current Code (No Changes Needed with npm Aliasing)
```typescript
// Source: Existing src/lib/ad-library-scraper.ts
// This code works unchanged with rebrowser after npm aliasing

import puppeteer, { Browser, HTTPResponse } from 'puppeteer-core';
import chromium from '@sparticuz/chromium-min';

// Existing launch code works as-is
browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: { width: 1920, height: 1080 },
  executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
  headless: true,
});
```

### Environment Variable Configuration (Optional)
```typescript
// Source: https://github.com/rebrowser/rebrowser-patches

// Control patch behavior via environment variables
// These are OPTIONAL - defaults work for most cases

// Runtime fix modes:
// - 'addBinding' (default): Creates bindings without Runtime.Enable
// - 'alwaysIsolated': Uses isolated execution contexts
// - '0': Disable patches (for debugging)
process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE = 'addBinding';

// Enable debug output
process.env.REBROWSER_PATCHES_DEBUG = '1';
```

### Verifying Patches Are Working
```typescript
// After migration, verify anti-detection with rebrowser-bot-detector
// Visit: https://bot.rebrowser.net in your automated browser
// Should pass all tests if patches are working
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| puppeteer-extra-plugin-stealth | rebrowser-puppeteer-core | Feb 2025 | stealth plugin discontinued, actively detected |
| Surface-level fingerprint evasion | CDP-level patching | 2024-2025 | Detection moved to protocol level |
| puppeteer 23.x | puppeteer 24.x | 2025 | No breaking changes for this use case |

**Deprecated/outdated:**
- **puppeteer-extra-plugin-stealth:** Discontinued Feb 2025, Cloudflare has specific signatures for it
- **Manual user-agent spoofing alone:** Insufficient against modern anti-bot systems

## Open Questions

Things that couldn't be fully resolved:

1. **Version Currency**
   - What we know: rebrowser-puppeteer-core latest is 24.8.1, while puppeteer-core is at 24.35.0
   - What's unclear: Whether there are any bugs in 24.8.1 fixed in later versions that affect this use case
   - Recommendation: Use 24.8.1 for now; no breaking API changes in the 24.x series

2. **@sparticuz/chromium-min Compatibility**
   - What we know: @sparticuz/chromium-min works with standard puppeteer-core
   - What's unclear: No explicit documentation confirming rebrowser compatibility
   - Recommendation: Should work since rebrowser is a drop-in replacement; verify in testing

3. **Long-term Maintenance**
   - What we know: rebrowser-patches is actively maintained (commits through 2025)
   - What's unclear: How quickly rebrowser tracks new puppeteer releases
   - Recommendation: Current 8-month lag is acceptable; monitor for updates

## Sources

### Primary (HIGH confidence)
- [rebrowser-puppeteer-core GitHub](https://github.com/rebrowser/rebrowser-puppeteer-core) - Drop-in replacement documentation
- [rebrowser-patches GitHub](https://github.com/rebrowser/rebrowser-patches) - Patching mechanism, environment variables, Runtime.Enable fix details
- [Puppeteer Changelog](https://pptr.dev/CHANGELOG) - Version differences 24.8-24.35

### Secondary (MEDIUM confidence)
- [DeepWiki: rebrowser-puppeteer-core](https://deepwiki.com/rebrowser/rebrowser-puppeteer-core) - Architecture and migration guide
- [Rebrowser Documentation](https://rebrowser.net/docs/patches-for-puppeteer-and-playwright) - Official patching documentation

### Tertiary (LOW confidence)
- [BrightData: Puppeteer Real Browser Guide](https://brightdata.com/blog/web-data/puppeteer-real-browser) - Alternative approaches
- [ZenRows: Bypass Bot Detection 2026](https://www.zenrows.com/blog/bypass-bot-detection) - General anti-detection landscape

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - rebrowser is well-documented drop-in replacement
- Architecture: HIGH - npm aliasing is standard npm feature, no code changes needed
- Pitfalls: MEDIUM - Based on GitHub issues and community reports

**Research date:** 2026-01-18
**Valid until:** 2026-02-18 (30 days - stable library, slow-moving)

---

## Migration Checklist

For the planner, the concrete steps are:

1. **Update package.json** - Change puppeteer-core dependency to use npm aliasing
2. **Run npm install** - Install the aliased package
3. **Test locally** - Verify scraper still works
4. **Test anti-detection** - Visit https://bot.rebrowser.net to verify patches
5. **Deploy to Vercel** - Confirm serverless deployment works
6. **Validate scraping** - Run against Facebook Ad Library, confirm no blocking

**Estimated effort:** ~30 minutes implementation, ~1 hour testing

**Risk level:** LOW - Drop-in replacement with no code changes required
