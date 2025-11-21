import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { env } from "@/lib/env"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const next = requestUrl.searchParams.get("next") || "/"
  const sanitizedNext = next.startsWith("/") ? next : "/"
  const redirectUrl = new URL(sanitizedNext, requestUrl.origin)
  const response = NextResponse.redirect(redirectUrl)

  if (code) {
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
              cookiesToSet.forEach(({ name, value, options }) => {
                // Ensure proper cookie options for security and persistence
                const cookieOptions = {
                  ...options,
                  // Set secure flag in production (HTTPS only)
                  secure: process.env.NODE_ENV === 'production',
                  // Use lax sameSite for better compatibility while maintaining security
                  sameSite: (options?.sameSite as 'lax' | 'strict' | 'none') || 'lax',
                  // Ensure httpOnly is set for auth cookies
                  httpOnly: options?.httpOnly ?? true,
                  // Set path to root for all auth cookies
                  path: options?.path || '/',
                }
                response.cookies.set(name, value, cookieOptions)
              })
            },
          },
        }
      )

      await supabase.auth.exchangeCodeForSession(code)
    } catch (error) {
      console.error("OAuth callback error:", error)
    }
  }

  return response
}

