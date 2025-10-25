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
  // Initialize with null state to avoid SSR issues
  const [user, setUser] = React.useState<SupabaseUser | null>(null)
  const [userProfile, setUserProfile] = React.useState<User | null>(null)
  const [isLoading, setIsLoading] = React.useState(true) // Start with loading true to prevent flash
  const [refreshCount, setRefreshCount] = React.useState(0)
  const [isInitialized, setIsInitialized] = React.useState(false)
  const [isHydrated, setIsHydrated] = React.useState(false)

  // Handle client-side hydration and auth state restoration
  React.useEffect(() => {
    setIsHydrated(true)
    
    // Restore auth state from sessionStorage immediately after hydration
    // Only access sessionStorage after hydration is complete
    if (typeof window !== 'undefined') {
      try {
        const storedUser = sessionStorage.getItem('auth_user')
        const storedProfile = sessionStorage.getItem('auth_profile')
        
        if (storedUser && storedProfile) {
          const parsedUser = JSON.parse(storedUser)
          const parsedProfile = JSON.parse(storedProfile)
          
          if (parsedUser && parsedProfile) {
            setUser(parsedUser)
            setUserProfile(parsedProfile)
            setIsInitialized(true)
            setIsLoading(false) // Stop loading after restoring cached state
            return
          }
        }
      } catch (error) {
        console.warn('Failed to restore auth state:', error)
      }
    }
    
    // If no cached state found, set loading to false to allow normal auth flow
    setIsLoading(false)
  }, [])

  // Track page refreshes to detect the "third refresh" issue
  React.useEffect(() => {
    if (!isHydrated) return
    
    const handleBeforeUnload = () => {
      setRefreshCount(prev => prev + 1)
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isHydrated])

  // Persist auth state in sessionStorage to prevent re-initialization on navigation
  React.useEffect(() => {
    if (isInitialized && user && userProfile && isHydrated) {
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('auth_user', JSON.stringify(user))
          sessionStorage.setItem('auth_profile', JSON.stringify(userProfile))
        }
      } catch (error) {
        console.warn('Failed to persist auth state:', error)
      }
    }
  }, [user, userProfile, isInitialized, isHydrated])


  React.useEffect(() => {
    // Only run after hydration
    if (!isHydrated) return
    
        // Skip initialization if we already have valid cached data
        if (isInitialized && user && userProfile) {
          // Validate cached session with Supabase (run in background)
          const validateCachedSession = async () => {
            try {
              const { data: { session }, error } = await supabase.auth.getSession()
              if (error || !session) {
                // Cached session is invalid, clear it
                setUser(null)
                setUserProfile(null)
                setIsInitialized(false)
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('auth_user')
                  sessionStorage.removeItem('auth_profile')
                }
              }
            } catch (error) {
              console.warn('Failed to validate cached session:', error)
            }
          }
          
          // Run validation in background without blocking UI
          validateCachedSession()
          return
        }
    
    let isMounted = true
    let retryCount = 0
    const maxRetries = 3
    
    
    // Check active sessions and sets the user
    const initializeAuth = async () => {
      try {
        console.log(`Auth initialization attempt ${retryCount + 1}, refresh count: ${refreshCount}`)
        
        // If this is the third refresh or more, try to refresh the session first
        if (refreshCount >= 2) {
          console.log("Detected multiple refreshes, refreshing session...")
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) {
              console.warn("Session refresh failed:", refreshError)
            } else {
              console.log("Session refreshed successfully")
            }
          } catch (refreshErr) {
            console.warn("Session refresh exception:", refreshErr)
          }
        }
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error("Error getting session:", error)
          retryCount++
          if (retryCount < maxRetries && isMounted) {
            console.log(`Retrying auth initialization (${retryCount}/${maxRetries})`)
            setTimeout(initializeAuth, 1000 * retryCount) // Exponential backoff
            return
          }
          if (isMounted) {
            setUser(null)
            setUserProfile(null)
          }
          return
        }
        
        if (session?.user) {
          try {
            const profile = await getUserProfile(session.user.id)
            
            if (!isMounted) return
            
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
          } catch (profileError) {
            console.error("Error fetching user profile:", profileError)
            if (isMounted) {
              setUser(null)
              setUserProfile(null)
            }
          }
        } else {
          if (isMounted) {
            setUser(null)
            setUserProfile(null)
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        if (isMounted) {
          setUser(null)
          setUserProfile(null)
        }
      } finally {
        if (isMounted) {
          setIsInitialized(true)
          setIsLoading(false) // Stop loading after auth initialization
        }
      }
    }

    initializeAuth()

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Prevent multiple rapid state changes
        if (!isMounted) return
        
        console.log("Auth state change:", event, session?.user?.id)
        
        try {
          if (session?.user) {
            try {
              const profile = await getUserProfile(session.user.id)
              
              if (!isMounted) return
              
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
            } catch (profileError) {
              console.error("Error fetching user profile in auth change:", profileError)
              if (isMounted) {
                setUser(null)
                setUserProfile(null)
              }
            }
          } else {
            if (isMounted) {
              setUser(null)
              setUserProfile(null)
            }
          }
        } catch (error) {
          console.error("Error in auth state change:", error)
          if (isMounted) {
            setUser(null)
            setUserProfile(null)
          }
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [isInitialized, refreshCount, isHydrated])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setUser(null)
      setUserProfile(null)
      setIsInitialized(false)
      
      // Clear cached auth state
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('auth_user')
          sessionStorage.removeItem('auth_profile')
        }
      } catch (error) {
        console.warn('Failed to clear cached auth state:', error)
      }
    } catch (error) {
      console.error("Error signing out:", error)
      // Even if signOut fails, clear local state
      setUser(null)
      setUserProfile(null)
      setIsInitialized(false)
      
      // Clear cached auth state
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('auth_user')
          sessionStorage.removeItem('auth_profile')
        }
      } catch (clearError) {
        console.warn('Failed to clear cached auth state:', clearError)
      }
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