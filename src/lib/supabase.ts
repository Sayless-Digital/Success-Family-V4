import { createBrowserClient } from '@supabase/ssr'
import { env } from './env'

// Browser client for client-side operations using cookies (required for SSR)
// CRITICAL: Configure for proper session persistence and realtime auth state changes
// This ensures mobile sign-ins work correctly and sessions persist across reloads
// Supabase SSR uses cookies automatically - no need to configure storage
export const supabase = createBrowserClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Use PKCE flow for better security and mobile compatibility
      flowType: 'pkce',
    },
    global: {
      headers: {
        // CRITICAL: Add proper Accept headers to fix 406 errors
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    },
    // Add realtime configuration for better channel reliability
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)
