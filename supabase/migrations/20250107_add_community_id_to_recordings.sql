-- Add community_id to event_recordings to link recordings to communities
-- This allows recordings to be managed at the community level
ALTER TABLE public.event_recordings
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE;

-- Update existing recordings to have community_id from their event
UPDATE public.event_recordings er
SET community_id = ce.community_id
FROM public.community_events ce
WHERE er.event_id = ce.id
  AND er.community_id IS NULL;

-- Make community_id NOT NULL after backfilling
ALTER TABLE public.event_recordings
  ALTER COLUMN community_id SET NOT NULL;

-- Add index for faster queries by community
CREATE INDEX IF NOT EXISTS idx_event_recordings_community_id ON public.event_recordings(community_id);

-- Add additional fields for better recording metadata
ALTER TABLE public.event_recordings
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stream_recording_url TEXT, -- Direct Stream.io URL
  ADD COLUMN IF NOT EXISTS storage_url TEXT, -- Supabase Storage public URL
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT, -- Recording thumbnail
  ADD COLUMN IF NOT EXISTS is_processing BOOLEAN DEFAULT false; -- Whether recording is being processed/uploaded

