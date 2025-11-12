-- =============================================
-- TRACK BOOST SOURCE FOR ACCURATE REVENUE CALCULATION
-- This migration updates the boost_post function to track whether points came from
-- point_balance (creates new liability) or earning_balance (just a transfer)
-- =============================================

-- Update boost_post function to track source of points (point_balance vs earning_balance)
-- and update earnings ledger metadata accordingly
CREATE OR REPLACE FUNCTION public.boost_post(
  p_post_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
  v_boost_id UUID;
  v_result JSON;
  v_wallet_spent BIGINT;
  v_earnings_spent BIGINT;
  v_ledger_id UUID;
  v_boost_source TEXT; -- 'point_balance' or 'earning_balance'
  v_user_value_per_point NUMERIC;
  v_amount_ttd NUMERIC(12,2);
BEGIN
  SELECT author_id INTO v_post_author_id
  FROM public.posts
  WHERE id = p_post_id;

  IF v_post_author_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post_author_id = p_user_id THEN
    RAISE EXCEPTION 'Cannot boost your own post';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.post_boosts
    WHERE post_id = p_post_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'You have already boosted this post';
  END IF;

  INSERT INTO public.post_boosts (post_id, user_id)
  VALUES (p_post_id, p_user_id)
  RETURNING id INTO v_boost_id;

  BEGIN
    -- Debit points from user (prioritizes point_balance over earning_balance)
    SELECT wallet_points_spent, earnings_points_spent
    INTO v_wallet_spent, v_earnings_spent
    FROM public.debit_user_points(p_user_id, 1);

    -- Determine the source of the boost
    -- If wallet_points_spent > 0, points came from point_balance (creates new liability)
    -- If earnings_points_spent > 0, points came from earning_balance (just a transfer)
    IF v_wallet_spent > 0 THEN
      v_boost_source := 'point_balance';
    ELSE
      v_boost_source := 'earning_balance';
    END IF;

    -- Create transaction record
    INSERT INTO public.transactions (
      user_id, 
      type, 
      points_delta, 
      recipient_user_id, 
      status, 
      created_at,
      context
    )
    VALUES (
      p_user_id, 
      'point_spend', 
      -1, 
      v_post_author_id, 
      'verified', 
      now(),
      jsonb_build_object(
        'boost_source', v_boost_source,
        'wallet_points_spent', v_wallet_spent,
        'earnings_points_spent', v_earnings_spent,
        'boost_id', v_boost_id,
        'post_id', p_post_id
      )
    );

    -- Credit earnings to post author
    -- Include boost_source in metadata so we can track whether this is a new liability or transfer
    -- Get user_value_per_point for calculating amount_ttd
    SELECT user_value_per_point INTO v_user_value_per_point
    FROM public.platform_settings
    WHERE id = 1;
    
    v_amount_ttd := ROUND(COALESCE(v_user_value_per_point, 0) * 1, 2);
    
    -- Call credit_user_earnings with the correct signature
    -- Signature: (p_user_id, p_points, p_amount_ttd, p_source_type, p_source_id, p_community_id, p_available_delay_seconds, p_metadata)
    v_ledger_id := public.credit_user_earnings(
      v_post_author_id, -- p_user_id
      1, -- p_points
      v_amount_ttd, -- p_amount_ttd
      'boost', -- p_source_type (changed from 'post_boost' to match database)
      v_boost_id, -- p_source_id
      NULL, -- p_community_id
      60, -- p_available_delay_seconds (60 second hold period)
      jsonb_build_object(
        'boost_id', v_boost_id,
        'post_id', p_post_id,
        'from_user_id', p_user_id,
        'boost_source', v_boost_source, -- Track whether points came from point_balance or earning_balance
        'wallet_points_spent', v_wallet_spent,
        'earnings_points_spent', v_earnings_spent,
        'is_transfer', CASE WHEN v_boost_source = 'earning_balance' THEN true ELSE false END
      ) -- p_metadata
    );

    UPDATE public.post_boosts
    SET ledger_entry_id = v_ledger_id
    WHERE id = v_boost_id;

    v_result := json_build_object(
      'boosted', true,
      'message', 'Post boosted successfully'
    );

    RETURN v_result;
  EXCEPTION
    WHEN OTHERS THEN
      DELETE FROM public.post_boosts WHERE id = v_boost_id;
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.boost_post IS 'Boost a post by transferring 1 point from user (from combined balance: points_balance + earnings_points) to post author as earnings. Tracks whether points came from point_balance (creates new liability) or earning_balance (just a transfer). Unboost is only allowed within 60 seconds. Cannot boost own posts or boost same post twice.';

-- Add comment to wallet_earnings_ledger.metadata to explain boost_source tracking
COMMENT ON COLUMN public.wallet_earnings_ledger.metadata IS 'JSONB metadata. For boost earnings, includes: boost_source (point_balance or earning_balance), is_transfer (true if from earning_balance), wallet_points_spent, earnings_points_spent';

