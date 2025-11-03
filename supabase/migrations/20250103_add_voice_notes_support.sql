-- =============================================
-- ADD VOICE NOTES SUPPORT
-- Adds function to deduct points for voice notes
-- =============================================

-- Function to deduct points for voice notes
CREATE OR REPLACE FUNCTION public.deduct_points_for_voice_notes(
  p_user_id UUID,
  p_point_cost BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_user_balance BIGINT;
  v_result JSON;
BEGIN
  -- Check if user exists and has wallet
  SELECT points_balance INTO v_user_balance
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF v_user_balance IS NULL THEN
    -- Create wallet if it doesn't exist
    INSERT INTO public.wallets (user_id, points_balance, updated_at)
    VALUES (p_user_id, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;
    
    SELECT points_balance INTO v_user_balance
    FROM public.wallets
    WHERE user_id = p_user_id;
  END IF;

  -- Check if user has enough balance
  IF v_user_balance < p_point_cost THEN
    RAISE EXCEPTION 'Insufficient balance to add voice note. You need % point(s).', p_point_cost;
  END IF;

  -- Deduct points
  UPDATE public.wallets
  SET points_balance = points_balance - p_point_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create transaction record (point goes to platform as fee)
  -- Using NULL as recipient_user_id to indicate platform (we can filter for voice notes by type)
  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, created_at)
  VALUES (p_user_id, 'point_spend', -p_point_cost, NULL, NOW());

  v_result := json_build_object(
    'success', true,
    'points_deducted', p_point_cost,
    'remaining_balance', v_user_balance - p_point_cost,
    'message', 'Points deducted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.deduct_points_for_voice_notes(UUID, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.deduct_points_for_voice_notes IS 'Deducts points from user wallet for voice note creation. 1 point per voice note.';

