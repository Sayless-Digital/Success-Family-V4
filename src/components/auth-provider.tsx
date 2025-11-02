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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = React.useState<User | null>(null)
  const [walletBalance, setWalletBalance] = React.useState<number | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Initialize auth state on mount
  React.useEffect(() => {
    let isMounted = true

    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return

        if (session?.user) {
          const profile = await getUserProfile(session.user.id)
          if (profile) {
            setUser(session.user)
            setUserProfile(profile)
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        if (session?.user) {
          const profile = await getUserProfile(session.user.id)
          if (profile) {
            setUser(session.user)
            setUserProfile(profile)
          } else {
            // Profile doesn't exist, sign out
            await supabase.auth.signOut()
            setUser(null)
            setUserProfile(null)
          }
        } else {
          setUser(null)
          setUserProfile(null)
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
      const profile = await getUserProfile(user.id)
      if (profile) {
        setUserProfile(profile)
      }
    } catch (error) {
      console.error('Error refreshing profile:', error)
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
