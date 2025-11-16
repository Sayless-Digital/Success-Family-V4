-- Remove thumbnail_url column from event_recordings table
-- This migration removes thumbnail generation functionality

-- Drop the thumbnail_url column if it exists
ALTER TABLE public.event_recordings
  DROP COLUMN IF EXISTS thumbnail_url;

-- Verify the column was removed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'event_recordings' 
      AND column_name = 'thumbnail_url'
  ) THEN
    RAISE EXCEPTION 'thumbnail_url column still exists after drop operation';
  END IF;
END $$;




















