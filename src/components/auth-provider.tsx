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
  // Improved to handle cases where user is already signed in and signs in again
  const waitForAuthStateChange = React.useCallback((timeout = 20000): Promise<boolean> => {
    return new Promise((resolve) => {
      // Store initial state to detect changes
      const initialUser = userRef.current
      const initialProfile = userProfileRef.current
      const initialUserId = initialUser?.id
      
      // Track if we've seen a successful auth state change
      let resolved = false
      let pollInterval: NodeJS.Timeout | null = null
      let timeoutId: NodeJS.Timeout | null = null
      
      // Cleanup function
      const cleanup = () => {
        if (pollInterval) {
          clearInterval(pollInterval)
          pollInterval = null
        }
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }
      
      // Resolver function that can be called by auth state change listener
      const resolver = (value: boolean) => {
        if (resolved) return
        
        resolved = true
        cleanup()
        authStateChangeResolversRef.current.delete(resolver)
        resolve(value)
      }
      
      // Add resolver to set so auth state change listener can call it
      authStateChangeResolversRef.current.add(resolver)
      
      // Poll for state changes more aggressively (every 500ms)
      // This helps catch state changes that might not trigger the resolver
      pollInterval = setInterval(() => {
        if (resolved) {
          cleanup()
          return
        }
        
        const currentUser = userRef.current
        const currentProfile = userProfileRef.current
        const currentUserId = currentUser?.id
        
        // Check if we have a valid authenticated state
        // Either: new user signed in, or existing user's profile was loaded
        const hasValidAuth = currentUser !== null && currentProfile !== null
        
        // If user changed, or profile was loaded (was null, now has value), consider it successful
        const userChanged = currentUserId !== initialUserId
        const profileWasNull = initialProfile === null
        const profileNowLoaded = currentProfile !== null
        
        // Success if: user changed, or profile was just loaded (was null, now has value)
        if (hasValidAuth && (userChanged || (profileWasNull && profileNowLoaded))) {
          resolved = true
          cleanup()
          authStateChangeResolversRef.current.delete(resolver)
          resolve(true)
        }
      }, 500)
      
      // Fallback timeout
      timeoutId = setTimeout(() => {
        if (resolved) return
        
        resolved = true
        cleanup()
        authStateChangeResolversRef.current.delete(resolver)
        
        // Final check: do we have valid auth state?
        const currentUser = userRef.current
        const currentProfile = userProfileRef.current
        const hasValidAuth = currentUser !== null && currentProfile !== null
        
        // If we have valid auth, consider it successful even if we didn't detect a change
        // This handles the case where sign-in completed but state didn't change (already signed in)
        if (hasValidAuth) {
          resolve(true)
        } else {
          resolve(false)
        }
      }, timeout)
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
    const MAX_INITIALIZATION_TIME = 15000 // 15 seconds max for initialization

    // CRITICAL: Global timeout to prevent infinite loading loops
    // If initialization takes too long, force it to complete
    const globalTimeout = setTimeout(() => {
      if (!authInitialized && isMounted) {
        console.warn("Auth initialization exceeded maximum time - forcing completion")
        authInitialized = true
        setIsLoading(false)
        // If we have a user but no profile after timeout, invalidate the session
        if (userRef.current && !userProfileRef.current) {
          console.warn("User exists but profile fetch failed - invalidating session")
          clearAuthState()
          userRef.current = null
          userProfileRef.current = null
          // Sign out to clear potentially corrupted session
          supabase.auth.signOut().catch(err => {
            console.error("Error signing out stuck session:", err)
          })
        }
      }
    }, MAX_INITIALIZATION_TIME)

    // Get initial session with simplified timeout protection
    const initializeAuth = async () => {
      try {
        // Get session with a reasonable timeout (5 seconds)
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<{ data: { session: null }, error: null }>((resolve) => {
          setTimeout(() => resolve({ data: { session: null }, error: null }), 5000)
        })
        
        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any
        
        if (!isMounted || authInitialized) {
          clearTimeout(globalTimeout)
          return
        }
        
        if (sessionError || !session?.user) {
          console.warn("Session fetch error or no session:", sessionError)
          clearAuthState()
          userRef.current = null
          userProfileRef.current = null
          authInitialized = true
          clearTimeout(globalTimeout)
          setIsLoading(false)
          return
        }

        // Validate session with getUser() - with timeout
        const userPromise = supabase.auth.getUser()
        const userTimeoutPromise = new Promise<{ data: { user: null }, error: { message: 'Timeout' } }>((resolve) => {
          setTimeout(() => resolve({ data: { user: null }, error: { message: 'Timeout' } }), 5000)
        })
        
        const { data: { user }, error: userError } = await Promise.race([
          userPromise,
          userTimeoutPromise
        ]) as any
        
        if (!isMounted || authInitialized) {
          clearTimeout(globalTimeout)
          return
        }
        
        if (userError || !user) {
          console.warn("Session validation failed:", userError?.message || "No user")
          clearAuthState()
          userRef.current = null
          userProfileRef.current = null
          authInitialized = true
          clearTimeout(globalTimeout)
          setIsLoading(false)
          return
        }
        
        // Session is valid - set user
        setUser(user)
        userRef.current = user
        
        // Fetch profile with retry logic (but with shorter timeout)
        const profile = await fetchProfileWithRetry(user.id, 2, 8000)
        
        if (!isMounted || authInitialized) {
          clearTimeout(globalTimeout)
          return
        }
        
        if (profile) {
          setUserProfile(profile)
          userProfileRef.current = profile
          setProfileError(false)
        } else {
          console.warn("Failed to fetch user profile after retries - invalidating session")
          setProfileError(true)
          // CRITICAL: If profile fetch fails, invalidate the session
          // This prevents users from being stuck with a user but no profile
          clearAuthState()
          userRef.current = null
          userProfileRef.current = null
          // Sign out to clear potentially corrupted session
          supabase.auth.signOut().catch(err => {
            console.error("Error signing out after profile fetch failure:", err)
          })
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        if (!isMounted || authInitialized) {
          clearTimeout(globalTimeout)
          return
        }
        clearAuthState()
        userRef.current = null
        userProfileRef.current = null
      } finally {
        if (isMounted && !authInitialized) {
          authInitialized = true
          clearTimeout(globalTimeout)
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
            const isNewSignIn = currentUserId !== newUserId

            if (isNewSignIn) {
              // User changed - set user immediately
              setUser(session.user)
              userRef.current = session.user
              // CRITICAL: Set loading to true when new user signs in to show loading state
              setIsLoading(true)
            } else if (event === 'SIGNED_IN') {
              // Same user but SIGNED_IN event - ensure user state is set
              // This handles re-sign-ins or session refreshes
              setUser(session.user)
              userRef.current = session.user
              setIsLoading(true)
            }
            
            // Always try to fetch profile (it might have been updated)
            // Use retry logic with shorter timeout to prevent long hangs
            const profile = await fetchProfileWithRetry(session.user.id, 2, 8000)
            
            if (!isMounted) return
            
            if (profile) {
              setUserProfile(profile)
              userProfileRef.current = profile
              setProfileError(false)
              
              // CRITICAL: Always clear loading state after successful profile fetch
              setIsLoading(false)
              
              // CRITICAL: Always notify waiters on successful profile load
              // This ensures sign-in dialogs can close even if it's the same user
              // The waitForAuthStateChange polling will also detect this, but this is faster
              authStateChangeResolversRef.current.forEach(resolve => resolve(true))
              authStateChangeResolversRef.current.clear()
            } else {
              // Profile fetch failed
              console.warn("Failed to fetch user profile in auth state change")
              setProfileError(true)
              
              // CRITICAL: Still clear loading state even on failure
              // This ensures the UI doesn't get stuck in loading state
              setIsLoading(false)
              
              // CRITICAL: If profile fetch fails during SIGNED_IN, invalidate session after a delay
              // This prevents users from being stuck with a user but no profile
              if (event === 'SIGNED_IN') {
                // Give it one more chance after a short delay, then invalidate if still failed
                setTimeout(async () => {
                  if (!isMounted) return
                  
                  // Check if profile was loaded in the meantime
                  if (userProfileRef.current) {
                    return // Profile was loaded, no need to invalidate
                  }
                  
                  // Try one more time with a quick fetch
                  try {
                    const retryProfile = await fetchProfileWithRetry(session.user.id, 1, 5000)
                    if (retryProfile) {
                      setUserProfile(retryProfile)
                      userProfileRef.current = retryProfile
                      setProfileError(false)
                      authStateChangeResolversRef.current.forEach(resolve => resolve(true))
                      authStateChangeResolversRef.current.clear()
                      return
                    }
                  } catch (err) {
                    console.warn("Retry profile fetch failed:", err)
                  }
                  
                  // Still no profile - invalidate session to prevent stuck state
                  console.warn("Profile fetch failed after retry - invalidating session to prevent stuck state")
                  clearAuthState()
                  userRef.current = null
                  userProfileRef.current = null
                  setIsLoading(false)
                  
                  // Sign out to clear potentially corrupted session
                  supabase.auth.signOut().catch(err => {
                    console.error("Error signing out after profile fetch failure:", err)
                  })
                  
                  // Notify waiters of failure
                  authStateChangeResolversRef.current.forEach(resolve => resolve(false))
                  authStateChangeResolversRef.current.clear()
                }, 3000) // Wait 3 seconds before invalidating
                
                // Notify waiters that profile fetch failed
                authStateChangeResolversRef.current.forEach(resolve => resolve(false))
                authStateChangeResolversRef.current.clear()
              }
            }
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

  // CRITICAL: Periodic check for stuck states (user exists but profile is null for too long)
  // This detects and fixes stuck loading loops where the user is authenticated but profile fetch keeps failing
  React.useEffect(() => {
    if (isLoading) return // Don't check while loading
    
    // Only check if we have a user but no profile
    if (!user || userProfile) return
    
    // Track when the stuck state started
    let stuckStateStartTime = Date.now()
    const MAX_STUCK_TIME = 30000 // 30 seconds - if stuck for this long, invalidate session
    
    // Check periodically if still stuck
    const checkInterval = setInterval(() => {
      // If we now have a profile, exit (effect will re-run and clear interval)
      if (userProfileRef.current) {
        clearInterval(checkInterval)
        return
      }
      
      // If we don't have a user anymore, exit (effect will re-run and clear interval)
      if (!userRef.current) {
        clearInterval(checkInterval)
        return
      }
      
      // Check how long we've been stuck
      const stuckDuration = Date.now() - stuckStateStartTime
      
      if (stuckDuration > MAX_STUCK_TIME) {
        // We've been stuck for too long - invalidate the session
        console.warn(`Stuck state detected: user exists but no profile for ${Math.round(stuckDuration / 1000)}s - invalidating session`)
        
        // Clear the interval first
        clearInterval(checkInterval)
        
        // Clear state
        clearAuthState()
        userRef.current = null
        userProfileRef.current = null
        setIsLoading(false)
        
        // Sign out to clear potentially corrupted session
        supabase.auth.signOut().catch(err => {
          console.error("Error signing out stuck session:", err)
        })
      }
    }, 5000) // Check every 5 seconds
    
    return () => {
      clearInterval(checkInterval)
    }
  }, [user, userProfile, isLoading, clearAuthState])

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
