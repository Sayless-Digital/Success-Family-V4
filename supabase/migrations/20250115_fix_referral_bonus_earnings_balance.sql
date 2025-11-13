-- Fix referral bonus to credit earnings_points instead of points_balance
-- Referral bonuses are earnings, not purchased points, so they should go to earnings_balance

CREATE OR REPLACE FUNCTION public.process_referral_bonus(
  p_referred_user_id UUID,
  p_topup_transaction_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_referral RECORD;
  v_settings RECORD;
  v_topup_count INTEGER;
  v_bonus_points BIGINT;
  v_user_value_per_point NUMERIC;
  v_referral_expense_ttd NUMERIC;
  v_referrer_earnings_before BIGINT;
  v_referrer_earnings_after BIGINT;
  v_bonus_transaction_id UUID;
  v_bank_account_id UUID;
  v_ledger_id UUID;
  v_amount_ttd NUMERIC(12,2);
BEGIN
  -- Get referral relationship
  SELECT id, referrer_user_id INTO v_referral
  FROM public.referrals
  WHERE referred_user_id = p_referred_user_id;

  -- If no referral, return NULL
  IF v_referral IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get platform settings (historical snapshot)
  SELECT referral_bonus_points, referral_max_topups, user_value_per_point
  INTO v_settings
  FROM public.platform_settings
  WHERE id = 1;

  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  v_user_value_per_point := v_settings.user_value_per_point;
  v_bonus_points := v_settings.referral_bonus_points;

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

  -- Get topup transaction to get bank_account_id
  SELECT bank_account_id INTO v_bank_account_id
  FROM public.transactions
  WHERE id = p_topup_transaction_id;

  v_topup_count := v_topup_count + 1;

  -- Calculate referral expense: user_value_per_point * bonus_points
  -- This is deducted from platform's liquid revenue
  v_referral_expense_ttd := v_user_value_per_point * v_bonus_points;

  -- Get referrer's current earnings balance
  SELECT earnings_points INTO v_referrer_earnings_before
  FROM public.wallets
  WHERE user_id = v_referral.referrer_user_id
  FOR UPDATE;

  -- Ensure wallet exists
  IF v_referrer_earnings_before IS NULL THEN
    INSERT INTO public.wallets (user_id, points_balance, earnings_points)
    VALUES (v_referral.referrer_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    v_referrer_earnings_before := 0;
  END IF;

  v_referrer_earnings_after := v_referrer_earnings_before + v_bonus_points;

  -- Calculate TTD amount for the earnings ledger
  v_amount_ttd := ROUND(v_user_value_per_point * v_bonus_points, 2);

  -- Create earnings ledger entry for referral bonus
  INSERT INTO public.wallet_earnings_ledger (
    user_id,
    source_type,
    source_id,
    points,
    amount_ttd,
    status,
    available_at,
    metadata
  )
  VALUES (
    v_referral.referrer_user_id,
    'referral_bonus',
    v_referral.id, -- Use referral_id as source_id
    v_bonus_points,
    v_amount_ttd,
    'available', -- Referral bonuses are immediately available
    now(),
    jsonb_build_object(
      'referral_id', v_referral.id,
      'referred_user_id', p_referred_user_id,
      'topup_transaction_id', p_topup_transaction_id,
      'topup_number', v_topup_count
    )
  )
  RETURNING id INTO v_ledger_id;

  -- Create referral bonus transaction
  -- Use earnings_points_delta instead of points_delta since this is an earning
  -- Link to the ledger entry via ledger_entry_id
  -- Include amount_ttd to document the TTD value of the bonus
  INSERT INTO public.transactions (
    user_id,
    type,
    earnings_points_delta,
    amount_ttd,
    recipient_user_id,
    user_value_per_point_at_time,
    status,
    ledger_entry_id,
    created_at
  )
  VALUES (
    v_referral.referrer_user_id,
    'referral_bonus',
    v_bonus_points,
    v_amount_ttd,
    p_referred_user_id,
    v_user_value_per_point,
    'verified',
    v_ledger_id,
    now()
  )
  RETURNING id INTO v_bonus_transaction_id;

  -- Create revenue ledger entry for referral expense (negative amount)
  INSERT INTO public.platform_revenue_ledger (
    transaction_id,
    revenue_type,
    amount_ttd,
    points_involved,
    user_value_per_point,
    is_liquid,
    bank_account_id,
    metadata
  )
  VALUES (
    v_bonus_transaction_id,
    'referral_expense',
    -v_referral_expense_ttd, -- Negative because it's an expense
    v_bonus_points,
    v_user_value_per_point,
    true, -- Referral expense reduces liquid revenue immediately
    v_bank_account_id, -- Same bank account as the topup
    jsonb_build_object(
      'referral_id', v_referral.id,
      'referred_user_id', p_referred_user_id,
      'topup_transaction_id', p_topup_transaction_id,
      'topup_number', v_topup_count
    )
  );

  -- Update referrer's wallet - credit earnings_points instead of points_balance
  UPDATE public.wallets
  SET earnings_points = v_referrer_earnings_after,
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

-- Update comment to reflect the change
COMMENT ON FUNCTION public.process_referral_bonus IS 'Processes referral bonus, credits earnings_points (not points_balance), creates wallet_earnings_ledger entry, includes amount_ttd in transaction, deducts from platform liquid revenue, and creates referral_expense ledger entry';

