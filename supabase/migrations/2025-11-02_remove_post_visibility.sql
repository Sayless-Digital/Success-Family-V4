-- =============================================
-- REMOVE POST VISIBILITY SETTINGS
-- Make all posts public by default
-- =============================================

-- Drop RLS policies that depend on visibility column
DROP POLICY IF EXISTS "Anyone can view public posts in active communities" ON public.posts;
DROP POLICY IF EXISTS "Community members can view members-only posts" ON public.posts;
DROP POLICY IF EXISTS "Authors can view their own draft posts" ON public.posts;
DROP POLICY IF EXISTS "Anyone can view media for visible posts" ON public.post_media;

-- Update all existing posts to be public (before dropping column)
UPDATE public.posts SET visibility = 'public' WHERE visibility IS NOT NULL;

-- Drop the visibility column with CASCADE
ALTER TABLE public.posts DROP COLUMN IF EXISTS visibility CASCADE;

-- Drop the enum type
DROP TYPE IF EXISTS post_visibility;

-- Recreate simplified RLS policies
CREATE POLICY "Anyone can view posts in active communities"
  ON public.posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = posts.community_id
        AND c.is_active = true
    )
  );

-- Recreate simplified policy for post_media
CREATE POLICY "Anyone can view post media"
  ON public.post_media
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      INNER JOIN public.communities c ON c.id = p.community_id
      WHERE p.id = post_media.post_id
        AND c.is_active = true
    )
  );