-- Ensure thumbnail_url column exists in event_recordings table
-- This migration is idempotent and safe to run multiple times

-- Add thumbnail_url column if it doesn't exist
ALTER TABLE public.event_recordings
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.event_recordings.thumbnail_url IS 'URL to the recording thumbnail image (stored in Supabase Storage or from Stream.io)';

-- Verify the column exists (this will fail if column doesn't exist, helping us catch issues)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'event_recordings' 
      AND column_name = 'thumbnail_url'
  ) THEN
    RAISE EXCEPTION 'thumbnail_url column was not created successfully';
  END IF;
END $$;

