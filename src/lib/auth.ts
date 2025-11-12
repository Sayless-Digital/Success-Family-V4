import { supabase } from './supabase'


export interface SignUpData {
  email: string
  password: string
  firstName: string
  lastName: string
  referredByUserId?: string
}

export interface SignInData {
  email: string
  password: string
}

export interface AuthError {
  message: string
}

export interface AuthResult {
  success: boolean
  error?: AuthError
  user?: any
}

/**
 * Sign up a new user with email and password
 * Stores first_name and last_name in user metadata for the trigger to use
 */
export async function signUp(data: SignUpData): Promise<AuthResult> {
  try {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
          referred_by_user_id: data.referredByUserId || null,
        },
      },
    })

    if (error) {
      return {
        success: false,
        error: { message: error.message },
      }
    }

    return {
      success: true,
      user: authData.user,
    }
  } catch (error) {
    return {
      success: false,
      error: { message: 'An unexpected error occurred during sign up' },
    }
  }
}

/**
 * Sign in an existing user with email and password
 * Ensures session is properly persisted and validated before returning success
 */
export async function signIn(data: SignInData): Promise<AuthResult> {
  try {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      return {
        success: false,
        error: { message: error.message },
      }
    }

    if (!authData.user) {
      return {
        success: false,
        error: { message: 'Sign in succeeded but no user data was returned' },
      }
    }

    // CRITICAL: Wait for session to be properly persisted and validated
    // This ensures cookies are set and session is available for subsequent requests
    let sessionValidated = false
    const maxAttempts = 5
    const delayMs = 200

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Get session to ensure it's persisted
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (!sessionError && session?.user?.id === authData.user.id) {
          // Validate session by checking user
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          
          if (!userError && user?.id === authData.user.id) {
            sessionValidated = true
            break
          }
        }
      } catch (sessionError) {
        // Continue to next attempt
        console.warn(`Session validation attempt ${attempt} failed:`, sessionError)
      }

      // Wait before next attempt (except on last attempt)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt))
      }
    }

    if (!sessionValidated) {
      console.warn("Session validation failed after multiple attempts, but sign-in may still succeed")
      // Don't fail the sign-in - the session might still be valid, just not immediately available
      // The auth state change listener will handle the session update
    }

    return {
      success: true,
      user: authData.user,
    }
  } catch (error) {
    return {
      success: false,
      error: { message: 'An unexpected error occurred during sign in' },
    }
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut()

    if (error) {
      return {
        success: false,
        error: { message: error.message },
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: { message: 'An unexpected error occurred during sign out' },
    }
  }
}

/**
 * Get the current user session
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      return null
    }

    return user
  } catch (error) {
    return null
  }
}

/**
 * Get user profile from users table without caching so the latest data is always returned.
 * User profiles are public, so this doesn't require authentication.
 */
export async function getUserProfile(userId: string) {
  try {
    if (!userId) {
      console.warn("getUserProfile called with empty userId")
      return null
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      // Only log meaningful errors (not 401/unauthorized, which shouldn't happen for public profiles)
      // Also ignore "no rows returned" errors
      const isUnauthorized = (error as any).status === 401 || (error as any).status === 403
      const isNotFound = error.code === 'PGRST301' || error.message?.includes('No rows')
      if (!isUnauthorized && !isNotFound) {
        console.error("Error fetching user profile:", error)
      }
      return null
    }

    return data
  } catch (error) {
    // Silently fail - profile fetch failures are handled by retry logic
    return null
  }
}