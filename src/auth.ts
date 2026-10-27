import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"

// Extend session types to include user.id
declare module "next-auth" {
  interface Session {
    user: {
      id: string
    } & DefaultSession["user"]
  }
}

// Demo user for email/password sign-in
// In production, this would validate against a database
const DEMO_USER = {
  id: "demo-user-1",
  email: "demo@example.com",
  password: "demo123", // In production, use hashed passwords
  name: "Demo User",
  image: null,
}

// Check if Google OAuth is configured
const isGoogleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)

// Everyone who signs in as the demo user shares one identity, so it stays off
// in production (including Vercel previews) unless ENABLE_DEMO_LOGIN=1
export const isDemoLoginEnabled =
  process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_LOGIN === "1"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    // Only add Google provider if credentials are configured
    ...(isGoogleConfigured ? [
      Google({
        // Trimmed: the production AUTH_GOOGLE_ID carries a trailing newline, which
        // reaches Google as "client_id=...%0A" and fails with 401 invalid_client.
        clientId: process.env.AUTH_GOOGLE_ID!.trim(),
        clientSecret: process.env.AUTH_GOOGLE_SECRET!.trim(),
      }),
    ] : []),
    ...(isDemoLoginEnabled ? [
      Credentials({
        name: "Email",
        credentials: {
          email: { label: "Email", type: "email", placeholder: "demo@example.com" },
          password: { label: "Password", type: "password", placeholder: "demo123" },
        },
        async authorize(credentials) {
          // Demo authentication - validates against hardcoded user
          // In production, validate against database with hashed passwords
          if (
            credentials?.email === DEMO_USER.email &&
            credentials?.password === DEMO_USER.password
          ) {
            return {
              id: DEMO_USER.id,
              email: DEMO_USER.email,
              name: DEMO_USER.name,
              image: DEMO_USER.image,
            }
          }
          return null
        },
      }),
    ] : []),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/auth/signin", // Custom sign-in page for credentials
  },
  callbacks: {
    async jwt({ token, user, account }) {
      // Demo JWTs issued before the flag went off would otherwise roll on forever
      if (!isDemoLoginEnabled && token.email === DEMO_USER.email) return null
      if (user && user.email) {
        // Upsert user in DB on every sign-in so Google users get a row
        try {
          const dbUser = await prisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            },
            create: {
              email: user.email,
              name: user.name ?? null,
              image: user.image ?? null,
            },
          })
          token.id = dbUser.id
        } catch (error) {
          // Fallback to the provider-given id if DB is unavailable
          console.error("[Auth] Failed to upsert user:", error)
          token.id = user.id
        }
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
