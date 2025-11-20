-- =============================================
-- FOR YOU ALGORITHM - PERSONALIZED FEED SCORING
-- Calculates personalized relevance score for posts
-- =============================================

-- Function to calculate "For You" score for a post
-- This is the MVP version with:
-- 1. Topic matching (followed topics)
-- 2. Mute filtering (exclude muted topics)
-- 3. Community boost (prioritize user's communities)
-- 4. Recency (newer posts rank higher)
CREATE OR REPLACE FUNCTION calculate_for_you_score(
  p_user_id UUID,
  p_post_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_score NUMERIC := 0;
  v_topic_match_score NUMERIC := 0;
  v_author_affinity_score NUMERIC := 0;
  v_community_boost NUMERIC := 0;
  v_recency_score NUMERIC := 0;
  v_has_muted_topic BOOLEAN := false;
  v_post_community_id UUID;
  v_post_author_id UUID;
  v_post_published_at TIMESTAMPTZ;
  v_hours_since_published NUMERIC;
BEGIN
  -- Get post metadata
  SELECT 
    community_id,
    author_id,
    published_at,
    COALESCE(published_at, created_at)
  INTO 
    v_post_community_id,
    v_post_author_id,
    v_post_published_at,
    v_post_published_at
  FROM public.posts
  WHERE id = p_post_id;
  
  -- If post doesn't exist, return 0
  IF v_post_community_id IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Check for muted topics (strong penalty - should filter out)
  SELECT EXISTS (
    SELECT 1
    FROM public.post_topics pt
    INNER JOIN public.user_topic_preferences utp ON utp.topic_id = pt.topic_id
    WHERE pt.post_id = p_post_id
      AND utp.user_id = p_user_id
      AND utp.preference = 'mute'
  ) INTO v_has_muted_topic;
  
  -- If post has muted topic, return very low score (effectively filters it out)
  IF v_has_muted_topic THEN
    RETURN -1000;
  END IF;
  
  -- 1. TOPIC MATCH SCORE (Weight: 3.0)
  -- Count followed topics that match this post
  SELECT COALESCE(SUM(
    CASE 
      WHEN utp.preference = 'follow' THEN 10.0
      ELSE 0
    END
  ), 0)
  INTO v_topic_match_score
  FROM public.post_topics pt
  INNER JOIN public.user_topic_preferences utp ON utp.topic_id = pt.topic_id
  WHERE pt.post_id = p_post_id
    AND utp.user_id = p_user_id
    AND utp.preference = 'follow';
  
  -- Add implicit topic interest from boosted posts
  -- If user has boosted posts with similar topics, add bonus
  v_topic_match_score := v_topic_match_score + (
    SELECT COALESCE(COUNT(DISTINCT pt2.topic_id) * 5.0, 0)
    FROM public.post_topics pt1
    INNER JOIN public.post_boosts pb ON pb.post_id = pt1.post_id
    INNER JOIN public.post_topics pt2 ON pt2.topic_id = pt1.topic_id
    WHERE pb.user_id = p_user_id
      AND pt2.post_id = p_post_id
      AND pt1.post_id != p_post_id
  );
  
  -- Add featured topic bonus
  v_topic_match_score := v_topic_match_score + (
    SELECT COALESCE(COUNT(*) * 2.0, 0)
    FROM public.post_topics pt
    INNER JOIN public.topics t ON t.id = pt.topic_id
    WHERE pt.post_id = p_post_id
      AND t.is_featured = true
  );
  
  -- Apply weight
  v_topic_match_score := v_topic_match_score * 3.0;
  
  -- 2. AUTHOR AFFINITY SCORE (Weight: 2.5)
  -- Count how many times user has boosted this author
  SELECT LEAST(COUNT(*)::NUMERIC / 5.0, 1.0) * 10.0 * 2.5
  INTO v_author_affinity_score
  FROM public.post_boosts pb
  INNER JOIN public.posts p ON p.id = pb.post_id
  WHERE pb.user_id = p_user_id
    AND p.author_id = v_post_author_id;
  
  -- 3. COMMUNITY BOOST (Weight: 1.5)
  -- Check if user is a member of this post's community
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1
      FROM public.community_members cm
      WHERE cm.community_id = v_post_community_id
        AND cm.user_id = p_user_id
    ) THEN 8.0 * 1.5
    ELSE 0
  END INTO v_community_boost;
  
  -- 4. RECENCY SCORE (Weight: 1.0)
  -- Exponential decay: newer posts rank higher
  v_hours_since_published := EXTRACT(EPOCH FROM (NOW() - v_post_published_at)) / 3600.0;
  v_recency_score := (100.0 / (v_hours_since_published + 1.0)) * 1.0;
  
  -- Calculate final score
  v_score := v_topic_match_score + v_author_affinity_score + v_community_boost + v_recency_score;
  
  RETURN v_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create index to speed up topic preference lookups
CREATE INDEX IF NOT EXISTS idx_user_topic_preferences_user_topic 
  ON public.user_topic_preferences(user_id, topic_id);

-- Create index to speed up post_boosts lookups
CREATE INDEX IF NOT EXISTS idx_post_boosts_user_post 
  ON public.post_boosts(user_id, post_id);

-- Create index to speed up community_members lookups
CREATE INDEX IF NOT EXISTS idx_community_members_user_community 
  ON public.community_members(user_id, community_id);

