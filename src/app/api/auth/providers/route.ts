import { NextResponse } from "next/server"

// Check which OAuth providers are configured
const isGoogleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)

export async function GET() {
  return NextResponse.json({
    google: isGoogleConfigured,
    credentials: true, // Always available (demo user)
  })
}
