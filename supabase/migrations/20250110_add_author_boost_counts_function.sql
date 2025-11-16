-- Function to get total boost counts for authors (for low-visibility detection)
CREATE OR REPLACE FUNCTION public.get_authors_total_boost_counts(p_author_ids UUID[])
RETURNS TABLE(author_id UUID, total_boost_count BIGINT) AS $$
  SELECT 
    u.id AS author_id,
    COALESCE(SUM(boost_counts.boost_count), 0)::BIGINT AS total_boost_count
  FROM unnest(p_author_ids) AS u(id)
  LEFT JOIN (
    SELECT 
      p.author_id,
      COUNT(pb.id)::BIGINT AS boost_count
    FROM public.posts p
    LEFT JOIN public.post_boosts pb ON pb.post_id = p.id
    WHERE p.depth = 0
    GROUP BY p.id, p.author_id
  ) boost_counts ON boost_counts.author_id = u.id
  GROUP BY u.id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.get_authors_total_boost_counts IS 'Get total boost counts across all posts for multiple authors. Used for identifying low-visibility creators.';














