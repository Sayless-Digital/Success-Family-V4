-- Allow anonymous users to read platform_settings
-- This is needed for the homepage to cache platform settings without authentication

-- Enable RLS if not already enabled (idempotent)
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;

-- Create policy to allow anyone to read platform_settings
CREATE POLICY "Anyone can view platform settings"
  ON public.platform_settings
  FOR SELECT
  USING (true);













