'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

export async function createCheckoutSession() {
  const session = await auth();

  if (!session?.user?.email) {
    throw new Error('Must be logged in to upgrade');
  }

  // Find or create user in database
  let user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
    });
  }

  // If user already has a Stripe customer, use it
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: session.user.email,
      name: session.user.name || undefined,
      metadata: {
        userId: user.id,
      },
    });
    customerId = customer.id;

    // Store customer ID
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  // Create checkout session
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: customerId,
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?upgrade=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?upgrade=cancelled`,
    metadata: {
      userId: user.id,
    },
    allow_promotion_codes: true,
  });

  if (!checkoutSession.url) {
    throw new Error('Failed to create checkout session');
  }

  redirect(checkoutSession.url);
}

export async function createPortalSession() {
  const session = await auth();

  if (!session?.user?.email) {
    throw new Error('Must be logged in to manage subscription');
  }

  // Find user in database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    throw new Error('No active subscription found');
  }

  // Create billing portal session
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
  });

  redirect(portalSession.url);
}
