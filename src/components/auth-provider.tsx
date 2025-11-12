"use client"

import * as React from "react"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { User } from "@/types"
import { getUserProfile } from "@/lib/auth"

interface AuthContextType {
  user: SupabaseUser | null
  userProfile: User | null
  walletBalance: number | null
  walletEarningsBalance: number | null
  walletLockedEarningsBalance: number | null
  nextTopupDueOn: string | null
  userValuePerPoint: number | null
  isLoading: boolean
  walletDataLoaded: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshWalletBalance: () => Promise<void>
  waitForAuthStateChange: (timeout?: number) => Promise<boolean>
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

// Helper function to fetch profile with retry logic
async function fetchProfileWithRetry(userId: string, maxRetries = 3, timeout = 15000): Promise<User | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const profile = await runWithTimeout(
        getUserProfile(userId).then((result) => result as User | null),
        timeout,
        "Profile fetch timeout",
      )

      if (profile) {
        return profile
      }

      // If profile is null but no error, wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    } catch (error) {
      const warningMessage = `Profile fetch attempt ${attempt} failed after ${timeout}ms`
      if (attempt === maxRetries) {
        console.error(`${warningMessage}:`, error)
      } else {
        console.warn(`${warningMessage}:`, error)
      }
      
      // Wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
  
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // CRITICAL: Start with isLoading=true but only on client to avoid hydration mismatch
  // Server will render with loading=true, client will hydrate with loading=true, then update
  const [user, setUser] = React.useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = React.useState<User | null>(null)
  const [walletBalance, setWalletBalance] = React.useState<number | null>(null)
  const [walletEarningsBalance, setWalletEarningsBalance] = React.useState<number | null>(null)
  const [walletLockedEarningsBalance, setWalletLockedEarningsBalance] = React.useState<number | null>(null)
  const [userValuePerPoint, setUserValuePerPoint] = React.useState<number | null>(null)
  const [nextTopupDueOn, setNextTopupDueOn] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [walletDataLoaded, setWalletDataLoaded] = React.useState(false)
  const [profileError, setProfileError] = React.useState(false)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // Helper to clear all auth state
  const clearAuthState = React.useCallback(() => {
    setUser(null)
    setUserProfile(null)
    setWalletBalance(null)
    setWalletEarningsBalance(null)
    setWalletLockedEarningsBalance(null)
    setNextTopupDueOn(null)
    setWalletDataLoaded(false)
    setProfileError(false)
  }, [])

  // Use refs to access current state without causing re-subscriptions
  const userRef = React.useRef<SupabaseUser | null>(null)
  const userProfileRef = React.useRef<User | null>(null)
  const authStateChangeResolversRef = React.useRef<Set<(value: boolean) => void>>(new Set())

  // Update refs when state changes
  React.useEffect(() => {
    userRef.current = user
    userProfileRef.current = userProfile
  }, [user, userProfile])

  // Wait for auth state change to complete (used by auth dialog)
  // This waits for the next SIGNED_IN event to complete (profile loaded)
  const waitForAuthStateChange = React.useCallback((timeout = 15000): Promise<boolean> => {
    return new Promise((resolve) => {
      // Store initial state to detect changes
      const initialUser = userRef.current
      const initialProfile = userProfileRef.current
      
      // If we're already authenticated with profile, wait a bit to see if a new sign-in happens
      // Otherwise, wait for the next auth state change
      const timeoutId = setTimeout(() => {
        authStateChangeResolversRef.current.delete(resolver)
        // Check if state changed from initial state
        const currentUser = userRef.current
        const currentProfile = userProfileRef.current
        const hasChanged = currentUser !== initialUser || currentProfile !== initialProfile
        // Resolve true if we have a user and profile (either new or existing)
        resolve(hasChanged && currentUser !== null && currentProfile !== null)
      }, timeout)

      const resolver = (value: boolean) => {
        clearTimeout(timeoutId)
        authStateChangeResolversRef.current.delete(resolver)
        resolve(value)
      }

      authStateChangeResolversRef.current.add(resolver)
    })
  }, [])

  // Hydration effect - runs immediately on client mount
  React.useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Initialize auth state on mount
  React.useEffect(() => {
    // Wait for hydration before initializing auth to avoid hydration mismatches
    if (!isHydrated) return

    let isMounted = true
    let authInitialized = false
    let isProcessingAuthChange = false

    // Get initial session with simplified timeout protection
    const initializeAuth = async () => {
      try {
        // Get session with a reasonable timeout (3 seconds)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          clearTimeout(timeoutId)
          
          if (!isMounted || authInitialized) return
          
          if (sessionError) {
            console.warn("Session fetch error:", sessionError)
            clearAuthState()
            userRef.current = null
            userProfileRef.current = null
            authInitialized = true
            setIsLoading(false)
            return
          }

          if (session?.user) {
            // Validate session with getUser() - simpler without race condition timeouts
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            
            if (!isMounted || authInitialized) return
            
            if (userError || !user) {
              console.warn("Session validation failed:", userError?.message || "No user")
              clearAuthState()
              userRef.current = null
              userProfileRef.current = null
              authInitialized = true
              setIsLoading(false)
              return
            }
            
            // Session is valid - set user
            setUser(user)
            userRef.current = user
            
            // Fetch profile with retry logic
            const profile = await fetchProfileWithRetry(user.id, 3, 10000)
            
            if (!isMounted || authInitialized) return
            
            if (profile) {
              setUserProfile(profile)
              userProfileRef.current = profile
              setProfileError(false)
            } else {
              console.warn("Failed to fetch user profile after retries")
              setProfileError(true)
            }
          } else {
            // No session
            clearAuthState()
            userRef.current = null
            userProfileRef.current = null
          }
        } catch (abortError) {
          // Timeout or abort - treat as no session
          if (!isMounted) return
          console.warn("Auth initialization timeout")
          clearAuthState()
          userRef.current = null
          userProfileRef.current = null
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        if (!isMounted || authInitialized) return
        clearAuthState()
        userRef.current = null
        userProfileRef.current = null
      } finally {
        if (isMounted && !authInitialized) {
          authInitialized = true
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes (realtime)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        // CRITICAL: Process SIGNED_IN events immediately, even during initialization
        // This ensures mobile sign-ins are handled in realtime without delay
        const isSignInEvent = event === 'SIGNED_IN'
        const shouldProcess = authInitialized || isSignInEvent

        if (!shouldProcess) {
          // Queue the event to be processed after initialization (for non-sign-in events)
          return
        }

        // Prevent concurrent auth state processing (except for SIGNED_IN which should process immediately)
        if (isProcessingAuthChange && !isSignInEvent) {
          console.warn("Auth state change already processing, skipping")
          return
        }

        isProcessingAuthChange = true

        try {
          if (event === 'SIGNED_OUT' || !session?.user) {
            // Clear all state on sign out
            clearAuthState()
            userRef.current = null
            userProfileRef.current = null
            // CRITICAL: Ensure loading is cleared on sign out
            setIsLoading(false)
            // Notify waiters
            authStateChangeResolversRef.current.forEach(resolve => resolve(false))
            authStateChangeResolversRef.current.clear()
            return
          }

          // For SIGNED_IN or TOKEN_REFRESHED events
          if (session.user) {
            // Only update if user actually changed to prevent unnecessary re-renders
            const currentUserId = userRef.current?.id
            const newUserId = session.user.id

            if (currentUserId !== newUserId) {
              // User changed - set user immediately
              setUser(session.user)
              userRef.current = session.user
              // CRITICAL: Set loading to true when new user signs in to show loading state
              setIsLoading(true)
            }
            
            // Always try to fetch profile (it might have been updated)
            // Use shorter timeout on mobile for faster response
            const profile = await fetchProfileWithRetry(session.user.id)
            
            if (!isMounted) return
            
            if (profile) {
              setUserProfile(profile)
              userProfileRef.current = profile
              setProfileError(false)
            } else {
              // Profile fetch failed - but don't sign out automatically
              // This could be a temporary network issue
              console.warn("Failed to fetch user profile in auth state change")
              setProfileError(true)
              
              // Only clear user state if this is a SIGNED_IN event and we have no profile
              // This handles the case where a user signs in but their profile doesn't exist yet
              if (event === 'SIGNED_IN' && !userProfileRef.current) {
                console.warn("New sign-in but profile not found - keeping user but showing error")
                // Don't auto-sign-out - let the user retry or handle it manually
              }
            }
            
            // CRITICAL: Always clear loading state after profile fetch completes (success or failure)
            // This ensures the UI doesn't get stuck in loading state, especially on mobile
            setIsLoading(false)
            
            // Notify waiters that auth state change is complete
            const isAuthenticated = profile !== null
            authStateChangeResolversRef.current.forEach(resolve => resolve(isAuthenticated))
            authStateChangeResolversRef.current.clear()
          }
        } finally {
          isProcessingAuthChange = false
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [clearAuthState, isHydrated])

  const handleSignOut = React.useCallback(async () => {
    try {
      // Clear state immediately for better UX
      clearAuthState()
      userRef.current = null
      userProfileRef.current = null
      // CRITICAL: Set loading to false immediately to prevent skeleton loaders
      // This ensures the UI doesn't get stuck showing loading states after sign out
      setIsLoading(false)
      
      // Sign out from Supabase (this clears cookies server-side)
      // Wrap in timeout to prevent hanging on slow networks
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 2000)
      })
      
      await Promise.race([signOutPromise, timeoutPromise])
      
      // Force a page reload to ensure all cookies/storage are cleared
      // This is necessary because Next.js SSR can cache auth state
      if (typeof window !== 'undefined') {
        // Use replace instead of href to avoid adding to history
        window.location.replace('/')
      }
    } catch (error) {
      console.error("Error signing out:", error)
      // Ensure state is cleared even on error
      clearAuthState()
      userRef.current = null
      userProfileRef.current = null
      // CRITICAL: Set loading to false even on error
      setIsLoading(false)
      
      // Still force reload to clear any cached state
      if (typeof window !== 'undefined') {
        window.location.replace('/')
      }
    }
  }, [clearAuthState])

  const refreshProfile = React.useCallback(async () => {
    if (!user) return
    
    try {
      // Use retry logic for profile refresh
      const profile = await fetchProfileWithRetry(user.id)
      if (profile) {
        setUserProfile(profile)
        setProfileError(false)
      } else {
        console.error('Failed to refresh profile after retries')
        setProfileError(true)
      }
    } catch (error) {
      console.error('Error refreshing profile:', error)
      setProfileError(true)
    }
  }, [user])

  const refreshPlatformSettings = React.useCallback(async () => {
    try {
      // Platform settings are public (RLS allows anonymous access)
      const { data, error } = await supabase
        .from('platform_settings')
        .select('user_value_per_point')
        .eq('id', 1)
        .maybeSingle<{ user_value_per_point: number | null }>()

      if (error) {
        // Only log meaningful errors (not 401/unauthorized, which shouldn't happen for public data)
        // Also ignore "no rows returned" errors
        const isUnauthorized = (error as any).status === 401 || (error as any).status === 403
        const isNotFound = error.code === 'PGRST301' || error.message?.includes('No rows')
        if (!isUnauthorized && !isNotFound) {
          console.error('Error fetching platform settings:', error)
        }
        return
      }

      if (!data || data.user_value_per_point === null || typeof data.user_value_per_point === 'undefined') {
        setUserValuePerPoint(null)
        return
      }

      const numericValue = Number(data.user_value_per_point)
      setUserValuePerPoint(Number.isFinite(numericValue) ? numericValue : null)
    } catch (error) {
      // Silently fail - platform settings are not critical for app functionality
      // This prevents console spam if there are transient network issues
    }
  }, [])

  const refreshWalletBalance = React.useCallback(async () => {
    if (!user) {
      setWalletBalance(null)
      setWalletEarningsBalance(null)
      setWalletLockedEarningsBalance(null)
      setNextTopupDueOn(null)
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('points_balance, earnings_points, locked_earnings_points, next_topup_due_on, last_topup_reminder_at')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (error) {
        console.error('Error fetching wallet:', error)
        // If error, set to null to indicate no wallet (user needs first top-up)
        setWalletBalance(null)
        setWalletEarningsBalance(null)
        setWalletLockedEarningsBalance(null)
        setNextTopupDueOn(null)
        return
      }

      if (data) {
        setWalletBalance(Number(data.points_balance))
        setWalletEarningsBalance(Number(data.earnings_points ?? 0))
        setWalletLockedEarningsBalance(Number(data.locked_earnings_points ?? 0))
        setNextTopupDueOn(data.next_topup_due_on ?? null)
      } else {
        // No wallet record exists - user needs first top-up
        setWalletBalance(null)
        setWalletEarningsBalance(null)
        setWalletLockedEarningsBalance(null)
        setNextTopupDueOn(null)
      }
      setWalletDataLoaded(true)
    } catch (error) {
      console.error('Error refreshing wallet balance:', error)
      // On error, set to null
      setWalletBalance(null)
      setWalletEarningsBalance(null)
      setWalletLockedEarningsBalance(null)
      setNextTopupDueOn(null)
      setWalletDataLoaded(true)
    }
  }, [user])

  // Real-time subscription for wallet balance
  React.useEffect(() => {
    if (!user) {
      setWalletBalance(null)
      setWalletEarningsBalance(null)
      setWalletLockedEarningsBalance(null)
      setNextTopupDueOn(null)
      setWalletDataLoaded(false)
      return
    }

    let isMounted = true

    // Initial fetch
    refreshWalletBalance()

    // Subscribe to wallet changes
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (!isMounted) return
          const newPayload = payload.new as { points_balance: number; earnings_points?: number; locked_earnings_points?: number; next_topup_due_on?: string }
          setWalletBalance(Number(newPayload.points_balance))
          if (typeof newPayload.earnings_points === 'number') {
            setWalletEarningsBalance(Number(newPayload.earnings_points))
          }
          if (typeof newPayload.locked_earnings_points === 'number') {
            setWalletLockedEarningsBalance(Number(newPayload.locked_earnings_points))
          }
          setNextTopupDueOn(newPayload.next_topup_due_on ?? null)
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [user, refreshWalletBalance])

  // Fetch platform settings once after auth is initialized
  React.useEffect(() => {
    if (!isLoading) {
      // Wait a bit to ensure Supabase client is fully ready
      const timer = setTimeout(() => {
        refreshPlatformSettings()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isLoading, refreshPlatformSettings])

  const value = {
    user,
    userProfile,
    walletBalance,
    walletEarningsBalance,
    walletLockedEarningsBalance,
    nextTopupDueOn,
    userValuePerPoint,
    isLoading,
    walletDataLoaded,
    signOut: handleSignOut,
    refreshProfile,
    refreshWalletBalance,
    waitForAuthStateChange,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
