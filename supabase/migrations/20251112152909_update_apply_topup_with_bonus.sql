-- =============================================
-- UPDATE APPLY_TOPUP WITH BONUS LOGIC
-- Adds top-up bonus feature that awards fixed bonus points on first top-up
-- =============================================

-- 1. Add 'topup_bonus' to transaction types (preserving all existing types)
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
        'earning_debit',
        'earning_lock',
        'referral_bonus',
        'manual_adjustment',
        'system_adjustment',
        'fee_charge',
        'fee_refund',
        'topup_bonus'
      ]::text[]
    )
  );

-- 2. Add 'topup_bonus_expense' to revenue_type constraint
ALTER TABLE public.platform_revenue_ledger
  DROP CONSTRAINT IF EXISTS platform_revenue_ledger_revenue_type_check;

ALTER TABLE public.platform_revenue_ledger
  ADD CONSTRAINT platform_revenue_ledger_revenue_type_check CHECK (
    revenue_type IN (
      'topup_profit',           -- Profit from top-ups: (buy_price - user_value) * points
      'voice_note_fee',         -- Revenue from voice notes: user_value * points
      'live_event_fee',         -- Revenue from live event creation: user_value * points
      'referral_expense',       -- Expense for referral bonuses: -user_value * points
      'user_earnings_expense',  -- Expense for user earnings (future): -user_value * points
      'topup_bonus_expense'     -- Expense for top-up bonuses: -user_value * bonus_points
    )
  );

-- 3. Update apply_topup function to include bonus logic
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
  v_has_completed_first_topup BOOLEAN;
  v_bonus_cost_ttd NUMERIC;
  v_bonus_tx_id UUID;
  v_bonus_points_after BIGINT;
BEGIN
  -- Get current pricing from platform settings (historical snapshot)
  SELECT buy_price_per_point, user_value_per_point, topup_bonus_enabled, topup_bonus_points
  INTO v_buy_price_per_point, v_user_value_per_point, v_bonus_enabled, v_bonus_points
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

  -- Get current balance and first top-up status with row lock
  SELECT points_balance, has_completed_first_topup INTO v_points_before, v_has_completed_first_topup
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

  -- Process top-up bonus if eligible
  IF v_bonus_enabled = true AND v_has_completed_first_topup = false AND v_bonus_points > 0 THEN
    -- Calculate bonus cost: user_value_per_point * bonus_points
    v_bonus_cost_ttd := v_user_value_per_point * v_bonus_points;
    
    -- Add bonus points to wallet
    v_bonus_points_after := v_points_after + v_bonus_points;
    
    -- Create bonus transaction
    INSERT INTO public.transactions (
      user_id,
      type,
      points_delta,
      user_value_per_point_at_time,
      status,
      created_at,
      context
    )
    VALUES (
      p_user_id,
      'topup_bonus',
      v_bonus_points,
      v_user_value_per_point,
      'verified',
      now(),
      jsonb_build_object('topup_transaction_id', v_tx_id)
    )
    RETURNING id INTO v_bonus_tx_id;
    
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
      v_bonus_tx_id,
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
    
    -- Update final points balance with bonus
    v_points_after := v_bonus_points_after;
  END IF;

  -- Update wallet (including has_completed_first_topup flag)
  v_next_due := (now() + INTERVAL '1 month')::date;
  UPDATE public.wallets
  SET points_balance = v_points_after,
      last_topup_at = now(),
      last_mandatory_topup_at = now(),
      next_topup_due_on = v_next_due,
      has_completed_first_topup = true, -- Mark as completed after first top-up
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

-- Update platform_revenue_summary view to include topup_bonus_expense
DROP VIEW IF EXISTS public.platform_revenue_summary;

CREATE OR REPLACE VIEW public.platform_revenue_summary AS
SELECT
  -- Total revenue (positive amounts from revenue types)
  COALESCE(SUM(CASE WHEN revenue_type IN ('topup_profit', 'voice_note_fee', 'live_event_fee') THEN amount_ttd ELSE 0 END), 0) AS total_revenue_ttd,
  
  -- Liquid revenue (positive amounts that are liquid)
  COALESCE(SUM(CASE WHEN is_liquid = true AND amount_ttd > 0 THEN amount_ttd ELSE 0 END), 0) AS liquid_revenue_ttd,
  
  -- Total expenses (negative amounts)
  COALESCE(SUM(CASE WHEN amount_ttd < 0 THEN ABS(amount_ttd) ELSE 0 END), 0) AS total_expenses_ttd,
  
  -- Net liquid revenue (liquid revenue - expenses)
  COALESCE(SUM(CASE WHEN is_liquid = true AND amount_ttd > 0 THEN amount_ttd ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN amount_ttd < 0 THEN ABS(amount_ttd) ELSE 0 END), 0) AS net_liquid_revenue_ttd,
  
  -- Breakdown by revenue type
  COALESCE(SUM(CASE WHEN revenue_type = 'topup_profit' THEN amount_ttd ELSE 0 END), 0) AS topup_profit_ttd,
  COALESCE(SUM(CASE WHEN revenue_type = 'voice_note_fee' THEN amount_ttd ELSE 0 END), 0) AS voice_note_fee_ttd,
  COALESCE(SUM(CASE WHEN revenue_type = 'live_event_fee' THEN amount_ttd ELSE 0 END), 0) AS live_event_fee_ttd,
  COALESCE(SUM(CASE WHEN revenue_type = 'referral_expense' THEN amount_ttd ELSE 0 END), 0) AS referral_expense_ttd,
  COALESCE(SUM(CASE WHEN revenue_type = 'user_earnings_expense' THEN amount_ttd ELSE 0 END), 0) AS user_earnings_expense_ttd,
  COALESCE(SUM(CASE WHEN revenue_type = 'topup_bonus_expense' THEN amount_ttd ELSE 0 END), 0) AS topup_bonus_expense_ttd
FROM public.platform_revenue_ledger;

-- Grant access to admins only
ALTER VIEW public.platform_revenue_summary OWNER TO postgres;

COMMENT ON FUNCTION public.apply_topup IS 'Applies a top-up, stores historical pricing, creates revenue ledger entry for platform profit, and awards bonus points on first top-up if bonus is enabled';

