import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import {
  handleCheckoutComplete,
  syncSubscriptionStatus,
  handleSubscriptionDeleted,
} from '@/lib/subscription';

export async function POST(request: Request) {
  // CRITICAL: Use text() not json() for signature verification
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Webhook] Signature verification failed:', message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log(`[Webhook] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
          await handleCheckoutComplete(session);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionStatus(
          subscription.customer as string,
          subscription.id,
          subscription.status
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        console.log(`[Webhook] Payment failed for customer ${customerId}`);
        // Status will be updated via subscription.updated event (past_due)
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Webhook] Error handling ${event.type}:`, message);
    // Still return 200 to prevent Stripe retry for processing errors
    // The event was received and verified, just failed to process
  }

  // Return 200 quickly to acknowledge receipt
  return NextResponse.json({ received: true });
}
