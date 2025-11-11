-- =============================================
-- FIX BOOST_POST TO USE COMBINED BALANCE AND EARNINGS
-- Allows users to boost posts using both points_balance and earnings_points
-- Credits earnings to post author (not points_balance)
-- =============================================

-- Update boost_post function to use debit_user_points and credit_user_earnings
CREATE OR REPLACE FUNCTION public.boost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
  v_boost_id UUID;
  v_ledger_id UUID;
  v_amount_ttd NUMERIC(12,2);
  v_user_value_per_point NUMERIC;
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

  -- Create boost record first
  INSERT INTO public.post_boosts (post_id, user_id)
  VALUES (p_post_id, p_user_id)
  RETURNING id INTO v_boost_id;

  -- Use a nested block for error handling - if anything fails, delete the boost
  BEGIN
    -- Debit 1 point from user's combined balance (points_balance + earnings_points)
    -- This function handles spending from both balances automatically
    -- We use PERFORM since we don't need the return values, just the side effect
    PERFORM * FROM public.debit_user_points(p_user_id, 1);

    -- Create transaction record for the spend
    INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
    VALUES (p_user_id, 'point_spend', -1, v_post_author_id, 'verified', NOW());

    -- Get user_value_per_point from platform settings to calculate amount_ttd
    SELECT user_value_per_point INTO v_user_value_per_point
    FROM public.platform_settings
    WHERE id = 1;

    IF v_user_value_per_point IS NULL THEN
      RAISE EXCEPTION 'Platform settings not configured';
    END IF;

    -- Calculate amount_ttd: points * user_value_per_point
    v_amount_ttd := ROUND(COALESCE(v_user_value_per_point, 0) * 1, 2);

    -- Credit earnings to post author (immediately available)
    -- Note: Unboost is only allowed within 60 seconds, so earnings are immediately available
    -- The 60-second restriction is enforced by unboost_post function, not by delaying earnings
    v_ledger_id := public.credit_user_earnings(
      v_post_author_id,           -- p_user_id UUID
      1::BIGINT,                  -- p_points BIGINT
      v_amount_ttd,               -- p_amount_ttd NUMERIC (required!)
      'boost'::TEXT,              -- p_source_type TEXT (must match constraint)
      v_boost_id,                 -- p_source_id UUID
      NULL,                       -- p_community_id UUID (optional, NULL for boosts)
      0::INTEGER,                 -- p_available_delay_seconds INTEGER (0 = immediately available)
      jsonb_build_object(
        'boost_id', v_boost_id,
        'post_id', p_post_id,
        'from_user_id', p_user_id,
        'unboost_window_seconds', 60
      )::JSONB                    -- p_metadata JSONB (includes unboost window info)
    );

    -- Update boost record with earnings_ledger_id
    UPDATE public.post_boosts
    SET earnings_ledger_id = v_ledger_id
    WHERE id = v_boost_id;

    v_result := json_build_object(
      'boosted', true,
      'message', 'Post boosted successfully'
    );

    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      -- If anything fails, delete the boost record and re-raise the exception
      DELETE FROM public.post_boosts WHERE id = v_boost_id;
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update unboost_post function to reverse earnings properly
CREATE OR REPLACE FUNCTION public.unboost_post(
  p_post_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_boost RECORD;
  v_result JSON;
BEGIN
  -- Get boost record with earnings_ledger_id and author info
  SELECT
    pb.id,
    pb.created_at,
    pb.earnings_ledger_id,
    posts.author_id AS post_author_id
  INTO v_boost
  FROM public.post_boosts pb
  JOIN public.posts ON posts.id = pb.post_id
  WHERE pb.post_id = p_post_id AND pb.user_id = p_user_id;

  IF v_boost.id IS NULL THEN
    RAISE EXCEPTION 'You have not boosted this post';
  END IF;

  -- Check if boost is within 1 minute (60 seconds)
  IF (EXTRACT(EPOCH FROM (NOW() - v_boost.created_at))) > 60 THEN
    RAISE EXCEPTION 'Cannot unboost after 1 minute';
  END IF;

  -- Delete the boost record
  DELETE FROM public.post_boosts
  WHERE id = v_boost.id;

  -- Ensure wallet exists for user
  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Refund 1 point to booster's points_balance
  UPDATE public.wallets
  SET points_balance = points_balance + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create transaction record for refund
  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
  VALUES (p_user_id, 'point_refund', 1, p_user_id, 'verified', NOW());

  -- Reverse the earnings entry if it exists (this handles the author's earnings)
  IF v_boost.earnings_ledger_id IS NOT NULL THEN
    PERFORM public.reverse_earnings_entry(v_boost.earnings_ledger_id, 'post_unboost');
  END IF;

  v_result := json_build_object(
    'boosted', false,
    'message', 'Post unboosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.boost_post IS 'Boost a post by transferring 1 point from user (from combined balance: points_balance + earnings_points) to post author as earnings (immediately available). Unboost is only allowed within 60 seconds. Cannot boost own posts or boost same post twice.';
COMMENT ON FUNCTION public.unboost_post IS 'Unboost a post within 1 minute of boosting. Returns point to user points_balance and reverses author earnings entry.';

