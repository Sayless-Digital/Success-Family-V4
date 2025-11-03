-- Fix transaction INSERTs in stream-related RPC functions
-- Remove amount_ttd and platform_fee_ttd from point_spend/point_refund transactions
-- (these columns are only for top_up transactions)

-- Fix deduct_points_for_stream_creation
CREATE OR REPLACE FUNCTION public.deduct_points_for_stream_creation(
  p_user_id UUID,
  p_event_id UUID,
  p_point_cost BIGINT
)
RETURNS UUID AS $$
DECLARE
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_tx_id UUID;
BEGIN
  -- Verify event exists and user is owner
  IF NOT EXISTS (
    SELECT 1 FROM public.community_events
    WHERE id = p_event_id
      AND owner_id = p_user_id
      AND status = 'scheduled'
      AND points_charged = 0
  ) THEN
    RAISE EXCEPTION 'Event not found, not owned by user, or already charged';
  END IF;

  -- Get current balance with row lock
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

  -- Create transaction (recipient is NULL = platform fee)
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
    NULL -- Goes to platform
  )
  RETURNING id INTO v_tx_id;

  -- Update wallet
  UPDATE public.wallets
  SET points_balance = v_points_after,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Update event with charged amount
  UPDATE public.community_events
  SET points_charged = p_point_cost,
      updated_at = now()
  WHERE id = p_event_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix deduct_points_for_stream_join
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
  v_owner_points_before BIGINT;
  v_owner_points_after BIGINT;
  v_tx_id UUID;
  v_registration_id UUID;
BEGIN
  -- Get event owner
  SELECT owner_id INTO v_owner_id
  FROM public.community_events
  WHERE id = p_event_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- Check if already registered
  IF EXISTS (SELECT 1 FROM public.event_registrations WHERE event_id = p_event_id AND user_id = p_user_id AND cancelled_at IS NULL) THEN
    RAISE EXCEPTION 'Already registered for this event';
  END IF;

  -- Check if event is scheduled
  IF NOT EXISTS (SELECT 1 FROM public.community_events WHERE id = p_event_id AND status = 'scheduled') THEN
    RAISE EXCEPTION 'Event is not available for registration';
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

  -- Create registration
  INSERT INTO public.event_registrations (event_id, user_id, points_charged)
  VALUES (p_event_id, p_user_id, p_point_cost)
  RETURNING id INTO v_registration_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix refund_event_registration
CREATE OR REPLACE FUNCTION public.refund_event_registration(
  p_registration_id UUID,
  p_refund_reason TEXT DEFAULT 'user_cancelled'
)
RETURNS UUID AS $$
DECLARE
  v_registration RECORD;
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_owner_points_before BIGINT;
  v_owner_points_after BIGINT;
  v_tx_id UUID;
BEGIN
  -- Get registration details
  SELECT 
    er.*,
    e.owner_id
  INTO v_registration
  FROM public.event_registrations er
  JOIN public.community_events e ON e.id = er.event_id
  WHERE er.id = p_registration_id
    AND er.cancelled_at IS NULL;

  IF v_registration IS NULL THEN
    RAISE EXCEPTION 'Registration not found or already cancelled';
  END IF;

  -- Get user's current balance with row lock
  SELECT points_balance INTO v_points_before
  FROM public.wallets
  WHERE user_id = v_registration.user_id
  FOR UPDATE;

  IF v_points_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  v_points_after := v_points_before + v_registration.points_charged;

  -- Get owner's current balance with row lock
  SELECT points_balance INTO v_owner_points_before
  FROM public.wallets
  WHERE user_id = v_registration.owner_id
  FOR UPDATE;

  IF v_owner_points_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for owner';
  END IF;

  IF v_owner_points_before < v_registration.points_charged THEN
    RAISE EXCEPTION 'Owner has insufficient balance for refund';
  END IF;

  v_owner_points_after := v_owner_points_before - v_registration.points_charged;

  -- Create refund transaction for user
  INSERT INTO public.transactions (
    user_id,
    type,
    points_delta,
    recipient_user_id
  )
  VALUES (
    v_registration.user_id,
    'point_refund',
    v_registration.points_charged,
    v_registration.user_id -- Refund to self
  )
  RETURNING id INTO v_tx_id;

  -- Create refund transaction for owner (deduct from owner)
  INSERT INTO public.transactions (
    user_id,
    type,
    points_delta,
    recipient_user_id
  )
  VALUES (
    v_registration.owner_id,
    'point_refund',
    -v_registration.points_charged,
    v_registration.user_id -- Refund goes back to user
  );

  -- Update user's wallet (refund)
  UPDATE public.wallets
  SET points_balance = v_points_after,
      updated_at = now()
  WHERE user_id = v_registration.user_id;

  -- Update owner's wallet (deduct)
  UPDATE public.wallets
  SET points_balance = v_owner_points_after,
      updated_at = now()
  WHERE user_id = v_registration.owner_id;

  -- Mark registration as cancelled
  UPDATE public.event_registrations
  SET cancelled_at = now(),
      refunded_at = now()
  WHERE id = p_registration_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix cancel_event_and_refund_all
CREATE OR REPLACE FUNCTION public.cancel_event_and_refund_all(
  p_event_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_event RECORD;
  v_registration RECORD;
  v_owner_points_before BIGINT;
  v_owner_points_after BIGINT;
  v_user_points_before BIGINT;
  v_user_points_after BIGINT;
  v_refunded_count INTEGER := 0;
BEGIN
  -- Get event details
  SELECT * INTO v_event
  FROM public.community_events
  WHERE id = p_event_id
    AND owner_id = auth.uid()
    AND status IN ('scheduled', 'live');

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found, not owned by you, or cannot be cancelled';
  END IF;

  -- Get owner's current balance with row lock
  SELECT points_balance INTO v_owner_points_before
  FROM public.wallets
  WHERE user_id = v_event.owner_id
  FOR UPDATE;

  IF v_owner_points_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for owner';
  END IF;

  -- Refund owner's creation cost if charged
  IF v_event.points_charged > 0 THEN
    v_owner_points_after := v_owner_points_before + v_event.points_charged;

    -- Create refund transaction
    INSERT INTO public.transactions (
      user_id,
      type,
      points_delta,
      recipient_user_id
    )
    VALUES (
      v_event.owner_id,
      'point_refund',
      v_event.points_charged,
      v_event.owner_id
    );

    -- Update wallet
    UPDATE public.wallets
    SET points_balance = v_owner_points_after,
        updated_at = now()
    WHERE user_id = v_event.owner_id;

    v_owner_points_before := v_owner_points_after; -- Update for next iteration
  END IF;

  -- Refund all active registrations
  FOR v_registration IN
    SELECT * FROM public.event_registrations
    WHERE event_id = p_event_id
      AND cancelled_at IS NULL
  LOOP
    -- Get user's current balance with row lock
    SELECT points_balance INTO v_user_points_before
    FROM public.wallets
    WHERE user_id = v_registration.user_id
    FOR UPDATE;

    IF v_user_points_before IS NOT NULL THEN
      v_user_points_after := v_user_points_before + v_registration.points_charged;

      -- Refund transaction for user
      INSERT INTO public.transactions (
        user_id,
        type,
        points_delta,
        recipient_user_id
      )
      VALUES (
        v_registration.user_id,
        'point_refund',
        v_registration.points_charged,
        v_registration.user_id
      );

      -- Deduct from owner's balance
      v_owner_points_before := v_owner_points_before - v_registration.points_charged;

      IF v_owner_points_before < 0 THEN
        RAISE EXCEPTION 'Owner has insufficient balance for refunds';
      END IF;

      -- Refund transaction for owner (deduct)
      INSERT INTO public.transactions (
        user_id,
        type,
        points_delta,
        recipient_user_id
      )
      VALUES (
        v_event.owner_id,
        'point_refund',
        -v_registration.points_charged,
        v_registration.user_id
      );

      -- Update user's wallet
      UPDATE public.wallets
      SET points_balance = v_user_points_after,
          updated_at = now()
      WHERE user_id = v_registration.user_id;

      v_refunded_count := v_refunded_count + 1;
    END IF;

    -- Mark registration as cancelled
    UPDATE public.event_registrations
    SET cancelled_at = now(),
        refunded_at = now()
    WHERE id = v_registration.id;
  END LOOP;

  -- Update owner's wallet with final balance
  UPDATE public.wallets
  SET points_balance = v_owner_points_before,
      updated_at = now()
  WHERE user_id = v_event.owner_id;

  -- Mark event as cancelled
  UPDATE public.community_events
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_event_id;

  RETURN json_build_object(
    'success', true,
    'event_refunded', v_event.points_charged > 0,
    'registrations_refunded', v_refunded_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

