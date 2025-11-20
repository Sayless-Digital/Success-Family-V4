-- =============================================
-- IMPROVED SCORING ALGORITHMS
-- Fixes: normalization, better recency decay, weight balancing, batch processing
-- =============================================

-- 1. BATCH FUNCTION: Calculate For You scores for multiple posts
-- This eliminates N+1 queries by calculating all scores in a single call
CREATE OR REPLACE FUNCTION calculate_for_you_scores_batch(
  p_user_id UUID,
  p_post_ids UUID[]
) RETURNS TABLE(post_id UUID, score NUMERIC) AS $$
  WITH post_metadata AS (
    SELECT 
      p.id AS post_id,
      p.community_id,
      p.author_id,
      COALESCE(p.published_at, p.created_at) AS published_at,
      EXTRACT(EPOCH FROM (NOW() - COALESCE(p.published_at, p.created_at))) / 3600.0 AS hours_since_published
    FROM unnest(p_post_ids) AS pid
    INNER JOIN public.posts p ON p.id = pid
  ),
  muted_posts AS (
    SELECT DISTINCT pm.post_id
    FROM post_metadata pm
    INNER JOIN public.post_topics pt ON pt.post_id = pm.post_id
    INNER JOIN public.user_topic_preferences utp ON utp.topic_id = pt.topic_id
    WHERE utp.user_id = p_user_id
      AND utp.preference = 'mute'
  ),
  topic_scores AS (
    SELECT 
      pm.post_id,
      COALESCE(SUM(
        CASE 
          WHEN utp.preference = 'follow' THEN 10.0
          ELSE 0
        END
      ), 0) AS followed_topics_score,
      COALESCE(COUNT(DISTINCT CASE WHEN t.is_featured THEN pt.topic_id END) * 2.0, 0) AS featured_topics_bonus
    FROM post_metadata pm
    LEFT JOIN public.post_topics pt ON pt.post_id = pm.post_id
    LEFT JOIN public.user_topic_preferences utp ON utp.topic_id = pt.topic_id AND utp.user_id = p_user_id
    LEFT JOIN public.topics t ON t.id = pt.topic_id
    WHERE utp.preference = 'follow' OR t.is_featured = true
    GROUP BY pm.post_id
  ),
  implicit_topic_scores AS (
    SELECT 
      pm.post_id,
      COALESCE(COUNT(DISTINCT pt2.topic_id) * 3.0, 0) AS implicit_score
    FROM post_metadata pm
    INNER JOIN public.post_topics pt2 ON pt2.post_id = pm.post_id
    INNER JOIN public.post_topics pt1 ON pt1.topic_id = pt2.topic_id
    INNER JOIN public.post_boosts pb ON pb.post_id = pt1.post_id
    WHERE pb.user_id = p_user_id
      AND pt1.post_id != pm.post_id
    GROUP BY pm.post_id
  ),
  author_affinity AS (
    SELECT 
      pm.post_id,
      LEAST(COUNT(*)::NUMERIC / 10.0, 1.0) * 15.0 AS affinity_score
    FROM post_metadata pm
    INNER JOIN public.post_boosts pb ON pb.user_id = p_user_id
    INNER JOIN public.posts p ON p.id = pb.post_id
    WHERE p.author_id = pm.author_id
    GROUP BY pm.post_id
  ),
  community_boost AS (
    SELECT 
      pm.post_id,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM public.community_members cm
          WHERE cm.community_id = pm.community_id
            AND cm.user_id = p_user_id
        ) THEN 10.0
        ELSE 0
      END AS boost_score
    FROM post_metadata pm
  ),
  raw_scores AS (
    SELECT 
      pm.post_id,
      -- Topic match (normalized to 0-30 range)
      LEAST((COALESCE(ts.followed_topics_score, 0) + COALESCE(ts.featured_topics_bonus, 0) + COALESCE(its.implicit_score, 0)) * 1.5, 30.0) AS topic_score,
      -- Author affinity (normalized to 0-15 range)
      COALESCE(aa.affinity_score, 0) AS author_score,
      -- Community boost (0-10 range)
      COALESCE(cb.boost_score, 0) AS community_score,
      -- Recency with logarithmic decay (normalized to 0-20 range)
      LEAST(20.0 / (1.0 + LN(GREATEST(pm.hours_since_published, 0.1) + 1.0)), 20.0) AS recency_score
    FROM post_metadata pm
    LEFT JOIN topic_scores ts ON ts.post_id = pm.post_id
    LEFT JOIN implicit_topic_scores its ON its.post_id = pm.post_id
    LEFT JOIN author_affinity aa ON aa.post_id = pm.post_id
    LEFT JOIN community_boost cb ON cb.post_id = pm.post_id
  )
  SELECT 
    rs.post_id,
    CASE 
      WHEN EXISTS (SELECT 1 FROM muted_posts mp WHERE mp.post_id = rs.post_id) THEN 0.0
      ELSE LEAST(rs.topic_score + rs.author_score + rs.community_score + rs.recency_score, 100.0)
    END AS score
  FROM raw_scores rs
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION calculate_for_you_scores_batch IS 'Batch calculate For You scores for multiple posts. Returns normalized scores 0-100. Muted posts return 0.';

-- 2. IMPROVED SINGLE POST FUNCTION (for backward compatibility)
CREATE OR REPLACE FUNCTION calculate_for_you_score(
  p_user_id UUID,
  p_post_id UUID
) RETURNS NUMERIC AS $$
  SELECT score
  FROM calculate_for_you_scores_batch(p_user_id, ARRAY[p_post_id])
  LIMIT 1
$$ LANGUAGE sql STABLE;

-- 3. Create index to speed up implicit topic matching
CREATE INDEX IF NOT EXISTS idx_post_topics_topic_post 
  ON public.post_topics(topic_id, post_id);




