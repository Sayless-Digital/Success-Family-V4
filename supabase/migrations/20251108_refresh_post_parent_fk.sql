-- =============================================
-- REFRESH POST HIERARCHY RELATIONSHIP
-- Ensures parent_post_id foreign key is present and visible to PostgREST
-- =============================================

BEGIN;

-- Drop and recreate the self-referential foreign key to guarantee consistency
ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_parent_post_id_fkey;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_parent_post_id_fkey
  FOREIGN KEY (parent_post_id)
  REFERENCES public.posts(id)
  ON DELETE CASCADE;

-- Force PostgREST to reload the schema cache so the relationship is immediately available
NOTIFY pgrst, 'reload schema';

COMMIT;







