// Environment variable validation
export function validateEnv() {
  const requiredEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  const optionalEnvVars = {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    GETSTREAM_API_KEY: process.env.GETSTREAM_API_KEY,
    GETSTREAM_API_SECRET: process.env.GETSTREAM_API_SECRET,
    NEXT_PUBLIC_GETSTREAM_API_KEY: process.env.NEXT_PUBLIC_GETSTREAM_API_KEY,
  }

  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value || value === 'your_supabase_project_url' || value === 'your_supabase_anon_key')
    .map(([key]) => key)

  if (missingVars.length > 0) {
    throw new Error(
      `Missing or invalid environment variables: ${missingVars.join(', ')}\n\n` +
      'Please check your .env file and ensure all Supabase variables are set correctly.\n' +
      'Visit: https://supabase.com/dashboard/project/_/settings/api'
    )
  }

  return { ...requiredEnvVars, ...optionalEnvVars }
}

// Get validated environment variables
export const env = validateEnv()
