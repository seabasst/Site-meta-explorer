# Technology Stack

**Analysis Date:** 2026-01-18

## Languages

**Primary:**
- TypeScript ^5 - All source code (`src/**/*.ts`, `src/**/*.tsx`)

**Secondary:**
- CSS - Styling via Tailwind (`src/app/globals.css`)

## Runtime

**Environment:**
- Node.js (version not pinned, no `.nvmrc`)
- Next.js 16.1.2 with App Router

**Package Manager:**
- npm
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.2 - Full-stack React framework with App Router
- React 19.2.3 - UI components
- React DOM 19.2.3 - DOM rendering

**Styling:**
- Tailwind CSS ^4 - Utility-first CSS framework
- PostCSS with `@tailwindcss/postcss` plugin

**Build/Dev:**
- TypeScript ^5 - Type checking
- ESLint ^9 - Linting with `eslint-config-next`

## Key Dependencies

**Critical:**
- `puppeteer` ^24.35.0 - Full Puppeteer for local development
- `puppeteer-core` ^24.35.0 - Headless browser automation for Facebook Ad Library scraping
- `@sparticuz/chromium-min` ^143.0.4 - Serverless-compatible Chromium binary

**Infrastructure:**
- `next` 16.1.2 - Server-side rendering, API routes, server actions

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Target: ES2017
- Module: ESNext with bundler resolution
- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`

**ESLint:**
- Config: `eslint.config.mjs` (flat config format)
- Extends: `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts`

**PostCSS:**
- Config: `postcss.config.mjs`
- Plugin: `@tailwindcss/postcss`

**Next.js:**
- Config: `next.config.ts`
- Currently empty (default settings)

**Environment:**
- No `.env` files detected
- Uses `process.env.NODE_ENV` for production/development detection
- Chromium binary downloaded at runtime from GitHub releases

## Platform Requirements

**Development:**
- Node.js (LTS recommended)
- npm for package management
- Puppeteer requires local Chromium installation (auto-downloads)

**Production:**
- Vercel (configured via `.vercel/project.json`)
- Project: `sitemap-analyzer` (ID: `prj_gxwdcFTMCyKDywwarVfjpl0TPdfA`)
- Serverless functions with 60-second timeout (requires Vercel Pro for Ad Library scraping)
- Chromium binary downloaded from Sparticuz releases at runtime

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

*Stack analysis: 2026-01-18*
