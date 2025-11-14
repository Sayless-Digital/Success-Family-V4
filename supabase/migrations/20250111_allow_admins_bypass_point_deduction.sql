-- =============================================
-- ALLOW ADMINS TO BYPASS POINT DEDUCTION
-- Admins can post voice notes and create lives without points
-- =============================================

-- Update deduct_points_for_voice_notes to skip deduction for admins
CREATE OR REPLACE FUNCTION public.deduct_points_for_voice_notes(
  p_user_id UUID,
  p_point_cost BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_user_balance BIGINT;
  v_user_role user_role;
  v_result JSON;
BEGIN
  -- Check if user is admin
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = p_user_id;

  -- If admin, skip point deduction
  IF v_user_role = 'admin' THEN
    v_result := json_build_object(
      'success', true,
      'points_deducted', 0,
      'remaining_balance', NULL,
      'message', 'Points deduction skipped for admin user'
    );
    RETURN v_result;
  END IF;

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

-- Update deduct_points_for_stream_creation to skip deduction for admins
CREATE OR REPLACE FUNCTION public.deduct_points_for_stream_creation(
  p_user_id UUID,
  p_event_id UUID,
  p_point_cost BIGINT
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
  v_user_role user_role;
BEGIN
  IF p_point_cost IS NULL OR p_point_cost <= 0 THEN
    RAISE EXCEPTION 'Point cost must be greater than zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.community_events
    WHERE id = p_event_id
      AND owner_id = p_user_id
      AND status = 'scheduled'
      AND points_charged = 0
  ) THEN
    RAISE EXCEPTION 'Event not found, not owned by user, or already charged';
  END IF;

  -- Check if user is admin
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = p_user_id;

  -- If admin, skip point deduction but still mark event as charged
  IF v_user_role = 'admin' THEN
    UPDATE public.community_events
    SET points_charged = 0, -- Mark as 0 to indicate no charge
        updated_at = now()
    WHERE id = p_event_id;
    
    -- Return a dummy transaction ID (we'll use the event ID as a placeholder)
    RETURN p_event_id;
  END IF;

  -- For non-admin users, proceed with normal point deduction
  PERFORM public.debit_user_points(p_user_id, p_point_cost);

  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
  VALUES (p_user_id, 'point_spend', -p_point_cost, NULL, 'verified', now())
  RETURNING id INTO v_tx_id;

  UPDATE public.community_events
  SET points_charged = p_point_cost,
      updated_at = now()
  WHERE id = p_event_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions (already granted, but ensuring they're in place)
GRANT EXECUTE ON FUNCTION public.deduct_points_for_voice_notes(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_points_for_stream_creation(UUID, UUID, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.deduct_points_for_voice_notes IS 'Deducts points from user wallet for voice note creation. 1 point per voice note. Admins bypass point deduction.';
COMMENT ON FUNCTION public.deduct_points_for_stream_creation IS 'Deducts points from user wallet for stream creation. Admins bypass point deduction.';




