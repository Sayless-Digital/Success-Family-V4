import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from './src/lib/env'

export async function middleware(request: NextRequest) {
  // Create response object once - this will be updated with cookies as needed
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Update request cookies (for subsequent reads in this middleware)
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value)
            })
            // Update response cookies (to persist session)
            // CRITICAL: Update existing response, don't create a new one
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
              supabaseResponse.cookies.set(name, value, cookieOptions)
            })
          },
        },
      }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()
    // This call refreshes the session and updates cookies via setAll callback
    // The setAll callback is invoked during getUser() when cookies need updating
    // We must await getUser() to ensure session refresh completes
    try {
      // Await getUser() with a timeout to prevent middleware from hanging
      // Use Promise.race to ensure we don't block navigation forever
      // Reduced timeout to 5 seconds for faster page loads
      const getUserPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<{ data: { user: null }, error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ 
          data: { user: null }, 
          error: { message: 'Timeout' } 
        }), 5000) // 5 second timeout - balance between reliability and speed
      })
      
      const result = await Promise.race([getUserPromise, timeoutPromise])
      
      // If we got a timeout, try to refresh the session one more time
      // This helps with edge cases where the first call was slow
      if (result && 'error' in result && result.error?.message === 'Timeout') {
        // Don't await - let it run in background, but don't block
        supabase.auth.getUser().catch(() => {
          // Silently fail - we already timed out once
        })
      }
    } catch (error) {
      // Log error but don't block navigation
      // Cookies may have been set via setAll callback before timeout/error
      // Navigation should continue even if session refresh didn't complete
      if (process.env.NODE_ENV === 'development') {
        console.warn('Middleware: getUser() error (non-blocking):', error)
      }
    }

    // Add cache-busting headers for HTML pages
    const pathname = request.nextUrl.pathname
    const isHTMLPage = !pathname.startsWith('/_next') && 
                       !pathname.startsWith('/api') && 
                       !pathname.includes('.') &&
                       !pathname.startsWith('/sw.js') &&
                       !pathname.startsWith('/manifest.webmanifest')

    if (isHTMLPage) {
      supabaseResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
      supabaseResponse.headers.set('Pragma', 'no-cache')
      supabaseResponse.headers.set('Expires', '0')
    }

    return supabaseResponse
  } catch (error) {
    console.error('Middleware error:', error)
    // Return response even on error to prevent blocking navigation
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    /*
     * Match request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static assets (images, fonts, etc.)
     * - Service worker and manifest files
     * 
     * This reduces unnecessary auth checks on static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
}

