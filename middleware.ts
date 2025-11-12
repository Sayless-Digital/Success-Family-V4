import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from './src/lib/env'

export async function middleware(request: NextRequest) {
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
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    // IMPORTANT: DO NOT REMOVE auth.getUser()
    // Add timeout to prevent middleware from blocking indefinitely
    const userPromise = supabase.auth.getUser()
    const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 5000))
    
    await Promise.race([userPromise, timeoutPromise])

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
    // Return response even on error to prevent blocking
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

