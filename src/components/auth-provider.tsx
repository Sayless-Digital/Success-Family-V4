"use client"

import * as React from "react"
import { User as SupabaseUser } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { User } from "@/types"
import { getUserProfile } from "@/lib/auth"

interface AuthContextType {
  user: SupabaseUser | null
  userProfile: User | null
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = React.useState<User | null>(null)
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

  const value = {
    user,
    userProfile,
    isLoading,
    signOut: handleSignOut,
    refreshProfile,
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
