"use client"

import { Suspense, useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"

interface ProviderStatus {
  google: boolean
  credentials: boolean
}

function SignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/"
  const error = searchParams.get("error")

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [providers, setProviders] = useState<ProviderStatus | null>(null)

  // Fetch available providers on mount
  useEffect(() => {
    fetch("/api/auth/providers")
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(() => setProviders({ google: false, credentials: true }))
  }, [])

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    await signIn("credentials", {
      email,
      password,
      callbackUrl,
    })

    setIsLoading(false)
  }

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl })
  }

  // Better error messages based on error type
  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case "CredentialsSignin":
        return "Invalid email or password. Try demo@example.com / demo123"
      case "OAuthAccountNotLinked":
        return "This email is already linked to another account."
      case "OAuthSignin":
      case "OAuthCallback":
        return "Google sign-in failed. Check that AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are configured in .env.local"
      case "Configuration":
        return "Server configuration error. Check your environment variables."
      default:
        return "An error occurred. Please try again."
    }
  }

  return (
    <div className="glass rounded-2xl p-8 glow-gold">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl text-[var(--text-primary)] mb-2">
          Welcome <span className="italic text-[var(--accent-green-light)]">Back</span>
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Sign in to continue to your account
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
          {getErrorMessage(error)}
        </div>
      )}

      {/* Google Sign In - only show if configured */}
      {providers?.google && (
        <>
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 mb-4 text-sm font-medium rounded-lg bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-subtle)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                or sign in with email
              </span>
            </div>
          </div>
        </>
      )}

      {/* Google not configured notice */}
      {providers && !providers.google && (
        <div className="mb-6 p-3 rounded-lg bg-[var(--accent-yellow)]/10 border border-[var(--accent-yellow)]/30 text-[var(--accent-yellow)] text-xs">
          <p className="font-medium mb-1">Google sign-in not configured</p>
          <p className="text-[var(--text-muted)]">
            To enable Google login, add AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET to your .env.local file.
            See .env.local.example for setup instructions.
          </p>
        </div>
      )}

      {/* Loading state for providers */}
      {!providers && (
        <div className="h-12 mb-4 rounded-lg bg-[var(--bg-tertiary)] animate-pulse" />
      )}

      {/* Email/Password Form */}
      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="demo@example.com"
            required
            className="input-field w-full"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="demo123"
            required
            className="input-field w-full"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full btn-primary py-3 text-base font-semibold"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 rounded-full border-white/30 border-t-white animate-spin" />
              Signing in...
            </span>
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      {/* Demo credentials hint */}
      <div className="mt-6 p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--text-muted)] text-center">
          <span className="font-medium text-[var(--accent-green-light)]">Demo credentials:</span>{" "}
          demo@example.com / demo123
        </p>
      </div>

      {/* Back link */}
      <div className="mt-6 text-center">
        <a
          href="/"
          className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-green-light)] transition-colors"
        >
          Back to home
        </a>
      </div>
    </div>
  )
}

function SignInFormSkeleton() {
  return (
    <div className="glass rounded-2xl p-8 glow-gold">
      <div className="text-center mb-8">
        <h1 className="font-serif text-3xl text-[var(--text-primary)] mb-2">
          Welcome <span className="italic text-[var(--accent-green-light)]">Back</span>
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Sign in to continue to your account
        </p>
      </div>
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-[var(--bg-tertiary)] rounded-lg" />
        <div className="h-4 w-full bg-[var(--bg-tertiary)] rounded my-6" />
        <div className="h-10 bg-[var(--bg-tertiary)] rounded-lg" />
        <div className="h-10 bg-[var(--bg-tertiary)] rounded-lg" />
        <div className="h-12 bg-[var(--bg-tertiary)] rounded-lg" />
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <>
      {/* Background effects */}
      <div className="gradient-mesh" />
      <div className="noise-overlay" />

      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <Suspense fallback={<SignInFormSkeleton />}>
            <SignInForm />
          </Suspense>
        </div>
      </main>
    </>
  )
}
