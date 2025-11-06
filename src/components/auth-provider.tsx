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
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshWalletBalance: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

// Helper function to fetch profile with retry logic
async function fetchProfileWithRetry(
  userId: string,
  maxRetries = 3,
  timeout = 10000
): Promise<User | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), timeout)
      })

      // Race between profile fetch and timeout
      const profile = await Promise.race([
        getUserProfile(userId),
        timeoutPromise
      ])

      if (profile) {
        return profile
      }

      // If profile is null but no error, wait before retry (except on last attempt)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }
    } catch (error) {
      console.error(`Profile fetch attempt ${attempt} failed:`, error)
      
      // Wait before retry (except on last attempt)
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
  const [isLoading, setIsLoading] = React.useState(true)
  const [profileError, setProfileError] = React.useState(false)

  // Helper to clear all auth state
  const clearAuthState = React.useCallback(() => {
    setUser(null)
    setUserProfile(null)
    setWalletBalance(null)
    setProfileError(false)
  }, [])

  // Use refs to access current state without causing re-subscriptions
  const userRef = React.useRef<SupabaseUser | null>(null)
  const userProfileRef = React.useRef<User | null>(null)

  // Update refs when state changes
  React.useEffect(() => {
    userRef.current = user
    userProfileRef.current = userProfile
  }, [user, userProfile])

  // Initialize auth state on mount
  React.useEffect(() => {
    let isMounted = true
    let authInitialized = false
    let isProcessingAuthChange = false

    // Get initial session
    const initializeAuth = async () => {
      try {
        // First, get session from cookies (fast, for instant UI)
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return

        if (session?.user) {
          // CRITICAL: Validate session with server using getUser()
          // This ensures the session is actually valid, not just cached in cookies
          const { data: { user }, error } = await supabase.auth.getUser()
          
          if (!isMounted) return
          
          if (error || !user) {
            // Session is invalid - clear state (stale cookies)
            console.warn("Session validation failed:", error?.message || "No user")
            clearAuthState()
            userRef.current = null
            userProfileRef.current = null
            return
          }
          
          // Session is valid - set user
          setUser(user)
          userRef.current = user
          
          // Fetch profile with retry logic
          const profile = await fetchProfileWithRetry(user.id)
          
          if (!isMounted) return
          
          if (profile) {
            setUserProfile(profile)
            userProfileRef.current = profile
            setProfileError(false)
          } else {
            console.warn("Failed to fetch user profile after retries")
            setProfileError(true)
            // Don't sign out - keep user authenticated but show error state
          }
        } else {
          // No session, ensure state is cleared
          clearAuthState()
          userRef.current = null
          userProfileRef.current = null
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        if (isMounted) {
          clearAuthState()
          userRef.current = null
          userProfileRef.current = null
        }
      } finally {
        if (isMounted) {
          authInitialized = true
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        // Don't process auth changes until initial auth is complete
        if (!authInitialized) {
          // Queue the event to be processed after initialization
          // This prevents race conditions
          return
        }

        // Prevent concurrent auth state processing
        if (isProcessingAuthChange) {
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
            }
            
            // Always try to fetch profile (it might have been updated)
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
  }, [clearAuthState])

  const handleSignOut = React.useCallback(async () => {
    try {
      // Clear state immediately for better UX
      clearAuthState()
      userRef.current = null
      userProfileRef.current = null
      
      // Sign out from Supabase (this clears cookies server-side)
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        console.error("Sign out error:", error)
      }
      
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

  const refreshWalletBalance = React.useCallback(async () => {
    if (!user) {
      setWalletBalance(null)
      return
    }
    
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('points_balance')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (!error && data) {
        setWalletBalance(Number(data.points_balance))
      }
    } catch (error) {
      console.error('Error refreshing wallet balance:', error)
    }
  }, [user])

  // Real-time subscription for wallet balance
  React.useEffect(() => {
    if (!user) {
      setWalletBalance(null)
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
          const newBalance = (payload.new as any).points_balance
          setWalletBalance(Number(newBalance))
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [user, refreshWalletBalance])

  const value = {
    user,
    userProfile,
    walletBalance,
    isLoading,
    signOut: handleSignOut,
    refreshProfile,
    refreshWalletBalance,
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
