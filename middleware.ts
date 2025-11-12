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
              supabaseResponse.cookies.set(name, value, options)
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
      const getUserPromise = supabase.auth.getUser()
      const timeoutPromise = new Promise<{ data: { user: null }, error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ 
          data: { user: null }, 
          error: { message: 'Timeout' } 
        }), 8000) // 8 second timeout - enough for session refresh
      })
      
      await Promise.race([getUserPromise, timeoutPromise])
    } catch (error) {
      // Log error but don't block navigation
      // Cookies may have been set via setAll callback before timeout/error
      // Navigation should continue even if session refresh didn't complete
      console.warn('Middleware: getUser() error (non-blocking):', error)
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

