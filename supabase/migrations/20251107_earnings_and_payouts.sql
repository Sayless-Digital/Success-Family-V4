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

  IF v_entry.status = 'locked' THEN
    UPDATE public.wallets
    SET locked_earnings_points = locked_earnings_points - v_entry.points_amount,
        updated_at = now()
    WHERE user_id = v_entry.user_id;
  ELSIF v_entry.status = 'available' THEN
    UPDATE public.wallets
    SET earnings_points = earnings_points - v_entry.points_amount,
        updated_at = now()
    WHERE user_id = v_entry.user_id;

    INSERT INTO public.transactions (user_id, type, points_delta, status, ledger_entry_id, created_at)
    VALUES (v_entry.user_id, 'earnings_debit', -v_entry.points_amount, 'verified', v_entry.id, now());
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

-- 8. Triggers & initial data backfill
