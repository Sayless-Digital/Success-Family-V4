import { supabase } from './supabase'


export interface SignUpData {
  email: string
  password: string
  firstName: string
  lastName: string
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
 * Get user profile from users table with caching to prevent redundant fetches
 */
const profileCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5000 // 5 seconds cache

export async function getUserProfile(userId: string) {
  try {
    if (!userId) {
      console.warn("getUserProfile called with empty userId")
      return null
    }

    // Check cache first
    const cached = profileCache.get(userId)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error("Error fetching user profile:", error)
      // Return cached data if available, even if expired
      if (cached) {
        console.log("Returning stale cache due to error")
        return cached.data
      }
      return null
    }

    // Update cache
    if (data) {
      profileCache.set(userId, { data, timestamp: Date.now() })
    }

    return data
  } catch (error) {
    console.error("Exception in getUserProfile:", error)
    // Return cached data if available
    const cached = profileCache.get(userId)
    if (cached) {
      console.log("Returning stale cache due to exception")
      return cached.data
    }
    return null
  }
}