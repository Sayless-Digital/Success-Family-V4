-- =============================================
-- LEARN PAGE VIDEO FLAG
-- Adds flag to mark videos as learn page videos and makes community_id nullable
-- =============================================

-- Add is_learn_page_video flag
ALTER TABLE public.uploaded_videos
  ADD COLUMN IF NOT EXISTS is_learn_page_video BOOLEAN NOT NULL DEFAULT false;

-- Make community_id nullable for learn page videos
ALTER TABLE public.uploaded_videos
  ALTER COLUMN community_id DROP NOT NULL;

-- Add constraint: if is_learn_page_video is true, community_id must be null
-- If is_learn_page_video is false, community_id must not be null
ALTER TABLE public.uploaded_videos
  ADD CONSTRAINT check_learn_page_video_community
  CHECK (
    (is_learn_page_video = true AND community_id IS NULL) OR
    (is_learn_page_video = false AND community_id IS NOT NULL)
  );

-- Create index for learn page videos
CREATE INDEX IF NOT EXISTS idx_uploaded_videos_is_learn_page ON public.uploaded_videos(is_learn_page_video) WHERE is_learn_page_video = true;

COMMENT ON COLUMN public.uploaded_videos.is_learn_page_video IS 'True if this video is for the learn page (not tied to a community)';




