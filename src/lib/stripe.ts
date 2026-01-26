import Stripe from 'stripe'

// Lazy initialization to avoid build-time errors when env vars aren't set
let stripeInstance: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover', // Pinned to current SDK version
      typescript: true,
    })
  }
  return stripeInstance
}

// Export a getter for backwards compatibility
// This will throw at runtime if STRIPE_SECRET_KEY is not set
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return getStripe()[prop as keyof Stripe]
  },
})
