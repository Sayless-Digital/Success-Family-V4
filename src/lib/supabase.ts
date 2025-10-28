import { createBrowserClient } from '@supabase/ssr'
import { env } from './env'

// Browser client for client-side operations using cookies (required for SSR)
export const supabase = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
