import { createServerSupabaseClient } from './supabase-server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helper function to require authentication in API routes
 * Returns the authenticated user and supabase client or an error response
 * 
 * @returns Promise<{ user: User; supabase: SupabaseClient } | NextResponse> - User and client if authenticated, error response otherwise
 * 
 * @example
 * ```ts
 * export async function POST(request: NextRequest) {
 *   const authResult = await requireAuth()
 *   if (authResult instanceof NextResponse) {
 *     return authResult // Error response
 *   }
 *   const { user, supabase } = authResult
 *   // User is authenticated, continue with request
 * }
 * ```
 */
export async function requireAuth(): Promise<{ user: User; supabase: SupabaseClient } | NextResponse> {
  try {
    const supabase = await createServerSupabaseClient()
    
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return { user, supabase }
  } catch (error) {
    console.error('Error in requireAuth:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

