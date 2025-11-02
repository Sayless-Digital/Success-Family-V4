-- =============================================
-- REMOVE POST CATEGORIES SYSTEM
-- Rollback categories functionality
-- =============================================

-- Drop triggers first
DROP TRIGGER IF EXISTS update_post_categories_updated_at ON public.post_categories;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS public.post_category_assignments CASCADE;
DROP TABLE IF EXISTS public.post_categories CASCADE;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.generate_category_slug(TEXT, UUID);
DROP FUNCTION IF EXISTS public.create_default_post_categories(UUID, UUID);