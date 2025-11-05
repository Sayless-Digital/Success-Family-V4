-- Fix event registration re-registration issue
-- When a user cancels and then re-registers, we should update the existing row
-- instead of trying to insert a new one (which violates the unique constraint)

CREATE OR REPLACE FUNCTION public.deduct_points_for_stream_join(
  p_user_id UUID,
  p_event_id UUID,
  p_point_cost BIGINT
)
RETURNS UUID AS $$
DECLARE
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_owner_id UUID;
  v_event_status TEXT;
  v_owner_points_before BIGINT;
  v_owner_points_after BIGINT;
  v_tx_id UUID;
  v_registration_id UUID;
  v_existing_registration_id UUID;
BEGIN
  -- Get event owner and status
  SELECT owner_id, status INTO v_owner_id, v_event_status
  FROM public.community_events
  WHERE id = p_event_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Check if event is available for registration (not completed or cancelled)
  -- Allow registration for 'scheduled' and 'live' events
  IF v_event_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Event is not available for registration (event is %). Only scheduled and live events can be registered for.', v_event_status;
  END IF;

  -- Check if already registered (active registration)
  IF EXISTS (SELECT 1 FROM public.event_registrations WHERE event_id = p_event_id AND user_id = p_user_id AND cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'Already registered for this event';
  END IF;

  -- Get user's current balance with row lock
  SELECT points_balance INTO v_points_before
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_points_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  IF v_points_before < p_point_cost THEN
    RAISE EXCEPTION 'Insufficient points. Required: %, Available: %', p_point_cost, v_points_before;
  END IF;

  v_points_after := v_points_before - p_point_cost;

  -- Get owner's current balance with row lock
  SELECT points_balance INTO v_owner_points_before
  FROM public.wallets
  WHERE user_id = v_owner_id
  FOR UPDATE;

  IF v_owner_points_before IS NULL THEN
    -- Create wallet for owner if it doesn't exist
    INSERT INTO public.wallets (user_id, points_balance)
    VALUES (v_owner_id, 0);
    v_owner_points_before := 0;
  END IF;

  v_owner_points_after := v_owner_points_before + p_point_cost;

  -- Create transaction for user (recipient is owner)
  -- Owner's earnings are tracked via recipient_user_id in this transaction
  INSERT INTO public.transactions (
    user_id,
    type,
    points_delta,
    recipient_user_id
  )
  VALUES (
    p_user_id,
    'point_spend',
    -p_point_cost,
    v_owner_id -- Goes to event owner (owner can query transactions where recipient_user_id = their_id)
  )
  RETURNING id INTO v_tx_id;

  -- Update user's wallet (deduct)
  UPDATE public.wallets
  SET points_balance = v_points_after,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Update owner's wallet (credit)
  UPDATE public.wallets
  SET points_balance = v_owner_points_after,
      updated_at = now()
  WHERE user_id = v_owner_id;

  -- Check if there's a cancelled registration for this event/user
  SELECT id INTO v_existing_registration_id
  FROM public.event_registrations
  WHERE event_id = p_event_id
    AND user_id = p_user_id
    AND cancelled_at IS NOT NULL;

  IF v_existing_registration_id IS NOT NULL THEN
    -- Update existing cancelled registration (re-registration)
    UPDATE public.event_registrations
    SET 
      points_charged = p_point_cost,
      registered_at = now(),
      cancelled_at = NULL,
      refunded_at = NULL,
      joined_at = NULL
    WHERE id = v_existing_registration_id
    RETURNING id INTO v_registration_id;
  ELSE
    -- Create new registration
    INSERT INTO public.event_registrations (event_id, user_id, points_charged)
    VALUES (p_event_id, p_user_id, p_point_cost)
    RETURNING id INTO v_registration_id;
  END IF;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

