-- =============================================
-- REMOVE POST TITLES
-- Posts will only have content
-- =============================================

-- Drop the title column from posts
ALTER TABLE public.posts DROP COLUMN IF EXISTS title;