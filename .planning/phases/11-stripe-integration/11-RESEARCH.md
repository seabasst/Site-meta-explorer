# Phase 11: Stripe Integration - Research

**Researched:** 2026-01-26
**Domain:** Stripe Subscriptions with Next.js App Router
**Confidence:** HIGH

## Summary

This phase implements Stripe subscription payments for the Pro tier using Stripe Checkout (hosted payment page) and Customer Portal (self-service subscription management). The implementation follows modern Next.js 15/16 patterns with Server Actions for checkout flows and Route Handlers for webhooks.

The key architectural decision is **whether to add a database** for subscription storage. The project currently uses JWT-only sessions (no database). While Stripe can be queried directly for subscription status, this adds latency to every protected request and creates API rate limit concerns. **The recommended approach is to add a lightweight database** (SQLite/Turso or Prisma with a simple provider) to cache subscription status, synced via webhooks.

**Primary recommendation:** Use Stripe Checkout for payment collection, Stripe Customer Portal for subscription management, webhooks for state synchronization, and add a minimal database to store `customerId` and `subscriptionStatus` per user. Server Actions replace API routes for checkout initiation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^17.x+ | Stripe Node.js SDK | Official SDK with TypeScript support |
| @stripe/stripe-js | ^4.x | Client-side Stripe.js | Secure card handling, required for compliance |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @auth/prisma-adapter | latest | Auth.js database adapter | If using Prisma for user/subscription storage |
| better-sqlite3 | ^11.x | SQLite database | Lightweight local/serverless DB option |
| @libsql/client | latest | Turso (SQLite edge) | Serverless SQLite with replication |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Checkout | Custom payment form | More control but PCI compliance burden |
| Customer Portal | Custom management UI | More control but significant development time |
| Database storage | Stripe API queries | No new dependencies but latency + rate limits |
| Prisma/SQLite | Supabase | More features but external dependency |

**Installation:**
```bash
npm install stripe @stripe/stripe-js
# If adding database:
npm install @prisma/client prisma --save-dev
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── stripe.ts               # Stripe client singleton
│   └── subscription.ts         # Subscription helper functions
├── app/
│   ├── api/
│   │   └── webhooks/
│   │       └── stripe/
│   │           └── route.ts    # Stripe webhook handler
│   ├── actions/
│   │   └── stripe.ts           # Server Actions for checkout/portal
│   ├── pricing/
│   │   └── page.tsx            # Pricing page with upgrade button
│   └── dashboard/
│       └── subscription/
│           └── page.tsx        # Subscription management page
├── components/
│   └── subscription/
│       ├── upgrade-button.tsx  # Pro upgrade CTA
│       ├── subscription-status.tsx  # Current plan display
│       └── manage-subscription-button.tsx  # Portal redirect
└── auth.ts                     # Extended with subscription data
```

### Pattern 1: Stripe Client Singleton
**What:** Single Stripe instance with consistent configuration
**When to use:** All server-side Stripe operations
**Example:**
```typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover', // Pin to specific version
  typescript: true,
});
```

### Pattern 2: Server Action for Checkout
**What:** Create checkout session via Server Action, redirect to Stripe
**When to use:** "Upgrade to Pro" button click
**Example:**
```typescript
// src/app/actions/stripe.ts
'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { stripe } from '@/lib/stripe';

export async function createCheckoutSession() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error('Must be logged in');
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgrade=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?upgrade=cancelled`,
    customer_email: session.user.email,
    metadata: {
      userId: session.user.id,
    },
    allow_promotion_codes: true,
  });

  redirect(checkoutSession.url!);
}
```

### Pattern 3: Server Action for Customer Portal
**What:** Create portal session for subscription management
**When to use:** "Manage Subscription" button click
**Example:**
```typescript
// src/app/actions/stripe.ts (continued)
export async function createPortalSession() {
  const session = await auth();
  if (!session?.user?.email) {
    throw new Error('Must be logged in');
  }

  // Find customer by email
  const customers = await stripe.customers.list({
    email: session.user.email,
    limit: 1,
  });

  if (customers.data.length === 0) {
    throw new Error('No subscription found');
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  redirect(portalSession.url);
}
```

### Pattern 4: Webhook Handler with Raw Body
**What:** Receive and verify Stripe events
**When to use:** Required for subscription lifecycle events
**Example:**
```typescript
// src/app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  // CRITICAL: Use text() not json() for signature verification
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle events
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  // TODO: Store customerId and subscriptionId for user
  console.log(`User ${userId} subscribed: ${subscriptionId}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const status = subscription.status;
  const customerId = subscription.customer as string;

  // TODO: Update user's subscription status in database
  console.log(`Subscription ${subscription.id} status: ${status}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  // TODO: Mark user as free tier
  console.log(`Subscription ${subscription.id} cancelled`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // TODO: Notify user, update status to past_due
  console.log(`Payment failed for customer ${customerId}`);
}
```

### Pattern 5: Check Subscription Status
**What:** Determine if user is Pro tier
**When to use:** Feature gating, UI display
**Example:**
```typescript
// src/lib/subscription.ts
import { stripe } from '@/lib/stripe';

export type SubscriptionStatus = 'free' | 'pro' | 'past_due' | 'cancelled';

export async function getSubscriptionStatus(email: string): Promise<SubscriptionStatus> {
  // Find customer by email
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (customers.data.length === 0) {
    return 'free';
  }

  const customerId = customers.data[0].id;

  // Get active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    return 'free';
  }

  const subscription = subscriptions.data[0];

  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return 'pro';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'cancelled';
    default:
      return 'free';
  }
}
```

### Anti-Patterns to Avoid
- **Using `request.json()` in webhooks:** Breaks signature verification. Always use `request.text()`.
- **Trusting client-side subscription status:** Always verify server-side before granting access.
- **Hardcoding price IDs:** Use environment variables for test/live mode flexibility.
- **Skipping webhook signature verification:** Opens you to replay attacks and spoofed events.
- **Processing webhooks synchronously:** Return 200 quickly, process heavy logic async.
- **Missing idempotency handling:** Same webhook can arrive multiple times.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment form | Custom card inputs | Stripe Checkout | PCI compliance, fraud protection |
| Subscription management UI | Custom cancel/resume flows | Customer Portal | Handles edge cases, localized |
| Payment failure recovery | Custom dunning emails | Stripe Smart Retries | ML-optimized retry timing |
| Invoice generation | Custom PDF creation | Stripe Invoices | Tax handling, compliance |
| Proration calculation | Manual pro-rata math | Stripe automatic proration | Handles upgrades/downgrades |
| Webhook signature verification | Manual HMAC | `stripe.webhooks.constructEvent` | Timing attack protection |

**Key insight:** Stripe Checkout and Customer Portal handle 90% of subscription UX. Building custom flows is tempting but introduces PCI compliance burden and edge cases (failed payments, card updates, cancellation flows, refunds, disputes).

## Common Pitfalls

### Pitfall 1: Wrong Webhook Secret
**What goes wrong:** Signature verification always fails
**Why it happens:** Using Dashboard secret with CLI, or test secret in production
**How to avoid:**
- Local dev: Use secret from `stripe listen` command
- Production: Use secret from Dashboard webhook endpoint
- Store in environment variables: `STRIPE_WEBHOOK_SECRET`
**Warning signs:** "Webhook signature verification failed" errors

### Pitfall 2: Raw Body Parsing Issue
**What goes wrong:** Webhook signatures fail despite correct secret
**Why it happens:** Next.js App Router requires `request.text()`, not `request.json()`
**How to avoid:** Always use `await request.text()` before `constructEvent()`
**Warning signs:** Signature errors only in Next.js, works in Stripe CLI

### Pitfall 3: Duplicate Webhook Processing
**What goes wrong:** User gets double credits, duplicate emails
**Why it happens:** Stripe retries failed webhooks, same event delivered multiple times
**How to avoid:** Track processed event IDs, use idempotent operations
**Warning signs:** Duplicate records after webhook delivery issues

### Pitfall 4: Customer Portal Not Configured
**What goes wrong:** "Portal configuration not found" error
**Why it happens:** Customer Portal must be enabled in Stripe Dashboard first
**How to avoid:** Configure portal settings in Dashboard > Settings > Billing > Customer Portal
**Warning signs:** Error when calling `billingPortal.sessions.create`

### Pitfall 5: Missing Metadata in Checkout
**What goes wrong:** Webhook can't identify which user subscribed
**Why it happens:** User ID not passed through checkout flow
**How to avoid:** Always include `metadata: { userId }` in checkout session
**Warning signs:** Null userId in `checkout.session.completed` handler

### Pitfall 6: Test Mode vs Live Mode Confusion
**What goes wrong:** Webhooks work in test, fail in production (or vice versa)
**Why it happens:** Separate webhook endpoints, secrets, and keys for each mode
**How to avoid:**
- Use `STRIPE_SECRET_KEY` (no prefix) in env vars
- Configure separate webhooks for test and live modes
- Use different `STRIPE_WEBHOOK_SECRET` per environment
**Warning signs:** Works locally, fails on Vercel

## Code Examples

Verified patterns from official sources and modern Next.js guides:

### Complete Upgrade Button Component
```typescript
// src/components/subscription/upgrade-button.tsx
'use client';

import { useTransition } from 'react';
import { createCheckoutSession } from '@/app/actions/stripe';

export function UpgradeButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <form action={() => startTransition(() => createCheckoutSession())}>
      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? 'Redirecting...' : 'Upgrade to Pro'}
      </button>
    </form>
  );
}
```

### Subscription Status Display
```typescript
// src/components/subscription/subscription-status.tsx
import { auth } from '@/auth';
import { getSubscriptionStatus } from '@/lib/subscription';
import { ManageSubscriptionButton } from './manage-subscription-button';
import { UpgradeButton } from './upgrade-button';

export async function SubscriptionStatus() {
  const session = await auth();
  if (!session?.user?.email) return null;

  const status = await getSubscriptionStatus(session.user.email);

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">Subscription</h3>
      <p className="text-sm text-gray-600">
        Current plan: <span className="font-medium">{status === 'pro' ? 'Pro' : 'Free'}</span>
      </p>
      {status === 'past_due' && (
        <p className="text-sm text-red-600">Payment issue - please update payment method</p>
      )}
      <div className="mt-4">
        {status === 'free' || status === 'cancelled' ? (
          <UpgradeButton />
        ) : (
          <ManageSubscriptionButton />
        )}
      </div>
    </div>
  );
}
```

### Environment Variables Template
```bash
# .env.local

# Stripe API Keys (test mode for development)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Price ID for Pro tier (create in Stripe Dashboard)
STRIPE_PRO_PRICE_ID=price_...

# Stripe Webhook Secret (from `stripe listen` or Dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...

# App URL for redirects
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API Routes for checkout | Server Actions | Next.js 14+ | Less boilerplate, better DX |
| `req.body` parsing | `request.text()` for webhooks | App Router | Required for signature verification |
| Custom payment forms | Stripe Checkout hosted | Always best practice | PCI compliance, fraud protection |
| Manual subscription UI | Customer Portal | Stripe default | Handles edge cases automatically |
| Polling subscription status | Webhook-driven updates | Best practice | Real-time, efficient |

**Deprecated/outdated:**
- `stripe.webhooks.constructEvent` with parsed JSON body - use raw text
- Pages Router API routes (`pages/api/`) - use App Router route handlers
- Client-side checkout initiation - use Server Actions with redirect

## Database Consideration

### Option A: No Database (Query Stripe Directly)
**Pros:** No new dependencies, single source of truth
**Cons:**
- API call on every protected request (latency)
- Rate limits (100 reads/sec in test mode)
- No offline/cached access

**Pattern:**
```typescript
// Check on each request
const status = await getSubscriptionStatus(user.email);
if (status !== 'pro') {
  redirect('/pricing');
}
```

### Option B: Add Minimal Database (Recommended)
**Pros:** Fast local lookups, webhook-synced, works with Auth.js
**Cons:** Additional dependency, sync complexity

**Schema (minimal):**
```prisma
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  name              String?
  image             String?
  stripeCustomerId  String?  @unique
  subscriptionStatus String  @default("free") // free, pro, past_due
  subscriptionId    String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Recommendation:** Add database for Phase 11. Benefits outweigh complexity:
1. Fast tier checks without API calls
2. Webhook updates keep it synced
3. Auth.js Prisma adapter makes it seamless
4. Enables future features (usage tracking, audit logs)

## Open Questions

Things that couldn't be fully resolved:

1. **Database choice for Vercel deployment**
   - What we know: SQLite works locally, needs edge-compatible option for Vercel
   - What's unclear: Best serverless SQLite option (Turso vs PlanetScale vs Vercel Postgres)
   - Recommendation: Start with SQLite locally, migrate to Turso for production (SQLite-compatible)

2. **Stripe API version pinning**
   - What we know: Current version is 2025-12-15.clover
   - What's unclear: Whether to pin or use latest
   - Recommendation: Pin to specific version for stability, update quarterly

3. **Handling subscription resume**
   - What we know: Customer Portal handles this automatically
   - What's unclear: Whether "resume" means reactivate cancelled or unpause
   - Recommendation: Use Customer Portal for both cases, listen to `customer.subscription.updated`

## Sources

### Primary (HIGH confidence)
- [Stripe Build Subscriptions Guide](https://docs.stripe.com/billing/subscriptions/build-subscriptions) - Official subscription integration
- [Stripe Customer Portal](https://docs.stripe.com/customer-management) - Portal integration guide
- [Stripe Webhooks](https://docs.stripe.com/webhooks) - Webhook setup and security
- [Stripe API Reference](https://docs.stripe.com/api) - Complete API documentation
- [Stripe Subscription Webhooks](https://docs.stripe.com/billing/subscriptions/webhooks) - Subscription events

### Secondary (MEDIUM confidence)
- [Pedro Alonso: Stripe + Next.js 15 Complete Guide](https://www.pedroalonso.net/blog/stripe-nextjs-complete-guide-2025/) - Modern patterns with Server Actions
- [Vercel nextjs-subscription-payments template](https://github.com/vercel/nextjs-subscription-payments) - Reference architecture
- [Medium: Next.js App Router Stripe Webhook](https://kitson-broadhurst.medium.com/next-js-app-router-stripe-webhook-signature-verification-ea9d59f3593f) - Raw body pattern

### Tertiary (LOW confidence)
- Various Medium articles on Stripe+Next.js - Implementation patterns (verified against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Stripe SDK, well-documented
- Architecture: HIGH - Patterns from Stripe docs and verified tutorials
- Pitfalls: HIGH - Well-documented issues across multiple sources
- Database recommendation: MEDIUM - Trade-off decision, both approaches valid

**Research date:** 2026-01-26
**Valid until:** 2026-02-26 (Stripe API stable; check for major version updates)
