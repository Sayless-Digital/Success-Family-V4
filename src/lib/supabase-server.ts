import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { env } from './env'

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Ensure proper cookie options for security and persistence
              const cookieOptions = {
                ...options,
                // Set secure flag in production (HTTPS only)
                secure: process.env.NODE_ENV === 'production',
                // Use lax sameSite for better compatibility while maintaining security
                sameSite: (options?.sameSite as 'lax' | 'strict' | 'none') || 'lax',
                // Ensure httpOnly is set for auth cookies (Supabase handles this)
                httpOnly: options?.httpOnly ?? true,
                // Set path to root for all auth cookies
                path: options?.path || '/',
              }
              cookieStore.set(name, value, cookieOptions)
            })
          } catch (error) {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions, but log it for debugging
            if (process.env.NODE_ENV === 'development') {
              console.warn('Server Component cookie set failed (expected in some cases):', error)
            }
          }
        },
      },
    }
  )
}

/**
 * Creates a public Supabase client without cookies for use in cached functions.
 * This client can be used for public data queries that don't require authentication.
 * Use this in unstable_cache() functions since they can't access cookies().
 */
export const createPublicSupabaseClient = () => {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

/**
 * Creates a service role Supabase client that bypasses RLS.
 * Use this ONLY in server-side operations that need to bypass Row Level Security,
 * such as webhooks, cron jobs, or admin operations.
 * 
 * WARNING: This client has full access to your database. Use with caution.
 */
export const createServiceRoleSupabaseClient = () => {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured. This is required for service role operations.')
  }
  
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
