-- =============================================
-- FIX POST HIERARCHY FOREIGN KEY
-- Ensures the self-referential FK is properly configured and visible to PostgREST
-- =============================================

BEGIN;

-- First, ensure the column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'parent_post_id'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN parent_post_id UUID;
  END IF;
END $$;

-- Drop existing constraint if it exists (to recreate cleanly)
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_parent_post_id_fkey CASCADE;

-- Add the self-referential foreign key with explicit naming
ALTER TABLE public.posts
  ADD CONSTRAINT posts_parent_post_id_fkey
  FOREIGN KEY (parent_post_id)
  REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON public.posts(parent_post_id) WHERE parent_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_depth ON public.posts(depth);

-- Add depth column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'posts' 
    AND column_name = 'depth'
  ) THEN
    ALTER TABLE public.posts ADD COLUMN depth INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;