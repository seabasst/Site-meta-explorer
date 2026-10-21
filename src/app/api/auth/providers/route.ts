import { NextResponse } from "next/server"
import { isDemoLoginEnabled } from "@/auth"

// Check which OAuth providers are configured
const isGoogleConfigured = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)

export async function GET() {
  return NextResponse.json({
    google: isGoogleConfigured,
    credentials: isDemoLoginEnabled,
  })
}
