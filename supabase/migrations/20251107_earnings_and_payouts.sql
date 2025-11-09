-- =============================================
-- EARNINGS & PAYOUT OVERHAUL
-- Adds earnings balances, ledger tracking, payout tables, and helper functions
-- =============================================

-- 1. Wallet schema extensions
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS earnings_points BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_earnings_points BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_topup_due_on DATE,
  ADD COLUMN IF NOT EXISTS last_mandatory_topup_at TIMESTAMPTZ;

-- Ensure existing wallets have a next top-up date (default to one month from today if missing)
UPDATE public.wallets
SET next_topup_due_on = COALESCE(next_topup_due_on, (CURRENT_DATE + INTERVAL '1 month')),
    last_mandatory_topup_at = COALESCE(last_mandatory_topup_at, NULL)
WHERE next_topup_due_on IS NULL;

-- 2. Platform settings extensions
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS payout_minimum_ttd NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mandatory_topup_ttd NUMERIC(12,2) DEFAULT 50;

UPDATE public.platform_settings
SET payout_minimum_ttd = COALESCE(payout_minimum_ttd, 0),
    mandatory_topup_ttd = COALESCE(mandatory_topup_ttd, 50)
WHERE id = 1;

-- 3. Supporting types
DO $$
BEGIN
  CREATE TYPE public.payout_status AS ENUM ('pending', 'processing', 'paid', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.wallet_earnings_status AS ENUM ('pending', 'available', 'locked', 'paid', 'reversed');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- 4. Earnings ledger and payouts tables
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_points BIGINT NOT NULL,
  amount_ttd NUMERIC(12,2) NOT NULL,
  status public.payout_status NOT NULL DEFAULT 'pending',
  payout_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.users(id),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_payouts_user_status ON public.payouts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_date ON public.payouts(payout_date);

CREATE TABLE IF NOT EXISTS public.wallet_earnings_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID,
  points_amount BIGINT NOT NULL,
  amount_ttd NUMERIC(12,2) NOT NULL,
  status public.wallet_earnings_status NOT NULL DEFAULT 'pending',
  release_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by UUID REFERENCES public.payouts(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_earnings_ledger_user_status ON public.wallet_earnings_ledger(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wallet_earnings_ledger_release_at ON public.wallet_earnings_ledger(release_at);

-- 5. Transactions linkage updates
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS ledger_entry_id UUID REFERENCES public.wallet_earnings_ledger(id);

CREATE INDEX IF NOT EXISTS idx_transactions_ledger_entry_id ON public.transactions(ledger_entry_id);

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check CHECK (
    type = ANY (
      ARRAY[
        'top_up',
        'payout',
        'point_spend',
        'point_refund',
        'earnings_credit',
        'earnings_debit',
        'earnings_payout',
        'earnings_lock'
      ]
    )
  );

ALTER TABLE public.post_boosts
  ADD COLUMN IF NOT EXISTS ledger_entry_id UUID REFERENCES public.wallet_earnings_ledger(id);

CREATE INDEX IF NOT EXISTS idx_post_boosts_ledger_entry_id ON public.post_boosts(ledger_entry_id);

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS earnings_ledger_id UUID REFERENCES public.wallet_earnings_ledger(id);

CREATE INDEX IF NOT EXISTS idx_event_registrations_earnings_ledger_id ON public.event_registrations(earnings_ledger_id);

-- 6. Helper functions for balances
CREATE OR REPLACE FUNCTION public.release_pending_earnings(
  p_user_id UUID,
  p_process_until TIMESTAMPTZ DEFAULT now()
) RETURNS BIGINT AS $$
DECLARE
  v_entry RECORD;
  v_total BIGINT := 0;
BEGIN
  IF p_process_until IS NULL THEN
    p_process_until := now();
  END IF;

  -- Ensure wallet row exists for updates
  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  FOR v_entry IN
    SELECT id, points_amount
    FROM public.wallet_earnings_ledger
    WHERE user_id = p_user_id
      AND status = 'pending'
      AND (release_at <= p_process_until OR release_at IS NULL)
    ORDER BY release_at, created_at
    FOR UPDATE
  LOOP
    UPDATE public.wallet_earnings_ledger
    SET status = 'available',
        updated_at = now()
    WHERE id = v_entry.id;

    -- Record the release in transactions for auditing
    INSERT INTO public.transactions (user_id, type, points_delta, status, ledger_entry_id, created_at)
    VALUES (p_user_id, 'earnings_credit', v_entry.points_amount, 'verified', v_entry.id, now());

    v_total := v_total + v_entry.points_amount;
  END LOOP;

  IF v_total > 0 THEN
    UPDATE public.wallets
    SET earnings_points = earnings_points + v_total,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.credit_user_earnings(
  p_user_id UUID,
  p_points BIGINT,
  p_source_type TEXT,
  p_source_id UUID,
  p_hold_seconds INTEGER DEFAULT 0,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  v_value_per_point NUMERIC;
  v_amount_ttd NUMERIC(12,2);
  v_status public.wallet_earnings_status := 'pending';
  v_release_at TIMESTAMPTZ := now();
  v_ledger_id UUID;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'Points credited must be greater than zero';
  END IF;

  SELECT user_value_per_point
  INTO v_value_per_point
  FROM public.platform_settings
  WHERE id = 1;

  v_amount_ttd := ROUND(COALESCE(v_value_per_point, 0) * p_points, 2);

  IF p_hold_seconds IS NULL OR p_hold_seconds <= 0 THEN
    v_status := 'available';
  ELSE
    v_release_at := now() + make_interval(secs => p_hold_seconds);
    v_status := 'pending';
  END IF;

  -- Ensure wallet row exists before crediting
  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallet_earnings_ledger (
    user_id,
    source_type,
    source_id,
    points_amount,
    amount_ttd,
    status,
    release_at,
    metadata
  )
  VALUES (
    p_user_id,
    p_source_type,
    p_source_id,
    p_points,
    v_amount_ttd,
    v_status,
    v_release_at,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_ledger_id;

  IF v_status = 'available' THEN
    UPDATE public.wallets
    SET earnings_points = earnings_points + p_points,
        updated_at = now()
    WHERE user_id = p_user_id;

    INSERT INTO public.transactions (user_id, type, points_delta, status, ledger_entry_id, created_at)
    VALUES (p_user_id, 'earnings_credit', p_points, 'verified', v_ledger_id, now());
  END IF;

  RETURN v_ledger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reverse_earnings_entry(
  p_ledger_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  v_entry public.wallet_earnings_ledger%ROWTYPE;
  v_wallet public.wallets%ROWTYPE;
  v_deficit BIGINT;
BEGIN
  SELECT * INTO v_entry
  FROM public.wallet_earnings_ledger
  WHERE id = p_ledger_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Earnings ledger entry not found';
  END IF;

  IF v_entry.status = 'reversed' THEN
    RETURN 'already_reversed';
  END IF;

  IF v_entry.status = 'paid' THEN
    RAISE EXCEPTION 'Cannot reverse a paid earnings entry';
  END IF;

  IF v_entry.status IN ('locked', 'available') THEN
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = v_entry.user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Wallet not found for user % while reversing earnings', v_entry.user_id;
    END IF;

    IF v_entry.status = 'locked' THEN
      UPDATE public.wallets
      SET locked_earnings_points = locked_earnings_points - v_entry.points_amount,
          updated_at = now()
      WHERE user_id = v_entry.user_id;
    ELSE
      IF v_wallet.earnings_points >= v_entry.points_amount THEN
        UPDATE public.wallets
        SET earnings_points = earnings_points - v_entry.points_amount,
            updated_at = now()
        WHERE user_id = v_entry.user_id;
      ELSE
        v_deficit := v_entry.points_amount - v_wallet.earnings_points;
        IF v_wallet.points_balance < v_deficit THEN
          RAISE EXCEPTION 'Insufficient balance to reverse earnings entry. Missing % points', v_deficit;
        END IF;

        UPDATE public.wallets
        SET earnings_points = 0,
            points_balance = points_balance - v_deficit,
            updated_at = now()
        WHERE user_id = v_entry.user_id;
      END IF;

      INSERT INTO public.transactions (user_id, type, points_delta, status, ledger_entry_id, created_at)
      VALUES (v_entry.user_id, 'earnings_debit', -v_entry.points_amount, 'verified', v_entry.id, now());
    END IF;
  END IF;

  UPDATE public.wallet_earnings_ledger
  SET status = 'reversed',
      locked_by = NULL,
      metadata = metadata || jsonb_build_object('reversal_reason', p_reason, 'reversed_at', now()),
      updated_at = now()
  WHERE id = p_ledger_id;

  RETURN 'reversed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.debit_user_points(
  p_user_id UUID,
  p_points BIGINT
) RETURNS TABLE(wallet_points_spent BIGINT, earnings_points_spent BIGINT) AS $$
DECLARE
  v_wallet public.wallets%ROWTYPE;
  v_wallet_spent BIGINT := 0;
  v_earnings_spent BIGINT := 0;
  v_available BIGINT;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'Points to debit must be greater than zero';
  END IF;

  PERFORM public.release_pending_earnings(p_user_id);

  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  v_available := v_wallet.points_balance + v_wallet.earnings_points;
  IF v_available < p_points THEN
    RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %', p_points, v_available;
  END IF;

  v_wallet_spent := LEAST(v_wallet.points_balance, p_points);
  v_earnings_spent := p_points - v_wallet_spent;

  UPDATE public.wallets
  SET points_balance = points_balance - v_wallet_spent,
      earnings_points = earnings_points - v_earnings_spent,
      updated_at = now()
  WHERE user_id = p_user_id;

  wallet_points_spent := v_wallet_spent;
  earnings_points_spent := v_earnings_spent;
  RETURN NEXT;
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.lock_user_earnings_for_payout(
  p_user_id UUID,
  p_payout_id UUID,
  p_points BIGINT
) RETURNS BIGINT AS $$
DECLARE
  v_remaining BIGINT := p_points;
  v_wallet public.wallets%ROWTYPE;
  v_entry RECORD;
  v_ratio NUMERIC := 0;
  v_new_entry_id UUID;
BEGIN
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'Points to lock must be greater than zero';
  END IF;

  PERFORM public.release_pending_earnings(p_user_id);

  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  IF v_wallet.earnings_points < p_points THEN
    RAISE EXCEPTION 'Insufficient earnings balance. Required: %, Available: %', p_points, v_wallet.earnings_points;
  END IF;

  FOR v_entry IN
    SELECT id, points_amount, amount_ttd, source_type, source_id, release_at, metadata
    FROM public.wallet_earnings_ledger
    WHERE user_id = p_user_id
      AND status = 'available'
    ORDER BY release_at, created_at
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    IF v_entry.points_amount > v_remaining THEN
      v_ratio := CASE WHEN v_entry.points_amount = 0 THEN 0 ELSE v_entry.amount_ttd / v_entry.points_amount END;

      UPDATE public.wallet_earnings_ledger
      SET points_amount = v_entry.points_amount - v_remaining,
          amount_ttd = ROUND(v_ratio * (v_entry.points_amount - v_remaining), 2),
          updated_at = now()
      WHERE id = v_entry.id;

      INSERT INTO public.wallet_earnings_ledger (
        user_id,
        source_type,
        source_id,
        points_amount,
        amount_ttd,
        status,
        release_at,
        locked_by,
        metadata
      )
      VALUES (
        p_user_id,
        v_entry.source_type,
        v_entry.source_id,
        v_remaining,
        ROUND(v_ratio * v_remaining, 2),
        'locked',
        v_entry.release_at,
        p_payout_id,
        v_entry.metadata || jsonb_build_object('split_from', v_entry.id)
      )
      RETURNING id INTO v_new_entry_id;

      INSERT INTO public.transactions (user_id, type, points_delta, status, ledger_entry_id, created_at)
      VALUES (p_user_id, 'earnings_lock', -v_remaining, 'verified', v_new_entry_id, now());

      v_remaining := 0;
    ELSE
      UPDATE public.wallet_earnings_ledger
      SET status = 'locked',
          locked_by = p_payout_id,
          updated_at = now()
      WHERE id = v_entry.id;

      INSERT INTO public.transactions (user_id, type, points_delta, status, ledger_entry_id, created_at)
      VALUES (p_user_id, 'earnings_lock', -v_entry.points_amount, 'verified', v_entry.id, now());

      v_remaining := v_remaining - v_entry.points_amount;
    END IF;
  END LOOP;

  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient available earnings to lock requested amount';
  END IF;

  UPDATE public.wallets
  SET earnings_points = earnings_points - p_points,
      locked_earnings_points = locked_earnings_points + p_points,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN p_points;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Updated business logic functions
DROP FUNCTION IF EXISTS public.apply_topup(UUID, NUMERIC);
DROP FUNCTION IF EXISTS public.boost_post(UUID, UUID);
DROP FUNCTION IF EXISTS public.unboost_post(UUID, UUID);
DROP FUNCTION IF EXISTS public.deduct_points_for_stream_creation(UUID, UUID, BIGINT);
DROP FUNCTION IF EXISTS public.deduct_points_for_stream_join(UUID, UUID, BIGINT);
DROP FUNCTION IF EXISTS public.refund_event_registration(UUID);
DROP FUNCTION IF EXISTS public.refund_event_registration(UUID, TEXT);
DROP FUNCTION IF EXISTS public.cancel_event_and_refund_all(UUID);
DROP FUNCTION IF EXISTS public.process_monthly_storage_billing(UUID);
CREATE OR REPLACE FUNCTION public.apply_topup(p_user_id UUID, p_amount_ttd NUMERIC)
RETURNS TABLE (transaction_id UUID, points_before BIGINT, points_after BIGINT, points_credited BIGINT) AS $$
DECLARE
  v_buy_price_per_point NUMERIC;
  v_points_credited BIGINT;
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_tx_id UUID;
  v_next_due DATE;
BEGIN
  SELECT buy_price_per_point
  INTO v_buy_price_per_point
  FROM public.platform_settings
  WHERE id = 1;

  IF v_buy_price_per_point IS NULL OR v_buy_price_per_point <= 0 THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  v_points_credited := FLOOR(p_amount_ttd / v_buy_price_per_point);
  IF v_points_credited <= 0 THEN
    RAISE EXCEPTION 'Top up amount % is too low for point price %', p_amount_ttd, v_buy_price_per_point;
  END IF;

  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT points_balance INTO v_points_before
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_points_after := v_points_before + v_points_credited;

  INSERT INTO public.transactions (user_id, type, amount_ttd, points_delta, status, created_at)
  VALUES (p_user_id, 'top_up', p_amount_ttd, v_points_credited, 'verified', now())
  RETURNING id INTO v_tx_id;

  v_next_due := (now() + INTERVAL '1 month')::date;

  UPDATE public.wallets
  SET points_balance = v_points_after,
      last_topup_at = now(),
      last_mandatory_topup_at = now(),
      next_topup_due_on = v_next_due,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_tx_id, v_points_before, v_points_after, v_points_credited;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    SELECT wallet_points_spent, earnings_points_spent
    INTO v_wallet_spent, v_earnings_spent
    FROM public.debit_user_points(p_user_id, 1);

    INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
    VALUES (p_user_id, 'point_spend', -1, v_post_author_id, 'verified', now());

    v_ledger_id := public.credit_user_earnings(
      v_post_author_id,
      1,
      'post_boost',
      v_boost_id,
      60,
      jsonb_build_object('boost_id', v_boost_id, 'post_id', p_post_id, 'from_user_id', p_user_id)
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

CREATE OR REPLACE FUNCTION public.unboost_post(
  p_post_id UUID,
  p_user_id UUID
) RETURNS JSON AS $$
DECLARE
  v_post_author_id UUID;
  v_boost RECORD;
  v_result JSON;
BEGIN
  SELECT
    pb.id,
    pb.created_at,
    pb.ledger_entry_id,
    posts.author_id AS post_author
  INTO v_boost
  FROM public.post_boosts pb
  JOIN public.posts ON posts.id = pb.post_id
  WHERE pb.post_id = p_post_id AND pb.user_id = p_user_id;

  IF v_boost.id IS NULL THEN
    RAISE EXCEPTION 'You have not boosted this post';
  END IF;

  IF (EXTRACT(EPOCH FROM (NOW() - v_boost.created_at))) > 60 THEN
    RAISE EXCEPTION 'Cannot unboost after 1 minute';
  END IF;

  DELETE FROM public.post_boosts
  WHERE id = v_boost.id;

  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET points_balance = points_balance + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
  VALUES (p_user_id, 'point_refund', 1, p_user_id, 'verified', now());

  IF v_boost.ledger_entry_id IS NOT NULL THEN
    PERFORM public.reverse_earnings_entry(v_boost.ledger_entry_id, 'post_unboost');
  END IF;

  v_result := json_build_object(
    'boosted', false,
    'message', 'Post unboosted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.deduct_points_for_stream_creation(
  p_user_id UUID,
  p_event_id UUID,
  p_point_cost BIGINT
) RETURNS UUID AS $$
DECLARE
  v_tx_id UUID;
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

CREATE OR REPLACE FUNCTION public.deduct_points_for_stream_join(
  p_user_id UUID,
  p_event_id UUID,
  p_point_cost BIGINT
) RETURNS UUID AS $$
DECLARE
  v_owner_id UUID;
  v_event_status TEXT;
  v_tx_id UUID;
  v_registration_id UUID;
  v_existing RECORD;
  v_ledger_id UUID;
BEGIN
  IF p_point_cost IS NULL OR p_point_cost <= 0 THEN
    RAISE EXCEPTION 'Point cost must be greater than zero';
  END IF;

  SELECT owner_id, status INTO v_owner_id, v_event_status
  FROM public.community_events
  WHERE id = p_event_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event_status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Event is not available for registration (current status: %)', v_event_status;
  END IF;

  SELECT id, cancelled_at INTO v_existing
  FROM public.event_registrations
  WHERE event_id = p_event_id AND user_id = p_user_id
  ORDER BY registered_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.cancelled_at IS NULL THEN
    RAISE EXCEPTION 'Already registered for this event';
  END IF;

  PERFORM public.debit_user_points(p_user_id, p_point_cost);

  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
  VALUES (p_user_id, 'point_spend', -p_point_cost, v_owner_id, 'verified', now())
  RETURNING id INTO v_tx_id;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.event_registrations
    SET points_charged = p_point_cost,
        registered_at = now(),
        cancelled_at = NULL,
        refunded_at = NULL,
        joined_at = NULL,
        earnings_ledger_id = NULL
    WHERE id = v_existing.id
    RETURNING id INTO v_registration_id;
  ELSE
    INSERT INTO public.event_registrations (event_id, user_id, points_charged)
    VALUES (p_event_id, p_user_id, p_point_cost)
    RETURNING id INTO v_registration_id;
  END IF;

  v_ledger_id := public.credit_user_earnings(
    v_owner_id,
    p_point_cost,
    'event_registration',
    v_registration_id,
    0,
    jsonb_build_object('event_id', p_event_id, 'registration_id', v_registration_id, 'from_user_id', p_user_id)
  );

  UPDATE public.event_registrations
  SET earnings_ledger_id = v_ledger_id
  WHERE id = v_registration_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refund_event_registration(
  p_registration_id UUID,
  p_reason TEXT DEFAULT 'user_requested'
) RETURNS UUID AS $$
DECLARE
  v_registration RECORD;
  v_tx_id UUID;
BEGIN
  SELECT er.*, ce.owner_id
  INTO v_registration
  FROM public.event_registrations er
  JOIN public.community_events ce ON ce.id = er.event_id
  WHERE er.id = p_registration_id
    AND er.cancelled_at IS NULL
  FOR UPDATE;

  IF v_registration.id IS NULL THEN
    RAISE EXCEPTION 'Registration not found or already cancelled';
  END IF;

  INSERT INTO public.wallets (user_id)
  VALUES (v_registration.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET points_balance = points_balance + v_registration.points_charged,
      updated_at = now()
  WHERE user_id = v_registration.user_id;

  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
  VALUES (
    v_registration.user_id,
    'point_refund',
    v_registration.points_charged,
    v_registration.user_id,
    'verified',
    now()
  )
  RETURNING id INTO v_tx_id;

  IF v_registration.earnings_ledger_id IS NOT NULL THEN
    PERFORM public.reverse_earnings_entry(v_registration.earnings_ledger_id, p_reason);
  END IF;

  UPDATE public.event_registrations
  SET cancelled_at = now(),
      refunded_at = now(),
      earnings_ledger_id = NULL
  WHERE id = p_registration_id;

  RETURN v_tx_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cancel_event_and_refund_all(
  p_event_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_event RECORD;
  v_registration RECORD;
  v_refunded_count INTEGER := 0;
BEGIN
  SELECT * INTO v_event
  FROM public.community_events
  WHERE id = p_event_id
    AND owner_id = auth.uid()
    AND status IN ('scheduled', 'live');

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found, not owned by you, or cannot be cancelled';
  END IF;

  IF v_event.points_charged > 0 THEN
    INSERT INTO public.wallets (user_id)
    VALUES (v_event.owner_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.wallets
    SET points_balance = points_balance + v_event.points_charged,
        updated_at = now()
    WHERE user_id = v_event.owner_id;

    INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
    VALUES (v_event.owner_id, 'point_refund', v_event.points_charged, v_event.owner_id, 'verified', now());
  END IF;

  FOR v_registration IN
    SELECT er.id, er.user_id, er.points_charged, er.earnings_ledger_id
    FROM public.event_registrations er
    WHERE er.event_id = p_event_id
      AND er.cancelled_at IS NULL
  LOOP
    INSERT INTO public.wallets (user_id)
    VALUES (v_registration.user_id)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.wallets
    SET points_balance = points_balance + v_registration.points_charged,
        updated_at = now()
    WHERE user_id = v_registration.user_id;

    INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
    VALUES (v_registration.user_id, 'point_refund', v_registration.points_charged, v_registration.user_id, 'verified', now());

    IF v_registration.earnings_ledger_id IS NOT NULL THEN
      PERFORM public.reverse_earnings_entry(v_registration.earnings_ledger_id, 'event_cancelled');
    END IF;

    UPDATE public.event_registrations
    SET cancelled_at = now(),
        refunded_at = now(),
        earnings_ledger_id = NULL
    WHERE id = v_registration.id;

    v_refunded_count := v_refunded_count + 1;
  END LOOP;

  UPDATE public.community_events
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'cancelled', true,
    'refunded_registrations', v_refunded_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.process_monthly_storage_billing(
  p_user_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  points_deducted BIGINT,
  remaining_balance BIGINT,
  message TEXT
) AS $$
DECLARE
  v_storage_record RECORD;
  v_current_date DATE := CURRENT_DATE;
  v_total_available BIGINT;
  v_tx_id UUID;
BEGIN
  SELECT * INTO v_storage_record
  FROM public.user_storage
  WHERE user_id = p_user_id;

  IF v_storage_record IS NULL THEN
    PERFORM public.update_user_storage_usage(p_user_id);
    SELECT * INTO v_storage_record
    FROM public.user_storage
    WHERE user_id = p_user_id;
  END IF;

  IF v_storage_record.last_billing_date IS NOT NULL
     AND DATE_TRUNC('month', v_storage_record.last_billing_date) = DATE_TRUNC('month', v_current_date) THEN
    SELECT COALESCE(points_balance + earnings_points, 0) INTO v_total_available
    FROM public.wallets
    WHERE user_id = p_user_id;

    RETURN QUERY
    SELECT true, 0::BIGINT, COALESCE(v_total_available, 0), 'Already billed this month';
    RETURN;
  END IF;

  PERFORM public.update_user_storage_usage(p_user_id);

  SELECT monthly_cost_points INTO v_storage_record.monthly_cost_points
  FROM public.user_storage
  WHERE user_id = p_user_id;

  IF v_storage_record.monthly_cost_points = 0 THEN
    UPDATE public.user_storage
    SET last_billing_date = v_current_date,
        updated_at = now()
    WHERE user_id = p_user_id;

    SELECT COALESCE(points_balance + earnings_points, 0) INTO v_total_available
    FROM public.wallets
    WHERE user_id = p_user_id;

    RETURN QUERY
    SELECT true, 0::BIGINT, COALESCE(v_total_available, 0), 'No storage cost this month';
    RETURN;
  END IF;

  SELECT COALESCE(points_balance, 0) + COALESCE(earnings_points, 0)
  INTO v_total_available
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF v_total_available < v_storage_record.monthly_cost_points THEN
    UPDATE public.user_storage
    SET last_billing_date = v_current_date,
        updated_at = now()
    WHERE user_id = p_user_id;

    RETURN QUERY
    SELECT false, 0::BIGINT, COALESCE(v_total_available, 0),
      format('Insufficient balance. Required: %s points, available: %s points',
             v_storage_record.monthly_cost_points, v_total_available);
    RETURN;
  END IF;

  PERFORM public.debit_user_points(p_user_id, v_storage_record.monthly_cost_points);

  INSERT INTO public.transactions (user_id, type, points_delta, recipient_user_id, status, created_at)
  VALUES (p_user_id, 'point_spend', -v_storage_record.monthly_cost_points, NULL, 'verified', now())
  RETURNING id INTO v_tx_id;

  UPDATE public.user_storage
  SET last_billing_date = v_current_date,
      updated_at = now()
  WHERE user_id = p_user_id;

  SELECT COALESCE(points_balance + earnings_points, 0)
  INTO v_total_available
  FROM public.wallets
  WHERE user_id = p_user_id;

  RETURN QUERY
  SELECT true,
         v_storage_record.monthly_cost_points,
         COALESCE(v_total_available, 0),
         format('Storage billing processed: %s points deducted', v_storage_record.monthly_cost_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Triggers & initial data backfill
CREATE OR REPLACE FUNCTION public.set_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.wallets_set_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.next_topup_due_on IS NULL THEN
    NEW.next_topup_due_on := (CURRENT_DATE + INTERVAL '1 month')::date;
  END IF;
  IF NEW.last_mandatory_topup_at IS NULL THEN
    NEW.last_mandatory_topup_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wallets_set_defaults ON public.wallets;
CREATE TRIGGER trg_wallets_set_defaults
  BEFORE INSERT ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.wallets_set_defaults();

DROP TRIGGER IF EXISTS trg_wallets_touch_updated_at ON public.wallets;
CREATE TRIGGER trg_wallets_touch_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_wallet_earnings_touch_updated_at ON public.wallet_earnings_ledger;
CREATE TRIGGER trg_wallet_earnings_touch_updated_at
  BEFORE UPDATE ON public.wallet_earnings_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.set_timestamp_updated_at();

DROP TRIGGER IF EXISTS trg_payouts_touch_updated_at ON public.payouts;
CREATE TRIGGER trg_payouts_touch_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_timestamp_updated_at();

-- Backfill defaults for existing wallets
UPDATE public.wallets
SET next_topup_due_on = COALESCE(next_topup_due_on, (CURRENT_DATE + INTERVAL '1 month')::date),
    last_mandatory_topup_at = COALESCE(last_mandatory_topup_at, now()),
    earnings_points = COALESCE(earnings_points, 0),
    locked_earnings_points = COALESCE(locked_earnings_points, 0),
    updated_at = now();
