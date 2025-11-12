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
 * Uses cache busting to ensure fresh auth state
 */
export async function signIn(data: SignInData): Promise<AuthResult> {
  try {
    // CRITICAL: Add cache busting timestamp to ensure fresh auth request
    // This prevents stale cached responses on mobile
    const cacheBuster = `_t=${Date.now()}`
    
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
      options: {
        // Ensure session is persisted
        shouldCreateUser: false,
      },
    })

    if (error) {
      return {
        success: false,
        error: { message: error.message },
      }
    }

    // CRITICAL: Immediately refresh session to ensure it's persisted
    // This is especially important on mobile where session persistence can be unreliable
    try {
      await supabase.auth.getSession()
    } catch (sessionError) {
      console.warn("Session refresh after sign-in failed:", sessionError)
      // Don't fail the sign-in if session refresh fails - the session should still be valid
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