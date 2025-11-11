-- =============================================
-- FIX BOOST_POST TO USE COMBINED BALANCE
-- Allows users to boost posts using both points_balance and earnings_points
-- =============================================

-- Update boost_post function to use debit_user_points for combined balance
CREATE OR REPLACE FUNCTION public.boost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
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

  -- Debit 1 point from user's combined balance (points_balance + earnings_points)
  -- This function handles spending from both balances automatically
  -- We call it and let it handle the deduction (it will raise an exception if insufficient)
  PERFORM * FROM public.debit_user_points(p_user_id, 1);

  -- Add boost
  INSERT INTO public.post_boosts (post_id, user_id)
  VALUES (p_post_id, p_user_id);

  -- Add 1 point to post author's points_balance
  -- Ensure wallet exists for author
  INSERT INTO public.wallets (user_id, points_balance)
  VALUES (v_post_author_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET points_balance = points_balance + 1,
      updated_at = now()
  WHERE user_id = v_post_author_id;

  -- Create transaction records with recipient info
  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, created_at)
  VALUES 
    (p_user_id, 'point_spend', -1, v_post_author_id, NOW()),
    (v_post_author_id, 'point_refund', 1, NULL, NOW());

  v_result := json_build_object(
    'boosted', true,
    'message', 'Post boosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update unboost_post function to handle refunds properly
-- Refunds go back to points_balance (since we don't track which source was used)
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

  -- Ensure wallets exist
  INSERT INTO public.wallets (user_id, points_balance)
  VALUES (p_user_id, 0), (v_post_author_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Return 1 point to booster's points_balance
  UPDATE public.wallets
  SET points_balance = points_balance + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Remove 1 point from post author's points_balance
  UPDATE public.wallets
  SET points_balance = GREATEST(0, points_balance - 1),
      updated_at = now()
  WHERE user_id = v_post_author_id;

  -- Create transaction records with recipient info
  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, created_at)
  VALUES 
    (p_user_id, 'point_refund', 1, NULL, NOW()),
    (v_post_author_id, 'point_spend', -1, p_user_id, NOW());

  v_result := json_build_object(
    'boosted', false,
    'message', 'Post unboosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.boost_post IS 'Boost a post by transferring 1 point from user (from combined balance: points_balance + earnings_points) to post author. Cannot boost own posts or boost same post twice.';
COMMENT ON FUNCTION public.unboost_post IS 'Unboost a post within 1 minute of boosting. Returns point to user points_balance and removes from author points_balance.';

