-- =============================================
-- UPDATE APPLY_TOPUP TO APPLY BONUS TO ANY TOP-UP IN TIMEFRAME
-- Removes first top-up restriction, applies bonus to anyone within expiration timeframe
-- =============================================

-- Update apply_topup function to remove first top-up check and add expiration time check
DROP FUNCTION IF EXISTS public.apply_topup(UUID, NUMERIC, UUID);

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
  -- Bonus-related variables
  v_bonus_enabled BOOLEAN;
  v_bonus_points BIGINT;
  v_bonus_end_time TIMESTAMPTZ;
  v_bonus_cost_ttd NUMERIC;
  v_earnings_ledger_id UUID; -- To store the ID of the earnings ledger entry
BEGIN
  -- Get current pricing and bonus settings from platform settings (historical snapshot)
  SELECT buy_price_per_point, user_value_per_point, topup_bonus_enabled, topup_bonus_points, topup_bonus_end_time
  INTO v_buy_price_per_point, v_user_value_per_point, v_bonus_enabled, v_bonus_points, v_bonus_end_time
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

  -- Process top-up bonus if eligible and not expired (applies to ANY top-up within timeframe)
  IF v_bonus_enabled = true AND v_bonus_points > 0 AND (v_bonus_end_time IS NULL OR now() < v_bonus_end_time) THEN
    -- Calculate bonus cost: user_value_per_point * bonus_points
    v_bonus_cost_ttd := v_user_value_per_point * v_bonus_points;

    -- Credit bonus points to earnings
    v_earnings_ledger_id := public.credit_user_earnings(
      p_user_id,
      v_bonus_points,
      'topup_bonus', -- source_type
      v_tx_id,       -- source_id (link to the top-up transaction)
      0,             -- hold_seconds (immediately available)
      jsonb_build_object('topup_transaction_id', v_tx_id)
    );

    -- Create revenue ledger entry for bonus expense (negative amount)
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
      v_earnings_ledger_id, -- Link to the earnings ledger entry's transaction
      'topup_bonus_expense',
      -v_bonus_cost_ttd, -- Negative because it's an expense
      v_bonus_points,
      v_user_value_per_point,
      true, -- Bonus expense reduces liquid revenue immediately
      p_bank_account_id, -- Same bank account as the topup
      jsonb_build_object(
        'topup_transaction_id', v_tx_id,
        'bonus_points_awarded', v_bonus_points
      )
    );
  END IF;

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

COMMENT ON FUNCTION public.apply_topup IS 'Applies a top-up, stores historical pricing, creates revenue ledger entry for platform profit, and awards bonus points to any user within the expiration timeframe if bonus is enabled';

