"use client"

import { useSession } from "next-auth/react"
import { SignOutButton } from "./sign-out-button"

export function UserMenu() {
  const { data: session, status } = useSession()

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] animate-pulse" />
        <div className="w-20 h-4 rounded bg-[var(--bg-tertiary)] animate-pulse" />
      </div>
    )
  }

  // Not authenticated
  if (!session) {
    return null
  }

  // Get initials for fallback avatar
  const initials = session.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?"

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      {session.user?.image ? (
        <img
          src={session.user.image}
          alt={session.user.name || "User avatar"}
          className="w-8 h-8 rounded-full border border-[var(--border-subtle)]"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[var(--accent-green)] flex items-center justify-center text-xs font-medium text-white">
          {initials}
        </div>
      )}

      {/* Name */}
      <span className="text-sm font-medium text-[var(--text-primary)]">
        {session.user?.name}
      </span>

      {/* Sign Out Button */}
      <SignOutButton />
    </div>
  )
}
