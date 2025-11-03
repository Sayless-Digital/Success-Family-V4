-- Batch functions for boost counts and status to eliminate N+1 queries
-- These functions return data for multiple posts in a single call

-- 1. Batch function: Get boost counts for multiple posts
CREATE OR REPLACE FUNCTION public.get_posts_boost_counts(p_post_ids UUID[])
RETURNS TABLE(post_id UUID, boost_count INTEGER) AS $$
  SELECT 
    p.id AS post_id,
    COALESCE(COUNT(pb.id), 0)::INTEGER AS boost_count
  FROM unnest(p_post_ids) AS p(id)
  LEFT JOIN public.post_boosts pb ON pb.post_id = p.id
  GROUP BY p.id;
$$ LANGUAGE sql VOLATILE;

COMMENT ON FUNCTION public.get_posts_boost_counts IS 'Get boost counts for multiple posts in a single query. Returns post_id and boost_count pairs.';

-- 2. Batch function: Get which posts a user has boosted
CREATE OR REPLACE FUNCTION public.get_user_boosted_posts(p_post_ids UUID[], p_user_id UUID)
RETURNS TABLE(post_id UUID, user_has_boosted BOOLEAN, can_unboost BOOLEAN) AS $$
  SELECT 
    p.id AS post_id,
    EXISTS(SELECT 1 FROM public.post_boosts WHERE post_id = p.id AND user_id = p_user_id) AS user_has_boosted,
    EXISTS(
      SELECT 1 FROM public.post_boosts 
      WHERE post_id = p.id 
        AND user_id = p_user_id
        AND (EXTRACT(EPOCH FROM (NOW() - created_at))) <= 60
    ) AS can_unboost
  FROM unnest(p_post_ids) AS p(id);
$$ LANGUAGE sql VOLATILE;

COMMENT ON FUNCTION public.get_user_boosted_posts IS 'Get boost status for multiple posts for a specific user. Returns post_id, user_has_boosted, and can_unboost status.';

