-- =============================================
-- LEARN PAGE WEBINAR SETTINGS
-- Adds learn page video and redirect link settings, plus webinar signups table
-- =============================================

-- Add columns to platform_settings for learn page configuration
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS learn_page_video_id UUID REFERENCES public.uploaded_videos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS learn_page_redirect_link TEXT;

-- Create webinar_signups table
CREATE TABLE IF NOT EXISTS public.webinar_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  signup_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for webinar_signups
CREATE INDEX IF NOT EXISTS idx_webinar_signups_signup_date ON public.webinar_signups(signup_date DESC);
CREATE INDEX IF NOT EXISTS idx_webinar_signups_created_at ON public.webinar_signups(created_at DESC);

-- Enable RLS
ALTER TABLE public.webinar_signups ENABLE ROW LEVEL SECURITY;

-- RLS policies for webinar_signups
-- Allow public to insert (for signup form)
CREATE POLICY "Anyone can sign up for webinars"
  ON public.webinar_signups
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can view signups
CREATE POLICY "Admins can view webinar signups"
  ON public.webinar_signups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

COMMENT ON TABLE public.webinar_signups IS 'Tracks webinar signups from the learn page';
COMMENT ON COLUMN public.webinar_signups.country_code IS 'Country code for WhatsApp (e.g., "+1", "+44")';
COMMENT ON COLUMN public.webinar_signups.whatsapp_number IS 'Phone number without country code';
COMMENT ON COLUMN public.webinar_signups.signup_date IS 'Date of signup - tracks which day/form the signup was for';




