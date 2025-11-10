"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTopupCheck } from "@/hooks/use-topup-check"
import { useAuth } from "@/components/auth-provider"

interface TopUpGuardProps {
  children: React.ReactNode
  communitySlug?: string
}

/**
 * Guard component that protects pages requiring top-up
 * Redirects to top-up page if user needs to top up
 */
export function TopUpGuard({ children, communitySlug }: TopUpGuardProps) {
  const { needsTopup, hasUser, isChecking } = useTopupCheck()
  const { isLoading: authLoading, userProfile } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [hasRedirected, setHasRedirected] = useState(false)

  // Platform admins are exempt from top-up guard
  const isAdmin = userProfile?.role === 'admin'

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading || isChecking) {
      return
    }

    // Skip redirect for platform admins
    if (isAdmin) {
      return
    }

    // Only redirect if user exists and needs top-up, and we haven't redirected yet
    if (needsTopup && hasUser && !hasRedirected) {
      setHasRedirected(true)
      // Build return URL - use current pathname, or community home if on community page
      const returnUrl = pathname || (communitySlug ? `/${communitySlug}` : '/communities')
      const encodedReturnUrl = encodeURIComponent(returnUrl)
      // Use replace to avoid adding to history stack and ensure immediate redirect
      router.replace(`/topup?returnUrl=${encodedReturnUrl}`)
    }
  }, [needsTopup, hasUser, isChecking, authLoading, pathname, router, communitySlug, hasRedirected, isAdmin])

  // Show nothing while auth is loading or if redirecting/needs top-up
  // This prevents flash of content before redirect
  // Skip blocking for platform admins
  if (!isAdmin && (authLoading || isChecking || (needsTopup && hasUser))) {
    return null
  }

  // User doesn't need top-up (or is admin), render children
  return <>{children}</>
}