-- =============================================
-- RENAME LIKES TO BOOSTS
-- Comprehensive migration to rename all like-related tables, 
-- columns, functions, and add 1-minute un-boost restriction
-- =============================================

-- 1. Rename post_likes table to post_boosts
ALTER TABLE public.post_likes RENAME TO post_boosts;

-- 2. Rename indexes
ALTER INDEX idx_post_likes_post_id RENAME TO idx_post_boosts_post_id;
ALTER INDEX idx_post_likes_user_id RENAME TO idx_post_boosts_user_id;

-- 3. Drop old functions
DROP FUNCTION IF EXISTS public.toggle_post_like(UUID, UUID);
DROP FUNCTION IF EXISTS public.get_post_like_count(UUID);
DROP FUNCTION IF EXISTS public.user_liked_post(UUID, UUID);

-- 4. Create new boost_post function with 1-minute restriction
CREATE OR REPLACE FUNCTION public.boost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
  v_user_balance BIGINT;
  v_result JSON;
BEGIN
  -- Get post author
  SELECT author_id INTO v_post_author_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_post_author_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Check if user is boosting their own post
  IF v_post_author_id = p_user_id THEN
    RAISE EXCEPTION 'Cannot boost your own post';
  END IF;

  -- Check if boost already exists
  IF EXISTS (
    SELECT 1 FROM public.post_boosts
    WHERE post_id = p_post_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'You have already boosted this post';
  END IF;

  -- Check if user has enough balance
  SELECT points_balance INTO v_user_balance
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF v_user_balance < 1 THEN
    RAISE EXCEPTION 'Insufficient balance to boost post';
  END IF;

  -- Add boost
  INSERT INTO public.post_boosts (post_id, user_id)
  VALUES (p_post_id, p_user_id);

  -- Deduct 1 point from booster
  UPDATE public.wallets
  SET points_balance = points_balance - 1
  WHERE user_id = p_user_id;

  -- Add 1 point to post author
  UPDATE public.wallets
  SET points_balance = points_balance + 1
  WHERE user_id = v_post_author_id;

  -- Create transaction records
  INSERT INTO public.transactions (user_id, type, points_delta, created_at)
  VALUES 
    (p_user_id, 'point_spend', -1, NOW()),
    (v_post_author_id, 'point_refund', 1, NOW());

  v_result := json_build_object(
    'boosted', true,
    'message', 'Post boosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create unboost_post function with 1-minute time restriction
CREATE OR REPLACE FUNCTION public.unboost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
  v_boost_created_at TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Get post author
  SELECT author_id INTO v_post_author_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_post_author_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- Check if boost exists and get created_at
  SELECT created_at INTO v_boost_created_at
  FROM public.post_boosts
  WHERE post_id = p_post_id AND user_id = p_user_id;

  IF v_boost_created_at IS NULL THEN
    RAISE EXCEPTION 'You have not boosted this post';
  END IF;

  -- Check if boost is within 1 minute (60 seconds)
  IF (EXTRACT(EPOCH FROM (NOW() - v_boost_created_at))) > 60 THEN
    RAISE EXCEPTION 'Cannot unboost after 1 minute';
  END IF;

  -- Remove boost
  DELETE FROM public.post_boosts
  WHERE post_id = p_post_id AND user_id = p_user_id;

  -- Return 1 point to booster
  UPDATE public.wallets
  SET points_balance = points_balance + 1
  WHERE user_id = p_user_id;

  -- Remove 1 point from post author
  UPDATE public.wallets
  SET points_balance = points_balance - 1
  WHERE user_id = v_post_author_id;

  -- Create transaction records
  INSERT INTO public.transactions (user_id, type, points_delta, created_at)
  VALUES 
    (p_user_id, 'point_refund', 1, NOW()),
    (v_post_author_id, 'point_spend', -1, NOW());

  v_result := json_build_object(
    'boosted', false,
    'message', 'Post unboosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create helper function: Get boost count for post
CREATE OR REPLACE FUNCTION public.get_post_boost_count(p_post_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM public.post_boosts WHERE post_id = p_post_id;
$$ LANGUAGE sql STABLE;

-- 7. Create helper function: Check if user boosted post
CREATE OR REPLACE FUNCTION public.user_boosted_post(p_post_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.post_boosts 
    WHERE post_id = p_post_id AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE;

-- 8. Create helper function: Check if user can unboost
CREATE OR REPLACE FUNCTION public.can_unboost_post(p_post_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.post_boosts 
    WHERE post_id = p_post_id 
      AND user_id = p_user_id
      AND (EXTRACT(EPOCH FROM (NOW() - created_at))) <= 60
  );
$$ LANGUAGE sql STABLE;

-- 9. Update RLS policies (rename references)
DROP POLICY IF EXISTS "Anyone can view likes" ON public.post_boosts;
DROP POLICY IF EXISTS "Users can like posts" ON public.post_boosts;
DROP POLICY IF EXISTS "Users can unlike their own likes" ON public.post_boosts;

CREATE POLICY "Anyone can view boosts"
  ON public.post_boosts
  FOR SELECT
  USING (true);

CREATE POLICY "Users can boost posts"
  ON public.post_boosts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unboost their own boosts within 1 minute"
  ON public.post_boosts
  FOR DELETE
  USING (
    auth.uid() = user_id AND
    (EXTRACT(EPOCH FROM (NOW() - created_at))) <= 60
  );

-- 10. Add comment to document the new system
COMMENT ON TABLE public.post_boosts IS 'Tracks post boosts (formerly likes). Users can boost posts by spending 1 point, which transfers to the post author. Un-boosting is allowed within 1 minute of boosting.';
COMMENT ON FUNCTION public.boost_post IS 'Boost a post by transferring 1 point from user to post author. Cannot boost own posts or boost same post twice.';
COMMENT ON FUNCTION public.unboost_post IS 'Unboost a post within 1 minute of boosting. Returns point to user and removes from author.';
COMMENT ON FUNCTION public.can_unboost_post IS 'Check if user can still unboost a post (within 1-minute window).';