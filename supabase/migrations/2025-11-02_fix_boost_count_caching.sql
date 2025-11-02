-- Fix get_post_boost_count to be VOLATILE instead of STABLE
-- This ensures it always returns fresh data for real-time updates

DROP FUNCTION IF EXISTS public.get_post_boost_count(UUID);

CREATE OR REPLACE FUNCTION public.get_post_boost_count(p_post_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.post_boosts WHERE post_id = p_post_id;
$$ LANGUAGE sql VOLATILE;

COMMENT ON FUNCTION public.get_post_boost_count IS 'Get current boost count for a post. Marked as VOLATILE to ensure fresh data for real-time updates.';