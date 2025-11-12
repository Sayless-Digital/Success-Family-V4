-- =============================================
-- UPDATE TRANSACTION FUNCTIONS WITH HISTORICAL PRICING
-- Updates all transaction functions to store historical pricing and create revenue ledger entries
-- =============================================

-- 1. Drop old apply_topup function and create new one with historical pricing and revenue ledger
DROP FUNCTION IF EXISTS public.apply_topup(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.apply_topup(
  p_user_id UUID,
  p_amount_ttd NUMERIC,
  p_bank_account_id UUID DEFAULT NULL
)
RETURNS TABLE (transaction_id UUID, points_before BIGINT, points_after BIGINT, points_credited BIGINT) AS $$
DECLARE
  v_buy_price_per_point NUMERIC;
  v_user_value_per_point NUMERIC;
  v_points_credited BIGINT;
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_tx_id UUID;
  v_next_due DATE;
  v_platform_profit_ttd NUMERIC;
  v_referral_bonus_id UUID;
BEGIN
  -- Get current pricing from platform settings (historical snapshot)
  SELECT buy_price_per_point, user_value_per_point
  INTO v_buy_price_per_point, v_user_value_per_point
  FROM public.platform_settings
  WHERE id = 1;

  IF v_buy_price_per_point IS NULL OR v_buy_price_per_point <= 0 THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  IF v_user_value_per_point IS NULL OR v_user_value_per_point <= 0 THEN
    RAISE EXCEPTION 'Platform settings not configured (user_value_per_point)';
  END IF;

  -- Calculate points to credit
  v_points_credited := FLOOR(p_amount_ttd / v_buy_price_per_point);
  IF v_points_credited <= 0 THEN
    RAISE EXCEPTION 'Top up amount % is too low for point price %', p_amount_ttd, v_buy_price_per_point;
  END IF;

  -- Calculate platform profit: (buy_price - user_value) * points
  v_platform_profit_ttd := (v_buy_price_per_point - v_user_value_per_point) * v_points_credited;

  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current balance with row lock
  SELECT points_balance INTO v_points_before
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_points_after := v_points_before + v_points_credited;

  -- Insert transaction with historical pricing
  INSERT INTO public.transactions (
    user_id,
    type,
    amount_ttd,
    points_delta,
    status,
    bank_account_id,
    buy_price_per_point_at_time,
    user_value_per_point_at_time,
    created_at
  )
  VALUES (
    p_user_id,
    'top_up',
    p_amount_ttd,
    v_points_credited,
    'verified',
    p_bank_account_id,
    v_buy_price_per_point,
    v_user_value_per_point,
    now()
  )
  RETURNING id INTO v_tx_id;

  -- Create revenue ledger entry for topup profit
  INSERT INTO public.platform_revenue_ledger (
    transaction_id,
    revenue_type,
    amount_ttd,
    points_involved,
    buy_price_per_point,
    user_value_per_point,
    is_liquid,
    bank_account_id
  )
  VALUES (
    v_tx_id,
    'topup_profit',
    v_platform_profit_ttd,
    v_points_credited,
    v_buy_price_per_point,
    v_user_value_per_point,
    true, -- Top-up profit is immediately liquid
    p_bank_account_id
  );

  -- Update wallet
  v_next_due := (now() + INTERVAL '1 month')::date;
  UPDATE public.wallets
  SET points_balance = v_points_after,
      last_topup_at = now(),
      last_mandatory_topup_at = now(),
      next_topup_due_on = v_next_due,
      updated_at = now()
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

-- 2. Update verify_receipt to pass bank_account_id to apply_topup
CREATE OR REPLACE FUNCTION public.verify_receipt(p_receipt_id UUID)
RETURNS UUID AS $$
DECLARE
  v_receipt RECORD;
  v_tx RECORD;
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can verify receipts';
  END IF;

  SELECT * INTO v_receipt FROM public.receipts WHERE id = p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found';
  END IF;
  IF v_receipt.status <> 'pending' THEN
    RAISE EXCEPTION 'Receipt is not pending';
  END IF;

  -- Apply topup (creates transaction and credits wallet, passes bank_account_id)
  SELECT * INTO v_tx 
  FROM public.apply_topup(v_receipt.user_id, v_receipt.amount_ttd, v_receipt.bank_account_id) 
  AS (transaction_id UUID, points_before BIGINT, points_after BIGINT, points_credited BIGINT);

  -- Update receipt -> verified and link transaction
  UPDATE public.receipts
  SET status = 'verified', verified_by = v_admin_id, verified_at = now(), transaction_id = v_tx.transaction_id
  WHERE id = v_receipt.id;

  RETURN v_tx.transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update deduct_points_for_voice_notes to store historical pricing and create revenue ledger entry
CREATE OR REPLACE FUNCTION public.deduct_points_for_voice_notes(
  p_user_id UUID,
  p_point_cost BIGINT
)
RETURNS JSON AS $$
DECLARE
  v_user_balance BIGINT;
  v_user_value_per_point NUMERIC;
  v_platform_revenue_ttd NUMERIC;
  v_tx_id UUID;
  v_result JSON;
BEGIN
  -- Get current user_value_per_point (historical snapshot)
  SELECT user_value_per_point INTO v_user_value_per_point
  FROM public.platform_settings
  WHERE id = 1;

  IF v_user_value_per_point IS NULL OR v_user_value_per_point <= 0 THEN
    RAISE EXCEPTION 'Platform settings not configured';
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

  -- Calculate platform revenue: user_value_per_point * points_spent
  v_platform_revenue_ttd := v_user_value_per_point * p_point_cost;

  -- Deduct points
  UPDATE public.wallets
  SET points_balance = points_balance - p_point_cost,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Create transaction record with historical pricing
  INSERT INTO public.transactions (
    user_id,
    type,
    points_delta,
    recipient_user_id,
    user_value_per_point_at_time,
    created_at
  )
  VALUES (
    p_user_id,
    'point_spend',
    -p_point_cost,
    NULL, -- NULL recipient = platform fee
    v_user_value_per_point,
    NOW()
  )
  RETURNING id INTO v_tx_id;

  -- Create revenue ledger entry for voice note fee
  INSERT INTO public.platform_revenue_ledger (
    transaction_id,
    revenue_type,
    amount_ttd,
    points_involved,
    user_value_per_point,
    is_liquid
  )
  VALUES (
    v_tx_id,
    'voice_note_fee',
    v_platform_revenue_ttd,
    p_point_cost,
    v_user_value_per_point,
    true -- Voice note revenue is immediately liquid
  );

  v_result := json_build_object(
    'success', true,
    'points_deducted', p_point_cost,
    'remaining_balance', v_user_balance - p_point_cost,
    'message', 'Points deducted successfully'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Update deduct_points_for_stream_creation to store historical pricing and create revenue ledger entry
CREATE OR REPLACE FUNCTION public.deduct_points_for_stream_creation(
  p_user_id UUID,
  p_event_id UUID,
  p_point_cost BIGINT
)
RETURNS UUID AS $$
DECLARE
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_user_value_per_point NUMERIC;
  v_platform_revenue_ttd NUMERIC;
  v_tx_id UUID;
BEGIN
  -- Get current user_value_per_point (historical snapshot)
  SELECT user_value_per_point INTO v_user_value_per_point
  FROM public.platform_settings
  WHERE id = 1;

  IF v_user_value_per_point IS NULL OR v_user_value_per_point <= 0 THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

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

  -- Calculate platform revenue: user_value_per_point * points_charged
  v_platform_revenue_ttd := v_user_value_per_point * p_point_cost;

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

  -- Create transaction with historical pricing
  INSERT INTO public.transactions (
    user_id,
    type,
    points_delta,
    recipient_user_id,
    user_value_per_point_at_time,
    created_at
  )
  VALUES (
    p_user_id,
    'point_spend',
    -p_point_cost,
    NULL, -- NULL recipient = platform fee
    v_user_value_per_point,
    now()
  )
  RETURNING id INTO v_tx_id;

  -- Create revenue ledger entry for live event fee
  INSERT INTO public.platform_revenue_ledger (
    transaction_id,
    revenue_type,
    amount_ttd,
    points_involved,
    user_value_per_point,
    is_liquid,
    metadata
  )
  VALUES (
    v_tx_id,
    'live_event_fee',
    v_platform_revenue_ttd,
    p_point_cost,
    v_user_value_per_point,
    true, -- Live event revenue is immediately liquid
    jsonb_build_object('event_id', p_event_id)
  );

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

-- 5. Update process_referral_bonus to deduct from liquid revenue and create referral_expense ledger entry
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
  v_referrer_points_before BIGINT;
  v_referrer_points_after BIGINT;
  v_bonus_transaction_id UUID;
  v_bank_account_id UUID;
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
    user_value_per_point_at_time,
    status,
    created_at
  )
  VALUES (
    v_referral.referrer_user_id,
    'referral_bonus',
    v_bonus_points,
    p_referred_user_id,
    v_user_value_per_point,
    'verified',
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

-- Add comments for documentation
COMMENT ON FUNCTION public.apply_topup IS 'Applies a top-up, stores historical pricing, and creates revenue ledger entry for platform profit';
COMMENT ON FUNCTION public.deduct_points_for_voice_notes IS 'Deducts points for voice note, stores historical pricing, and creates revenue ledger entry';
COMMENT ON FUNCTION public.deduct_points_for_stream_creation IS 'Deducts points for live event creation, stores historical pricing, and creates revenue ledger entry';
COMMENT ON FUNCTION public.process_referral_bonus IS 'Processes referral bonus, deducts from platform liquid revenue, and creates referral_expense ledger entry';

