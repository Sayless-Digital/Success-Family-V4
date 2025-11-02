-- =============================================
-- REMOVE VIEW COUNT
-- View count is not needed
-- =============================================

-- Drop the view_count column from posts
ALTER TABLE public.posts DROP COLUMN IF EXISTS view_count;