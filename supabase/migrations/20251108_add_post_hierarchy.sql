-- =============================================
-- ADD POST HIERARCHY SUPPORT
-- Adds parent linkage and depth tracking for nested posts
-- =============================================

-- Add hierarchy columns to posts table
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS parent_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0;

-- Ensure depth values align with hierarchy usage
ALTER TABLE public.posts
  ADD CONSTRAINT posts_depth_hierarchy_check
  CHECK (
    (parent_post_id IS NULL AND depth = 0)
    OR
    (parent_post_id IS NOT NULL AND depth > 0)
  );

-- Indexes to support lookups by parent and depth
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON public.posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_depth ON public.posts(depth);

-- Drop legacy comments table if it exists (replaced by hierarchical posts)
DROP TABLE IF EXISTS public.comments CASCADE;


















