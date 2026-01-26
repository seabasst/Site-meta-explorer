import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

export type SubscriptionStatus = 'free' | 'pro' | 'past_due' | 'cancelled';

/**
 * Get subscription status from local database (fast)
 */
export async function getSubscriptionStatus(email: string): Promise<SubscriptionStatus> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { subscriptionStatus: true },
  });

  if (!user) return 'free';

  // Map database status to our simplified status
  switch (user.subscriptionStatus) {
    case 'pro':
    case 'active':
    case 'trialing':
      return 'pro';
    case 'past_due':
      return 'past_due';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return 'free';
  }
}

/**
 * Check if user has Pro access (active subscription)
 */
export async function isPro(email: string): Promise<boolean> {
  const status = await getSubscriptionStatus(email);
  return status === 'pro';
}

/**
 * Sync subscription status from Stripe to database
 * Called by webhook handlers
 */
export async function syncSubscriptionStatus(
  customerId: string,
  subscriptionId: string,
  status: Stripe.Subscription.Status
): Promise<void> {
  // Map Stripe status to our status
  let dbStatus: string;
  switch (status) {
    case 'active':
    case 'trialing':
      dbStatus = 'pro';
      break;
    case 'past_due':
      dbStatus = 'past_due';
      break;
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      dbStatus = 'cancelled';
      break;
    default:
      dbStatus = 'free';
  }

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: dbStatus,
      subscriptionId: status === 'canceled' ? null : subscriptionId,
    },
  });

  console.log(`[Subscription] Customer ${customerId} status updated to ${dbStatus}`);
}

/**
 * Handle successful checkout - create/update user subscription
 */
export async function handleCheckoutComplete(
  session: Stripe.Checkout.Session
): Promise<void> {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userId = session.metadata?.userId;

  if (!userId) {
    console.error('[Subscription] No userId in checkout session metadata');
    return;
  }

  // Update user with subscription info
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
      subscriptionId: subscriptionId,
      subscriptionStatus: 'pro',
    },
  });

  console.log(`[Subscription] User ${userId} upgraded to Pro via checkout`);
}

/**
 * Handle subscription deletion (cancellation at period end)
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;

  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: 'cancelled',
      subscriptionId: null,
    },
  });

  console.log(`[Subscription] Customer ${customerId} subscription cancelled`);
}
