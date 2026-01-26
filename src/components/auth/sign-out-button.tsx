"use client"

import { signOut } from "next-auth/react"

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ redirectTo: "/" })}
      className="
        px-3 py-1.5 text-sm font-medium rounded-lg
        text-[var(--text-secondary)] hover:text-[var(--text-primary)]
        bg-[var(--bg-tertiary)] hover:bg-[var(--border-subtle)]
        border border-[var(--border-subtle)] hover:border-[var(--border-default)]
        transition-colors duration-200
      "
    >
      Sign out
    </button>
  )
}
