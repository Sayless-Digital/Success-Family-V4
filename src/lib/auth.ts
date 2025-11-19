import { supabase } from './supabase'
import { env } from './env'
import type { User } from '@supabase/supabase-js'

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
  user?: User | null
}

function resolveAppBaseUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin
  }

  return env.NEXT_PUBLIC_APP_URL || null
}

function buildOAuthRedirectUrl() {
  const baseUrl = resolveAppBaseUrl()
  if (!baseUrl) {
    return undefined
  }

  try {
    const redirectUrl = new URL('/auth/callback', baseUrl)
    if (typeof window !== 'undefined') {
      const nextPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const sanitizedNext = nextPath && nextPath.startsWith('/') ? nextPath : '/'
      redirectUrl.searchParams.set('next', sanitizedNext || '/')
    }

    return redirectUrl.toString()
  } catch {
    return undefined
  }
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
 * Supabase's signInWithPassword returns the session immediately on success.
 * The session is automatically persisted in cookies via @supabase/ssr.
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

    // ✅ TRUST SUPABASE: If signInWithPassword succeeds, the session is valid
    // @supabase/ssr automatically handles cookie persistence
    // No need for complex validation - Supabase guarantees session is available
    
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
 * Begin the Google OAuth flow using Supabase
 * Automatically handles redirects and cookie persistence
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const redirectTo = buildOAuthRedirectUrl()
    const options: Parameters<typeof supabase.auth.signInWithOAuth>[0]["options"] = {
      queryParams: {
        prompt: 'select_account',
      },
    }

    if (redirectTo) {
      options.redirectTo = redirectTo
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options,
    })

    if (error) {
      return {
        success: false,
        error: { message: error.message },
      }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: { message: 'Failed to start Google sign in. Please try again.' },
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