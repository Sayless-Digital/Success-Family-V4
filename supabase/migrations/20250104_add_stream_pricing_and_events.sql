-- Add stream pricing fields to platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS stream_start_cost BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stream_join_cost BIGINT NOT NULL DEFAULT 1;

-- Create community_events table
CREATE TABLE IF NOT EXISTS public.community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  stream_call_id TEXT, -- GetStream call ID
  points_charged BIGINT NOT NULL DEFAULT 0, -- Amount charged to owner for starting
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on community_id for faster queries
CREATE INDEX IF NOT EXISTS idx_community_events_community_id ON public.community_events(community_id);
CREATE INDEX IF NOT EXISTS idx_community_events_owner_id ON public.community_events(owner_id);
CREATE INDEX IF NOT EXISTS idx_community_events_status ON public.community_events(status);
CREATE INDEX IF NOT EXISTS idx_community_events_scheduled_at ON public.community_events(scheduled_at);

-- Create event_registrations table
CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  points_charged BIGINT NOT NULL DEFAULT 0, -- Amount charged to user for joining
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ, -- When user actually joined the stream
  cancelled_at TIMESTAMPTZ, -- When registration was cancelled (refund issued)
  refunded_at TIMESTAMPTZ, -- When refund was processed
  UNIQUE(event_id, user_id)
);

-- Create indexes for event_registrations
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON public.event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_cancelled_at ON public.event_registrations(cancelled_at);

-- Create event_recordings table for saved playbacks
CREATE TABLE IF NOT EXISTS public.event_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  stream_recording_id TEXT NOT NULL, -- GetStream recording ID
  storage_path TEXT, -- Supabase Storage path if saved as post
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL, -- If saved as a post
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  saved_at TIMESTAMPTZ -- When saved as post
);

-- Create index for event_recordings
CREATE INDEX IF NOT EXISTS idx_event_recordings_event_id ON public.event_recordings(event_id);
CREATE INDEX IF NOT EXISTS idx_event_recordings_post_id ON public.event_recordings(post_id);

-- Enable RLS
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_recordings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_events
-- Anyone can view events in communities they can access
CREATE POLICY "Anyone can view events in accessible communities"
  ON public.community_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE communities.id = community_events.community_id
      AND communities.is_active = true
    )
  );

-- Owners can create events
CREATE POLICY "Community owners can create events"
  ON public.community_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE communities.id = community_events.community_id
      AND communities.owner_id = auth.uid()
    )
  );

-- Owners can update their events
CREATE POLICY "Event owners can update their events"
  ON public.community_events FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- RLS Policies for event_registrations
-- Users can view registrations for events they can access
CREATE POLICY "Users can view event registrations"
  ON public.event_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_events
      JOIN public.communities ON communities.id = community_events.community_id
      WHERE community_events.id = event_registrations.event_id
      AND communities.is_active = true
    )
  );

-- Users can register for events (they'll be charged via RPC)
CREATE POLICY "Users can register for events"
  ON public.event_registrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own registrations (for joined_at timestamp)
CREATE POLICY "Users can update their own registrations"
  ON public.event_registrations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for event_recordings
-- Anyone can view recordings for accessible events
CREATE POLICY "Anyone can view event recordings"
  ON public.event_recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.community_events
      JOIN public.communities ON communities.id = community_events.community_id
      WHERE community_events.id = event_recordings.event_id
      AND communities.is_active = true
    )
  );

-- Event owners can create recordings
CREATE POLICY "Event owners can create recordings"
  ON public.event_recordings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_events
      WHERE community_events.id = event_recordings.event_id
      AND community_events.owner_id = auth.uid()
    )
  );

-- Event owners can update their recordings
CREATE POLICY "Event owners can update recordings"
  ON public.event_recordings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_events
      WHERE community_events.id = event_recordings.event_id
      AND community_events.owner_id = auth.uid()
    )
  );

-- Function: Deduct points for stream creation (goes to platform)
-- Called when owner schedules/creates an event (upfront charge)
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

-- Function: Deduct points for stream join (transfers to event owner)
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
    RAISE EXCEPTION 'User already registered for this event';
  END IF;

  -- Get user's balance with row lock
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

  -- Get owner's balance with row lock
  SELECT points_balance INTO v_owner_points_before
  FROM public.wallets
  WHERE user_id = v_owner_id
  FOR UPDATE;

  IF v_owner_points_before IS NULL THEN
    -- Create wallet for owner if doesn't exist
    INSERT INTO public.wallets (user_id, points_balance)
    VALUES (v_owner_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
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
  INSERT INTO public.event_registrations (
    event_id,
    user_id,
    points_charged
  )
  VALUES (
    p_event_id,
    p_user_id,
    p_point_cost
  )
  RETURNING id INTO v_registration_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Refund event registration
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
  -- Get registration details with lock
  SELECT er.*, ce.owner_id
  INTO v_registration
  FROM public.event_registrations er
  JOIN public.community_events ce ON ce.id = er.event_id
  WHERE er.id = p_registration_id
    AND er.cancelled_at IS NULL
    AND er.refunded_at IS NULL
  FOR UPDATE;

  IF v_registration IS NULL THEN
    RAISE EXCEPTION 'Registration not found or already cancelled/refunded';
  END IF;

  -- Get user's balance with row lock
  SELECT points_balance INTO v_points_before
  FROM public.wallets
  WHERE user_id = v_registration.user_id
  FOR UPDATE;

  IF v_points_before IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  v_points_after := v_points_before + v_registration.points_charged;

  -- Get owner's balance with row lock
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

  -- Update registration
  UPDATE public.event_registrations
  SET cancelled_at = now(),
      refunded_at = now(),
      updated_at = now()
  WHERE id = p_registration_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Cancel event and refund all (including owner's start cost)
CREATE OR REPLACE FUNCTION public.cancel_event_and_refund_all(
  p_event_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_event RECORD;
  v_registration RECORD;
  v_refund_count INTEGER := 0;
  v_owner_refunded BOOLEAN := false;
BEGIN
  -- Get event with lock
  SELECT * INTO v_event
  FROM public.community_events
  WHERE id = p_event_id
    AND status IN ('scheduled', 'live')
  FOR UPDATE;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found or cannot be cancelled';
  END IF;

  -- Refund all active registrations
  FOR v_registration IN
    SELECT id, user_id, points_charged
    FROM public.event_registrations
    WHERE event_id = p_event_id
      AND cancelled_at IS NULL
      AND refunded_at IS NULL
  LOOP
    PERFORM public.refund_event_registration(v_registration.id, 'event_cancelled');
    v_refund_count := v_refund_count + 1;
  END LOOP;

  -- Refund owner's start cost if charged
  IF v_event.points_charged > 0 THEN
    DECLARE
      v_owner_points_before BIGINT;
      v_owner_points_after BIGINT;
    BEGIN
      SELECT points_balance INTO v_owner_points_before
      FROM public.wallets
      WHERE user_id = v_event.owner_id
      FOR UPDATE;

      IF v_owner_points_before IS NOT NULL THEN
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

        v_owner_refunded := true;
      END IF;
    END;
  END IF;

  -- Update event status
  UPDATE public.community_events
  SET status = 'cancelled',
      points_charged = 0,
      updated_at = now()
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'registration_refunds', v_refund_count,
    'owner_refunded', v_owner_refunded,
    'owner_refund_amount', CASE WHEN v_owner_refunded THEN v_event.points_charged ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.deduct_points_for_stream_creation(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_points_for_stream_join(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_event_registration(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_event_and_refund_all(UUID) TO authenticated;

