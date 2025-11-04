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

  // Initialize auth state on mount
  React.useEffect(() => {
    let isMounted = true
    let authInitialized = false

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return

        if (session?.user) {
          // Set user immediately
          setUser(session.user)
          
          // Fetch profile with retry logic
          const profile = await fetchProfileWithRetry(session.user.id)
          
          if (!isMounted) return
          
          if (profile) {
            setUserProfile(profile)
            setProfileError(false)
          } else {
            console.warn("Failed to fetch user profile after retries")
            setProfileError(true)
            // Don't sign out - keep user authenticated but show error state
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
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
        if (!authInitialized) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setUserProfile(null)
          setProfileError(false)
          return
        }

        if (session?.user) {
          // Set user immediately
          setUser(session.user)
          
          // Fetch profile with retry logic
          const profile = await fetchProfileWithRetry(session.user.id)
          
          if (!isMounted) return
          
          if (profile) {
            setUserProfile(profile)
            setProfileError(false)
          } else {
            console.warn("Failed to fetch user profile in auth state change")
            setProfileError(true)
            // Don't sign out automatically - this could be a temporary network issue
            // Only sign out if this is a new sign-in and profile doesn't exist
            if (event === 'SIGNED_IN') {
              console.error("New user sign-in but no profile found - signing out")
              await supabase.auth.signOut()
              setUser(null)
              setUserProfile(null)
            }
          }
        } else {
          setUser(null)
          setUserProfile(null)
          setProfileError(false)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setUserProfile(null)
    } catch (error) {
      console.error("Error signing out:", error)
      setUser(null)
      setUserProfile(null)
    }
  }

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
          const newBalance = (payload.new as any).points_balance
          setWalletBalance(Number(newBalance))
        }
      )
      .subscribe()

    return () => {
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
