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
async function fetchProfileWithRetry(userId: string, maxRetries = 3, timeout = 10000): Promise<User | null> {
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

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`Profile fetch failed after ${maxRetries} attempts:`, error)
      } else {
        console.warn(`Profile fetch attempt ${attempt} failed:`, error)
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    }
  }
  
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
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

  // Use refs to track state and detect changes
  const userRef = React.useRef<SupabaseUser | null>(null)
  const userProfileRef = React.useRef<User | null>(null)
  const authStateChangeResolversRef = React.useRef<Set<(value: boolean) => void>>(new Set())
  const stuckStateStartTimeRef = React.useRef<number | null>(null)
  const initializationCompleteRef = React.useRef(false)
  const initializationCompleteTimeRef = React.useRef<number | null>(null)

  // Update refs when state changes
  React.useEffect(() => {
    userRef.current = user
    userProfileRef.current = userProfile
  }, [user, userProfile])

  // Simplified waitForAuthStateChange - relies on auth state change events instead of polling
  const waitForAuthStateChange = React.useCallback((timeout = 20000): Promise<boolean> => {
    return new Promise((resolve) => {
      const initialUser = userRef.current
      const initialProfile = userProfileRef.current
      
      let resolved = false
      let timeoutId: NodeJS.Timeout | null = null
      
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }
      
      // Resolver that can be called by auth state change listener
      const resolver = (value: boolean) => {
        if (resolved) return
        resolved = true
        cleanup()
        authStateChangeResolversRef.current.delete(resolver)
        resolve(value)
      }
      
      authStateChangeResolversRef.current.add(resolver)
      
      // Fallback timeout - check final state
      timeoutId = setTimeout(() => {
        if (resolved) return
        
        resolved = true
        cleanup()
        authStateChangeResolversRef.current.delete(resolver)
        
        // Check if we have valid auth state
        const currentUser = userRef.current
        const currentProfile = userProfileRef.current
        const hasValidAuth = currentUser !== null && currentProfile !== null
        
        // Check if state changed from initial
        const userChanged = currentUser?.id !== initialUser?.id
        const profileLoaded = initialProfile === null && currentProfile !== null
        
        resolve(hasValidAuth && (userChanged || profileLoaded))
      }, timeout)
    })
  }, [])

  // Hydration effect
  React.useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Initialize auth state on mount
  React.useEffect(() => {
    if (!isHydrated) return

    let isMounted = true
    let authInitialized = false
    const MAX_INITIALIZATION_TIME = 10000

    // Mark initialization as not complete
    initializationCompleteRef.current = false

    const globalTimeout = setTimeout(() => {
      if (!authInitialized && isMounted) {
        console.warn("Auth initialization timeout - forcing completion")
        authInitialized = true
        initializationCompleteRef.current = true
        initializationCompleteTimeRef.current = Date.now()
        setIsLoading(false)
      }
    }, MAX_INITIALIZATION_TIME)

    const initializeAuth = async () => {
      try {
        // Use getUser() directly - it's more reliable than getSession() + getUser()
        // getUser() validates the session and refreshes tokens if needed
        // Mobile: Add retry logic for slower networks
        let user: SupabaseUser | null = null
        let userError: unknown = null
        const maxRetries = 2
        const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            const userPromise = supabase.auth.getUser()
            // Mobile: Longer timeout for slower networks
            const timeoutMs = isMobile && attempt > 0 ? 10000 : 6000
            const timeoutPromise = new Promise<{ data: { user: null }, error: { message: 'Timeout' } }>((resolve) => {
              setTimeout(() => resolve({ data: { user: null }, error: { message: 'Timeout' } }), timeoutMs)
            })
            
            const result = await Promise.race([
              userPromise,
              timeoutPromise
            ]) as { data: { user: SupabaseUser | null }, error: unknown } | { data: { user: null }, error: { message: string } }
            
            user = result.data?.user ?? null
            userError = result.error
            
            // If we got a user or a non-timeout error, break retry loop
            if (user || (userError && (userError as { message?: string })?.message !== 'Timeout')) {
              break
            }
            
            // If timeout and not last attempt, wait before retry
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
            }
          } catch (error) {
            userError = error
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
            }
          }
        }
        
        if (!isMounted || authInitialized) {
          clearTimeout(globalTimeout)
          return
        }
        
        if (userError || !user) {
          // No valid session - clear state and show as signed out
          clearAuthState()
          userRef.current = null
          userProfileRef.current = null
          authInitialized = true
          initializationCompleteRef.current = true
          initializationCompleteTimeRef.current = Date.now()
          clearTimeout(globalTimeout)
          setIsLoading(false)
          return
        }

        // Session is valid - set user immediately
        setUser(user)
        userRef.current = user
        
        // Fetch profile with retry logic
        const profile = await fetchProfileWithRetry(user.id, 3, 8000)
        
        if (!isMounted || authInitialized) {
          clearTimeout(globalTimeout)
          return
        }
        
        if (profile) {
          setUserProfile(profile)
          userProfileRef.current = profile
          setProfileError(false)
          // Reset stuck state timer if profile loads successfully
          stuckStateStartTimeRef.current = null
        } else {
          console.warn("Failed to fetch user profile after retries")
          setProfileError(true)
          // Don't sign out immediately - allow retry via stuck state detection
          stuckStateStartTimeRef.current = Date.now()
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
          initializationCompleteRef.current = true
          initializationCompleteTimeRef.current = Date.now()
          clearTimeout(globalTimeout)
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes - but ignore events until initialization completes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        // During initialization, only process explicit sign-outs
        // TOKEN_REFRESHED events are handled after initialization to avoid race conditions
        if (!initializationCompleteRef.current) {
          if (event === 'SIGNED_OUT') {
            clearAuthState()
            userRef.current = null
            userProfileRef.current = null
            setIsLoading(false)
            stuckStateStartTimeRef.current = null
            authStateChangeResolversRef.current.forEach(resolve => resolve(false))
            authStateChangeResolversRef.current.clear()
          }
          // Ignore other events during initialization - they'll be processed after init completes
          return
        }

        // After initialization, process all events normally
        try {
          if (event === 'SIGNED_OUT' || !session?.user) {
            clearAuthState()
            userRef.current = null
            userProfileRef.current = null
            setIsLoading(false)
            stuckStateStartTimeRef.current = null
            // Notify waiters
            authStateChangeResolversRef.current.forEach(resolve => resolve(false))
            authStateChangeResolversRef.current.clear()
            return
          }

          // For SIGNED_IN or TOKEN_REFRESHED events
          if (session.user) {
            const currentUserId = userRef.current?.id
            const newUserId = session.user.id
            const isNewSignIn = currentUserId !== newUserId
            const initCompleteTime = initializationCompleteTimeRef.current
            const timeSinceInit = initCompleteTime ? Date.now() - initCompleteTime : Infinity
            const isRecentInit = timeSinceInit < 200 // Within 200ms of initialization

            // If this is a TOKEN_REFRESHED event right after initialization and we have no user,
            // it's likely the middleware refreshed the session - treat it as a new sign-in
            if (event === 'TOKEN_REFRESHED' && !currentUserId && isRecentInit) {
              // This is likely a session refresh from middleware right after initialization
              // Treat it as a new sign-in to avoid flash
              setUser(session.user)
              userRef.current = session.user
              setIsLoading(true)
              
              // Fetch profile
              const profile = await fetchProfileWithRetry(session.user.id, 2, 8000)
              
              if (!isMounted) return
              
              if (profile) {
                setUserProfile(profile)
                userProfileRef.current = profile
                setProfileError(false)
                setIsLoading(false)
                stuckStateStartTimeRef.current = null
                
                // Notify waiters
                authStateChangeResolversRef.current.forEach(resolve => resolve(true))
                authStateChangeResolversRef.current.clear()
              } else {
                console.warn("Failed to fetch user profile in auth state change")
                setProfileError(true)
                setIsLoading(false)
                
                // Track stuck state start time
                if (!stuckStateStartTimeRef.current) {
                  stuckStateStartTimeRef.current = Date.now()
                }
                
                // Notify waiters of failure
                authStateChangeResolversRef.current.forEach(resolve => resolve(false))
                authStateChangeResolversRef.current.clear()
              }
            } else if (isNewSignIn || event === 'SIGNED_IN') {
              // New sign-in or explicit SIGNED_IN event
              setUser(session.user)
              userRef.current = session.user
              setIsLoading(true)
              
              // Fetch profile for new sign-ins
              const profile = await fetchProfileWithRetry(session.user.id, 2, 8000)
              
              if (!isMounted) return
              
              if (profile) {
                setUserProfile(profile)
                userProfileRef.current = profile
                setProfileError(false)
                setIsLoading(false)
                stuckStateStartTimeRef.current = null
                
                // Notify waiters
                authStateChangeResolversRef.current.forEach(resolve => resolve(true))
                authStateChangeResolversRef.current.clear()
              } else {
                console.warn("Failed to fetch user profile in auth state change")
                setProfileError(true)
                setIsLoading(false)
                
                // Track stuck state start time
                if (!stuckStateStartTimeRef.current) {
                  stuckStateStartTimeRef.current = Date.now()
                }
                
                // Notify waiters of failure
                authStateChangeResolversRef.current.forEach(resolve => resolve(false))
                authStateChangeResolversRef.current.clear()
              }
            } else if (event === 'TOKEN_REFRESHED' && currentUserId === newUserId) {
              // Token refreshed but user is the same - just update the user object silently
              // Don't change loading state or re-fetch profile if we already have it
              setUser(session.user)
              userRef.current = session.user
            }
          }
        } catch (error) {
          console.error("Error in auth state change handler:", error)
          setIsLoading(false)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [clearAuthState, isHydrated])

  // Stuck state detection - uses ref to track start time properly
  React.useEffect(() => {
    if (isLoading) return
    
    // Only check if we have a user but no profile
    if (!user || userProfile) {
      stuckStateStartTimeRef.current = null
      return
    }
    
    // Initialize stuck state timer if not already set
    if (!stuckStateStartTimeRef.current) {
      stuckStateStartTimeRef.current = Date.now()
    }
    
    const MAX_STUCK_TIME = 30000 // 30 seconds
    
    // Check periodically if still stuck
    const checkInterval = setInterval(() => {
      // If we now have a profile, exit
      if (userProfileRef.current) {
        stuckStateStartTimeRef.current = null
        clearInterval(checkInterval)
        return
      }
      
      // If we don't have a user anymore, exit
      if (!userRef.current) {
        stuckStateStartTimeRef.current = null
        clearInterval(checkInterval)
        return
      }
      
      // Check how long we've been stuck using ref (persists across re-renders)
      const startTime = stuckStateStartTimeRef.current
      if (!startTime) {
        clearInterval(checkInterval)
        return
      }
      
      const stuckDuration = Date.now() - startTime
      
      if (stuckDuration > MAX_STUCK_TIME) {
        console.warn(`Stuck state detected: user exists but no profile for ${Math.round(stuckDuration / 1000)}s - invalidating session`)
        
        clearInterval(checkInterval)
        stuckStateStartTimeRef.current = null
        
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
    }, 5000)
    
    return () => {
      clearInterval(checkInterval)
    }
  }, [user, userProfile, isLoading, clearAuthState])

  const handleSignOut = React.useCallback(async () => {
    try {
      clearAuthState()
      userRef.current = null
      userProfileRef.current = null
      setIsLoading(false)
      stuckStateStartTimeRef.current = null
      
      // Sign out from Supabase
      const signOutPromise = supabase.auth.signOut()
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 2000)
      })
      
      await Promise.race([signOutPromise, timeoutPromise])
    } catch (error) {
      console.error("Error signing out:", error)
      clearAuthState()
      userRef.current = null
      userProfileRef.current = null
      setIsLoading(false)
      stuckStateStartTimeRef.current = null
    }
  }, [clearAuthState])

  const refreshProfile = React.useCallback(async () => {
    if (!user) return
    
    try {
      const profile = await fetchProfileWithRetry(user.id)
      if (profile) {
        setUserProfile(profile)
        setProfileError(false)
        stuckStateStartTimeRef.current = null
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
      const { data, error } = await supabase
        .from('platform_settings')
        .select('user_value_per_point')
        .eq('id', 1)
        .maybeSingle<{ user_value_per_point: number | null }>()

      if (error) {
        const isUnauthorized = (error as { status?: number }).status === 401 || (error as { status?: number }).status === 403
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
      // Silently fail - platform settings are not critical
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
        setWalletBalance(null)
        setWalletEarningsBalance(null)
        setWalletLockedEarningsBalance(null)
        setNextTopupDueOn(null)
      }
      setWalletDataLoaded(true)
    } catch (error) {
      console.error('Error refreshing wallet balance:', error)
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

    refreshWalletBalance()

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
