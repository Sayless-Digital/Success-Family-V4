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
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    // Check active sessions and sets the user
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          const profile = await getUserProfile(session.user.id)
          
          // If profile doesn't exist, sign out (profile was deleted)
          if (!profile) {
            console.warn("User profile not found, signing out")
            await supabase.auth.signOut()
            setUser(null)
            setUserProfile(null)
          } else {
            setUser(session.user)
            setUserProfile(profile)
          }
        } else {
          setUser(null)
          setUserProfile(null)
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await getUserProfile(session.user.id)
          
          // If profile doesn't exist, sign out (profile was deleted)
          if (!profile) {
            console.warn("User profile not found, signing out")
            await supabase.auth.signOut()
            setUser(null)
            setUserProfile(null)
          } else {
            setUser(session.user)
            setUserProfile(profile)
          }
        } else {
          setUser(null)
          setUserProfile(null)
        }

        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setUserProfile(null)
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const value = {
    user,
    userProfile,
    isLoading,
    signOut: handleSignOut,
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