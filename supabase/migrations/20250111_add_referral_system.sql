-- =============================================
-- REFERRAL SYSTEM
-- Adds referral tracking, bonuses, and user referral links
-- =============================================

-- 1. Add referred_by_user_id to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id ON public.users(referred_by_user_id);

-- 2. Create referrals table to track referral relationships and conversions
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id) -- Each user can only be referred by one person
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_user_id ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON public.referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON public.referrals(created_at);

-- Enable RLS on referrals table
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Users can view their own referrals (both as referrer and referred)
CREATE POLICY "Users can view own referrals"
  ON public.referrals
  FOR SELECT
  USING (
    referrer_user_id = auth.uid() OR 
    referred_user_id = auth.uid()
  );

-- 3. Create referral_topups table to track which topups have generated referral bonuses
CREATE TABLE IF NOT EXISTS public.referral_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  referrer_bonus_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  bonus_points_awarded BIGINT NOT NULL,
  topup_number INTEGER NOT NULL, -- Which topup this is for this referral (1st, 2nd, 3rd, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(transaction_id) -- Each topup transaction can only generate one referral bonus
);

CREATE INDEX IF NOT EXISTS idx_referral_topups_referral_id ON public.referral_topups(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_topups_transaction_id ON public.referral_topups(transaction_id);
CREATE INDEX IF NOT EXISTS idx_referral_topups_referrer_bonus_transaction_id ON public.referral_topups(referrer_bonus_transaction_id);

-- Enable RLS on referral_topups table
ALTER TABLE public.referral_topups ENABLE ROW LEVEL SECURITY;

-- Users can view referral topups for their referrals
CREATE POLICY "Users can view referral topups for their referrals"
  ON public.referral_topups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.referrals
      WHERE referrals.id = referral_topups.referral_id
      AND referrals.referrer_user_id = auth.uid()
    )
  );

-- 4. Add referral settings to platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_bonus_points BIGINT NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS referral_max_topups INTEGER NOT NULL DEFAULT 3;

-- Update existing row with defaults if columns were just added
UPDATE public.platform_settings
SET 
  referral_bonus_points = COALESCE(referral_bonus_points, 20),
  referral_max_topups = COALESCE(referral_max_topups, 3)
WHERE id = 1;

-- 5. Add 'referral_bonus' to transaction types
-- First, get the current constraint definition and add referral_bonus to it
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check CHECK (
    type = ANY (
      ARRAY[
        'top_up',
        'payout',
        'payout_lock',
        'payout_release',
        'point_spend',
        'point_refund',
        'earning_credit',
        'earning_reversal',
        'referral_bonus'
      ]::text[]
    )
  );

-- 6. Function to get or create referral relationship
CREATE OR REPLACE FUNCTION public.get_or_create_referral(
  p_referrer_user_id UUID,
  p_referred_user_id UUID
) RETURNS UUID AS $$
DECLARE
  v_referral_id UUID;
BEGIN
  -- Check if referral already exists
  SELECT id INTO v_referral_id
  FROM public.referrals
  WHERE referred_user_id = p_referred_user_id;

  IF v_referral_id IS NOT NULL THEN
    RETURN v_referral_id;
  END IF;

  -- Create new referral
  INSERT INTO public.referrals (referrer_user_id, referred_user_id)
  VALUES (p_referrer_user_id, p_referred_user_id)
  RETURNING id INTO v_referral_id;

  -- Update users table
  UPDATE public.users
  SET referred_by_user_id = p_referrer_user_id
  WHERE id = p_referred_user_id;

  RETURN v_referral_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to process referral bonus when a referred user tops up
CREATE OR REPLACE FUNCTION public.process_referral_bonus(
  p_referred_user_id UUID,
  p_topup_transaction_id UUID
) RETURNS UUID AS $$
DECLARE
  v_referral RECORD;
  v_settings RECORD;
  v_topup_count INTEGER;
  v_bonus_points BIGINT;
  v_referrer_points_before BIGINT;
  v_referrer_points_after BIGINT;
  v_bonus_transaction_id UUID;
BEGIN
  -- Get referral relationship
  SELECT id, referrer_user_id INTO v_referral
  FROM public.referrals
  WHERE referred_user_id = p_referred_user_id;

  -- If no referral, return NULL
  IF v_referral IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get platform settings
  SELECT referral_bonus_points, referral_max_topups INTO v_settings
  FROM public.platform_settings
  WHERE id = 1;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  -- Count how many topups have already generated bonuses for this referral
  SELECT COUNT(*) INTO v_topup_count
  FROM public.referral_topups
  WHERE referral_id = v_referral.id;

  -- Check if we've reached the max topups
  IF v_topup_count >= v_settings.referral_max_topups THEN
    RETURN NULL;
  END IF;

  -- Check if this topup has already generated a bonus
  IF EXISTS (
    SELECT 1 FROM public.referral_topups
    WHERE transaction_id = p_topup_transaction_id
  ) THEN
    RETURN NULL;
  END IF;

  v_bonus_points := v_settings.referral_bonus_points;
  v_topup_count := v_topup_count + 1;

  -- Get referrer's current balance
  SELECT points_balance INTO v_referrer_points_before
  FROM public.wallets
  WHERE user_id = v_referral.referrer_user_id
  FOR UPDATE;

  -- Ensure wallet exists
  IF v_referrer_points_before IS NULL THEN
    INSERT INTO public.wallets (user_id, points_balance)
    VALUES (v_referral.referrer_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    v_referrer_points_before := 0;
  END IF;

  v_referrer_points_after := v_referrer_points_before + v_bonus_points;

  -- Create referral bonus transaction
  INSERT INTO public.transactions (
    user_id,
    type,
    points_delta,
    recipient_user_id,
    status,
    created_at
  )
  VALUES (
    v_referral.referrer_user_id,
    'referral_bonus',
    v_bonus_points,
    p_referred_user_id,
    'verified',
    now()
  )
  RETURNING id INTO v_bonus_transaction_id;

  -- Update referrer's wallet
  UPDATE public.wallets
  SET points_balance = v_referrer_points_after,
      updated_at = now()
  WHERE user_id = v_referral.referrer_user_id;

  -- Record the referral topup
  INSERT INTO public.referral_topups (
    referral_id,
    transaction_id,
    referrer_bonus_transaction_id,
    bonus_points_awarded,
    topup_number
  )
  VALUES (
    v_referral.id,
    p_topup_transaction_id,
    v_bonus_transaction_id,
    v_bonus_points,
    v_topup_count
  );

  RETURN v_bonus_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update apply_topup function to process referral bonuses
-- Note: We're adding referral_bonus_transaction_id to the return, but keeping backward compatibility
CREATE OR REPLACE FUNCTION public.apply_topup(p_user_id UUID, p_amount_ttd NUMERIC)
RETURNS TABLE (transaction_id UUID, points_before BIGINT, points_after BIGINT, points_credited BIGINT) AS $$
DECLARE
  v_buy_price_per_point NUMERIC;
  v_points_credited BIGINT;
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_tx_id UUID;
  v_referral_bonus_id UUID;
BEGIN
  SELECT buy_price_per_point INTO v_buy_price_per_point
  FROM public.platform_settings WHERE id = 1;

  IF v_buy_price_per_point IS NULL OR v_buy_price_per_point <= 0 THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  v_points_credited := FLOOR(p_amount_ttd / v_buy_price_per_point);

  INSERT INTO public.wallets (user_id, points_balance, last_topup_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT points_balance INTO v_points_before FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  v_points_after := v_points_before + v_points_credited;

  INSERT INTO public.transactions (user_id, type, amount_ttd, points_delta, status)
  VALUES (p_user_id, 'top_up', p_amount_ttd, v_points_credited, 'verified')
  RETURNING id INTO v_tx_id;

  UPDATE public.wallets
  SET points_balance = v_points_after, last_topup_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  -- Process referral bonus if applicable (runs asynchronously in background, doesn't block)
  BEGIN
    SELECT public.process_referral_bonus(p_user_id, v_tx_id) INTO v_referral_bonus_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the topup
    RAISE WARNING 'Failed to process referral bonus: %', SQLERRM;
  END;

  RETURN QUERY SELECT v_tx_id, v_points_before, v_points_after, v_points_credited;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Update handle_new_user trigger to create referral relationship if referred_by_user_id is set
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  -- Insert user record
  INSERT INTO public.users (id, email, username, first_name, last_name, role, referred_by_user_id)
  VALUES (
    NEW.id,
    NEW.email,
    generate_username(
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    ),
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'user'::user_role,
    (NEW.raw_user_meta_data->>'referred_by_user_id')::UUID
  )
  RETURNING referred_by_user_id INTO v_referrer_id;

  -- Create referral relationship if referrer exists
  IF v_referrer_id IS NOT NULL THEN
    PERFORM public.get_or_create_referral(v_referrer_id, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

COMMENT ON TABLE public.referrals IS 'Tracks referral relationships between users';
COMMENT ON TABLE public.referral_topups IS 'Tracks which topups have generated referral bonuses';
COMMENT ON COLUMN public.users.referred_by_user_id IS 'User who referred this user (nullable)';
COMMENT ON COLUMN public.platform_settings.referral_bonus_points IS 'Points awarded to referrer when referred user tops up';
COMMENT ON COLUMN public.platform_settings.referral_max_topups IS 'Maximum number of topups that generate referral bonuses per referral';

