# Phase 10: Auth Foundation - Research

**Researched:** 2026-01-26
**Domain:** OAuth Authentication with Google/GitHub for Next.js 16
**Confidence:** HIGH

## Summary

This phase implements OAuth authentication using Auth.js v5 (formerly NextAuth.js) with Google and GitHub providers. Auth.js is the de facto standard for Next.js authentication, supporting 80+ OAuth providers with built-in security features including CSRF protection, state validation, and secure cookie handling.

The implementation uses JWT session strategy (no database required for v2.0 MVP), which is simpler to deploy and sufficient for social OAuth-only authentication. The architecture leverages Next.js App Router patterns with server-side session access via `auth()` and client-side access via `SessionProvider` + `useSession` hook.

**Primary recommendation:** Use Auth.js v5 beta (`next-auth@beta`) with JWT sessions, Google/GitHub providers, and a hybrid server/client pattern where Server Components use `auth()` and Client Components use `useSession` wrapped in `SessionProvider`.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | @beta (v5.x) | Authentication framework | Official Next.js auth solution, 80+ providers, App Router native |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @auth/prisma-adapter | latest | Database persistence | Phase 11+ when storing user subscription data |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js | Clerk | Managed service, costs money, less control |
| Auth.js | Auth0 | Enterprise-grade but complex setup, free tier limited |
| Auth.js | Supabase Auth | Good if using Supabase DB, otherwise adds dependency |

**Installation:**
```bash
npm install next-auth@beta
```

**Note:** The `@beta` tag installs Auth.js v5 which is compatible with Next.js 15+ and App Router. Despite "beta" label, it is stable and recommended for production use with Next.js 15/16.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── auth.ts                          # Main Auth.js configuration (root level)
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts         # Auth API route handler
│   ├── layout.tsx                   # Wrap with SessionProvider
│   └── (authenticated)/             # Protected route group (optional)
├── components/
│   ├── auth/
│   │   ├── sign-in-button.tsx       # OAuth sign-in buttons
│   │   ├── sign-out-button.tsx      # Sign-out button
│   │   └── user-menu.tsx            # Avatar + dropdown menu
│   └── providers/
│       └── session-provider.tsx     # Client-side SessionProvider wrapper
└── middleware.ts                    # Optional: session refresh middleware
```

### Pattern 1: Auth Configuration (auth.ts)
**What:** Central authentication configuration at project root
**When to use:** Always - this is the entry point for Auth.js
**Example:**
```typescript
// src/auth.ts
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google, GitHub],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
})
```

### Pattern 2: Route Handler Setup
**What:** API route that handles OAuth callbacks and session management
**When to use:** Required - Auth.js needs this endpoint
**Example:**
```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

### Pattern 3: Session Access in Server Components
**What:** Direct session access using `auth()` function
**When to use:** Any Server Component that needs user data
**Example:**
```typescript
// Source: https://authjs.dev/getting-started/session-management/get-session
import { auth } from "@/auth"

export default async function UserAvatar() {
  const session = await auth()

  if (!session?.user) return null

  return <img src={session.user.image} alt="User avatar" />
}
```

### Pattern 4: SessionProvider for Client Components
**What:** React Context provider enabling `useSession` hook
**When to use:** When client components need reactive session state
**Example:**
```typescript
// src/components/providers/session-provider.tsx
"use client"
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}

// src/app/layout.tsx
import { SessionProvider } from "@/components/providers/session-provider"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

### Pattern 5: Client-Side Sign In/Out
**What:** OAuth buttons using client-side signIn/signOut functions
**When to use:** Interactive sign-in buttons in client components
**Example:**
```typescript
// src/components/auth/sign-in-button.tsx
"use client"
import { signIn } from "next-auth/react"

export function SignInButton({ provider }: { provider: "google" | "github" }) {
  return (
    <button onClick={() => signIn(provider, { redirectTo: "/" })}>
      Sign in with {provider === "google" ? "Google" : "GitHub"}
    </button>
  )
}

// src/components/auth/sign-out-button.tsx
"use client"
import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ redirectTo: "/" })}>
      Sign out
    </button>
  )
}
```

### Pattern 6: Server Action Sign In/Out (Alternative)
**What:** Form-based auth using server actions
**When to use:** When you prefer server-side control or need progressive enhancement
**Example:**
```typescript
// src/components/auth/sign-in-form.tsx
import { signIn } from "@/auth"

export function SignInForm({ provider }: { provider: "google" | "github" }) {
  return (
    <form
      action={async () => {
        "use server"
        await signIn(provider, { redirectTo: "/" })
      }}
    >
      <button type="submit">Sign in with {provider}</button>
    </form>
  )
}
```

### Anti-Patterns to Avoid
- **Relying solely on middleware for auth:** After CVE-2025-29927, always verify auth at the data access layer too
- **Importing database clients in middleware:** Causes edge runtime errors with Prisma
- **Using `useSession` without `SessionProvider`:** Will throw "must be wrapped in SessionProvider" error
- **Storing sensitive data in JWT:** JWT is encrypted but should only contain minimal user identifiers
- **Using v4 patterns in v5:** No `getSession` or `getServerSession` - use `auth()` instead

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flow | Custom OAuth client | Auth.js providers | CSRF, state, PKCE handling is complex |
| Session management | Custom JWT handling | Auth.js sessions | Secure cookie config, encryption, rotation |
| CSRF protection | Custom tokens | Auth.js built-in | Timing attacks, storage, validation edge cases |
| Provider quirks | Provider-specific code | Auth.js adapters | Google refresh tokens, GitHub optional email |
| Sign-out across tabs | Custom events | SessionProvider | Handles window focus, tab sync automatically |

**Key insight:** OAuth authentication has numerous security requirements (state validation, PKCE, token encryption, secure cookies, CSRF protection) that are easy to get wrong. Auth.js handles all of these by default.

## Common Pitfalls

### Pitfall 1: Missing Environment Variables
**What goes wrong:** Auth fails silently or throws cryptic errors
**Why it happens:** OAuth requires specific env vars for each provider
**How to avoid:** Create `.env.local` with all required variables before starting
**Warning signs:** "Invalid client_id" or redirect errors in OAuth flow
**Required variables:**
```bash
AUTH_SECRET=          # Generate with: npx auth secret
AUTH_GOOGLE_ID=       # Google Cloud Console
AUTH_GOOGLE_SECRET=   # Google Cloud Console
AUTH_GITHUB_ID=       # GitHub Developer Settings
AUTH_GITHUB_SECRET=   # GitHub Developer Settings
```

### Pitfall 2: Wrong Callback URLs in Provider Console
**What goes wrong:** OAuth redirect fails after provider login
**Why it happens:** Provider rejects callback to unregistered URL
**How to avoid:** Configure exact callback URLs in each provider console
**Warning signs:** "redirect_uri_mismatch" error
**Correct URLs:**
- Google: `https://yourdomain.com/api/auth/callback/google` (and localhost for dev)
- GitHub: `https://yourdomain.com/api/auth/callback/github` (and localhost for dev)

### Pitfall 3: SessionProvider Missing for Client Components
**What goes wrong:** Runtime error when using `useSession`
**Why it happens:** `useSession` requires React Context from SessionProvider
**How to avoid:** Wrap app with SessionProvider in layout.tsx
**Warning signs:** "useSession must be wrapped in a SessionProvider" error

### Pitfall 4: Edge Runtime Incompatibility (Future Phase)
**What goes wrong:** Middleware crashes when using database adapters
**Why it happens:** Prisma/database clients not compatible with edge runtime
**How to avoid:** Use JWT strategy for session, split auth config if using adapters
**Warning signs:** "PrismaClient is unable to run in edge runtime" error
**Note:** This is not an issue for Phase 10 (JWT only) but will matter in Phase 11+

### Pitfall 5: Session Data Not Available in Client
**What goes wrong:** User name/image not showing in UI
**Why it happens:** Auth.js only exposes name, email, image by default
**How to avoid:** Use callbacks to extend session with needed fields
**Warning signs:** `session.user.id` is undefined

### Pitfall 6: Importing from Wrong Package
**What goes wrong:** Type errors or runtime errors
**Why it happens:** v5 changed import paths from v4
**How to avoid:** Use these import patterns:
```typescript
// Server-side (auth config, server components, server actions)
import { auth, signIn, signOut } from "@/auth"

// Client-side (client components)
import { useSession, signIn, signOut, SessionProvider } from "next-auth/react"
```

## Code Examples

Verified patterns from official sources:

### Complete auth.ts Configuration
```typescript
// Source: https://authjs.dev/getting-started/installation
// src/auth.ts
import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import GitHub from "next-auth/providers/github"

// Extend session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google, GitHub],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login", // Optional: custom sign-in page
  },
})
```

### User Menu Component (Client)
```typescript
// Source: https://authjs.dev/reference/nextjs/react
// src/components/auth/user-menu.tsx
"use client"
import { useSession, signOut } from "next-auth/react"

export function UserMenu() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (!session) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {session.user?.image && (
        <img
          src={session.user.image}
          alt={session.user.name || "User"}
          className="w-8 h-8 rounded-full"
        />
      )}
      <span>{session.user?.name}</span>
      <button onClick={() => signOut({ redirectTo: "/" })}>
        Sign out
      </button>
    </div>
  )
}
```

### Conditional Header (Server Component)
```typescript
// src/components/header.tsx
import { auth } from "@/auth"
import { SignInButton } from "./auth/sign-in-button"
import { UserMenu } from "./auth/user-menu"

export async function Header() {
  const session = await auth()

  return (
    <header className="flex justify-between items-center p-4">
      <h1>Ad Library Analyzer</h1>
      <nav>
        {session ? (
          <UserMenu />
        ) : (
          <div className="flex gap-2">
            <SignInButton provider="google" />
            <SignInButton provider="github" />
          </div>
        )}
      </nav>
    </header>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getSession()` / `getServerSession()` | `auth()` function | Auth.js v5 | Single unified API for server-side session |
| `@next-auth/*-adapter` | `@auth/*-adapter` | Auth.js v5 | New package scope for adapters |
| `NEXTAUTH_URL` required | Auto-detected | Auth.js v5 | Simpler configuration |
| `pages/api/auth/[...nextauth].ts` | `app/api/auth/[...nextauth]/route.ts` | Next.js 13+ | App Router migration |
| Middleware for auth | Data Access Layer | CVE-2025-29927 (March 2025) | Defense in depth required |

**Deprecated/outdated:**
- `getSession()` - replaced by `auth()` in v5
- `getServerSession()` - replaced by `auth()` in v5
- `@next-auth/prisma-adapter` - use `@auth/prisma-adapter` instead
- Relying solely on middleware for auth - verify at data access layer too

## Open Questions

Things that couldn't be fully resolved:

1. **Next.js 16 proxy.ts vs middleware.ts**
   - What we know: Next.js 16 renames middleware.ts to proxy.ts
   - What's unclear: Current project uses Next.js 16.1.2 - need to verify if middleware.ts or proxy.ts is used
   - Recommendation: Check Next.js 16 docs during implementation; both patterns work similarly

2. **Exact beta version stability**
   - What we know: Auth.js v5 is "beta" but widely used in production
   - What's unclear: Exact version to pin for stability
   - Recommendation: Use `next-auth@beta` and let npm resolve latest stable beta

## OAuth Provider Setup Instructions

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to APIs & Services > Credentials
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application"
6. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
7. Copy Client ID and Client Secret to `.env.local`

### GitHub OAuth Setup
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in application details:
   - Homepage URL: `http://localhost:3000` (or production URL)
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Register application
5. Generate a new client secret
6. Copy Client ID and Client Secret to `.env.local`

**Important:** For production, create separate OAuth apps with production URLs.

## Sources

### Primary (HIGH confidence)
- [Auth.js Installation Guide](https://authjs.dev/getting-started/installation) - Setup instructions
- [Auth.js Next.js Reference](https://authjs.dev/reference/nextjs) - API reference
- [Auth.js React Reference](https://authjs.dev/reference/nextjs/react) - Client hooks
- [Auth.js Session Management](https://authjs.dev/getting-started/session-management/get-session) - Session patterns
- [Auth.js Extending Session](https://authjs.dev/guides/extending-the-session) - Callbacks
- [Auth.js TypeScript](https://authjs.dev/getting-started/typescript) - Type augmentation
- [Auth.js Google Provider](https://authjs.dev/getting-started/providers/google) - Google setup
- [Auth.js GitHub Provider](https://authjs.dev/getting-started/providers/github) - GitHub setup

### Secondary (MEDIUM confidence)
- [Next.js Data Security Guide](https://nextjs.org/docs/app/guides/data-security) - DAL patterns
- [Auth0 Next.js 16 Guide](https://auth0.com/blog/whats-new-nextjs-16/) - Next.js 16 changes
- [CVE-2025-29927 Analysis](https://securitylabs.datadoghq.com/articles/nextjs-middleware-auth-bypass/) - Security context

### Tertiary (LOW confidence)
- Various Medium articles and tutorials - Implementation patterns (verified against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Auth.js is the official Next.js auth solution with extensive documentation
- Architecture: HIGH - Patterns from official Auth.js docs and Next.js recommendations
- Pitfalls: HIGH - Well-documented issues in Auth.js GitHub discussions and official guides

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (Auth.js v5 is stable; check for stable release announcement)
