-- =============================================
-- COMMUNITY UPLOADED VIDEOS
-- Adds uploaded_videos table, storage bucket, and updates storage tracking
-- =============================================

-- Create storage bucket for uploaded community videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-uploads',
  'community-uploads',
  true,
  524288000, -- 500MB limit (524288000 bytes) per object
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit,
  name = EXCLUDED.name,
  public = EXCLUDED.public;

-- Storage policies for community uploads
CREATE POLICY "Community videos can be uploaded by authenticated users"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'community-uploads');

CREATE POLICY "Community videos can be updated by authenticated users"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'community-uploads')
WITH CHECK (bucket_id = 'community-uploads');

CREATE POLICY "Community videos can be deleted by authenticated users"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'community-uploads');

CREATE POLICY "Community videos are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'community-uploads');

-- Create table to track uploaded videos
CREATE TABLE IF NOT EXISTS public.uploaded_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  storage_path TEXT,
  storage_url TEXT,
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_uploaded_videos_community_id ON public.uploaded_videos(community_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_videos_user_id ON public.uploaded_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_videos_created_at ON public.uploaded_videos(created_at DESC);

-- Keep updated_at fresh
DROP TRIGGER IF EXISTS set_uploaded_videos_updated_at ON public.uploaded_videos;
CREATE TRIGGER set_uploaded_videos_updated_at
  BEFORE UPDATE ON public.uploaded_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS
ALTER TABLE public.uploaded_videos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Community members can view uploaded videos"
  ON public.uploaded_videos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      LEFT JOIN public.community_members m
        ON m.community_id = c.id
        AND m.user_id = auth.uid()
      WHERE c.id = uploaded_videos.community_id
        AND (
          c.owner_id = auth.uid()
          OR m.id IS NOT NULL
        )
    )
  );

CREATE POLICY "Community owners can insert uploaded videos"
  ON public.uploaded_videos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = uploaded_videos.community_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Community owners can update uploaded videos"
  ON public.uploaded_videos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = uploaded_videos.community_id
        AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = uploaded_videos.community_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Community owners can delete uploaded videos"
  ON public.uploaded_videos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.communities c
      WHERE c.id = uploaded_videos.community_id
        AND c.owner_id = auth.uid()
    )
  );

-- Update storage calculation to include uploaded videos
CREATE OR REPLACE FUNCTION public.calculate_user_storage_usage(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  v_total_bytes BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size_bytes), 0) INTO v_total_bytes
  FROM (
    SELECT er.file_size_bytes
    FROM public.event_recordings er
    JOIN public.community_events ce ON ce.id = er.event_id
    WHERE ce.owner_id = p_user_id
      AND er.file_size_bytes IS NOT NULL
      AND er.file_size_bytes > 0

    UNION ALL

    SELECT uv.file_size_bytes
    FROM public.uploaded_videos uv
    WHERE uv.user_id = p_user_id
      AND uv.file_size_bytes IS NOT NULL
      AND uv.file_size_bytes > 0
  ) AS combined_sizes;

  RETURN v_total_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.uploaded_videos IS 'Community-managed video uploads stored in Supabase Storage';
COMMENT ON COLUMN public.uploaded_videos.storage_path IS 'Supabase Storage path (bucket/object)';
COMMENT ON COLUMN public.uploaded_videos.storage_url IS 'Public URL to the uploaded video';
COMMENT ON COLUMN public.uploaded_videos.file_size_bytes IS 'Size of the uploaded video in bytes';





