-- =============================================
-- ADD BOOST REWARDS TO POST MEDIA
-- Adds requires_boost flag to lock content behind boosts
-- =============================================

-- Add requires_boost column to post_media table
ALTER TABLE public.post_media
ADD COLUMN IF NOT EXISTS requires_boost BOOLEAN DEFAULT false;

-- Create index for efficient queries on boost-locked media
CREATE INDEX IF NOT EXISTS idx_post_media_requires_boost ON public.post_media(requires_boost) WHERE requires_boost = true;

-- Add comment
COMMENT ON COLUMN public.post_media.requires_boost IS 'If true, this media item requires a boost to access. Currently used for voice notes.';












