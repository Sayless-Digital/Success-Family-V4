-- =============================================
-- BACKFILL REVENUE LEDGER FOR HISTORICAL TRANSACTIONS
-- Creates revenue ledger entries for all historical transactions
-- =============================================

DO $$
DECLARE
  v_tx RECORD;
  v_platform_profit_ttd NUMERIC;
  v_platform_revenue_ttd NUMERIC;
  v_referral_expense_ttd NUMERIC;
  v_inserted_count INTEGER := 0;
  v_topup_tx RECORD;
BEGIN
  -- 1. Backfill topup_profit entries for all verified top_up transactions
  FOR v_tx IN
    SELECT 
      t.id,
      t.user_id,
      t.amount_ttd,
      t.points_delta,
      t.buy_price_per_point_at_time,
      t.user_value_per_point_at_time,
      t.bank_account_id,
      t.created_at
    FROM public.transactions t
    WHERE t.type = 'top_up'
      AND t.status = 'verified'
      AND t.buy_price_per_point_at_time IS NOT NULL
      AND t.user_value_per_point_at_time IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_revenue_ledger prl
        WHERE prl.transaction_id = t.id
          AND prl.revenue_type = 'topup_profit'
      )
  LOOP
    -- Calculate platform profit: (buy_price - user_value) * points
    v_platform_profit_ttd := (v_tx.buy_price_per_point_at_time - v_tx.user_value_per_point_at_time) * v_tx.points_delta;

    -- Insert revenue ledger entry
    INSERT INTO public.platform_revenue_ledger (
      transaction_id,
      revenue_type,
      amount_ttd,
      points_involved,
      buy_price_per_point,
      user_value_per_point,
      is_liquid,
      bank_account_id,
      created_at
    )
    VALUES (
      v_tx.id,
      'topup_profit',
      v_platform_profit_ttd,
      v_tx.points_delta,
      v_tx.buy_price_per_point_at_time,
      v_tx.user_value_per_point_at_time,
      true, -- Assume historical revenue is liquid
      v_tx.bank_account_id,
      v_tx.created_at
    );

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RAISE NOTICE 'Inserted % topup_profit ledger entries', v_inserted_count;
  v_inserted_count := 0;

  -- 2. Backfill voice_note_fee entries for point_spend transactions with NULL recipient
  -- These are voice notes (points_delta = -1 and recipient is NULL)
  FOR v_tx IN
    SELECT 
      t.id,
      t.user_id,
      t.points_delta,
      t.user_value_per_point_at_time,
      t.created_at
    FROM public.transactions t
    WHERE t.type = 'point_spend'
      AND t.recipient_user_id IS NULL
      AND t.points_delta = -1
      AND t.user_value_per_point_at_time IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_revenue_ledger prl
        WHERE prl.transaction_id = t.id
          AND prl.revenue_type = 'voice_note_fee'
      )
  LOOP
    -- Calculate platform revenue: user_value * points_spent
    v_platform_revenue_ttd := v_tx.user_value_per_point_at_time * ABS(v_tx.points_delta);

    -- Insert revenue ledger entry
    INSERT INTO public.platform_revenue_ledger (
      transaction_id,
      revenue_type,
      amount_ttd,
      points_involved,
      user_value_per_point,
      is_liquid,
      created_at
    )
    VALUES (
      v_tx.id,
      'voice_note_fee',
      v_platform_revenue_ttd,
      ABS(v_tx.points_delta),
      v_tx.user_value_per_point_at_time,
      true,
      v_tx.created_at
    );

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RAISE NOTICE 'Inserted % voice_note_fee ledger entries', v_inserted_count;
  v_inserted_count := 0;

  -- 3. Backfill live_event_fee entries for point_spend transactions with NULL recipient
  -- These are live event creation fees (points_delta < -1 and recipient is NULL)
  -- We need to check if there's a corresponding community_event with points_charged
  FOR v_tx IN
    SELECT 
      t.id,
      t.user_id,
      t.points_delta,
      t.user_value_per_point_at_time,
      t.created_at
    FROM public.transactions t
    WHERE t.type = 'point_spend'
      AND t.recipient_user_id IS NULL
      AND t.points_delta < -1
      AND t.user_value_per_point_at_time IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_revenue_ledger prl
        WHERE prl.transaction_id = t.id
          AND prl.revenue_type IN ('voice_note_fee', 'live_event_fee')
      )
      -- Check if there's a corresponding event with matching points_charged
      AND EXISTS (
        SELECT 1 FROM public.community_events ce
        WHERE ce.owner_id = t.user_id
          AND ce.points_charged = ABS(t.points_delta)
          AND ce.created_at <= t.created_at + INTERVAL '1 minute'
          AND ce.created_at >= t.created_at - INTERVAL '1 minute'
      )
  LOOP
    -- Calculate platform revenue: user_value * points_charged
    v_platform_revenue_ttd := v_tx.user_value_per_point_at_time * ABS(v_tx.points_delta);

    -- Get event_id for metadata
    DECLARE
      v_event_id UUID;
    BEGIN
      SELECT ce.id INTO v_event_id
      FROM public.community_events ce
      WHERE ce.owner_id = v_tx.user_id
        AND ce.points_charged = ABS(v_tx.points_delta)
        AND ce.created_at <= v_tx.created_at + INTERVAL '1 minute'
        AND ce.created_at >= v_tx.created_at - INTERVAL '1 minute'
      LIMIT 1;

      -- Insert revenue ledger entry
      INSERT INTO public.platform_revenue_ledger (
        transaction_id,
        revenue_type,
        amount_ttd,
        points_involved,
        user_value_per_point,
        is_liquid,
        metadata,
        created_at
      )
      VALUES (
        v_tx.id,
        'live_event_fee',
        v_platform_revenue_ttd,
        ABS(v_tx.points_delta),
        v_tx.user_value_per_point_at_time,
        true,
        CASE WHEN v_event_id IS NOT NULL THEN jsonb_build_object('event_id', v_event_id) ELSE NULL END,
        v_tx.created_at
      );

      v_inserted_count := v_inserted_count + 1;
    END;
  END LOOP;

  RAISE NOTICE 'Inserted % live_event_fee ledger entries', v_inserted_count;
  v_inserted_count := 0;

  -- 4. Backfill referral_expense entries for referral_bonus transactions
  FOR v_tx IN
    SELECT 
      t.id,
      t.user_id,
      t.points_delta,
      t.user_value_per_point_at_time,
      t.recipient_user_id,
      t.created_at,
      rt.transaction_id as topup_transaction_id,
      r.id as referral_id
    FROM public.transactions t
    JOIN public.referral_topups rt ON rt.referrer_bonus_transaction_id = t.id
    JOIN public.referrals r ON r.id = rt.referral_id
    WHERE t.type = 'referral_bonus'
      AND t.user_value_per_point_at_time IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_revenue_ledger prl
        WHERE prl.transaction_id = t.id
          AND prl.revenue_type = 'referral_expense'
      )
  LOOP
    -- Calculate referral expense: user_value * bonus_points
    v_referral_expense_ttd := v_tx.user_value_per_point_at_time * v_tx.points_delta;

    -- Get bank_account_id from topup transaction
    SELECT bank_account_id INTO v_topup_tx
    FROM public.transactions
    WHERE id = v_tx.topup_transaction_id;

    -- Insert revenue ledger entry (negative amount for expense)
    INSERT INTO public.platform_revenue_ledger (
      transaction_id,
      revenue_type,
      amount_ttd,
      points_involved,
      user_value_per_point,
      is_liquid,
      bank_account_id,
      metadata,
      created_at
    )
    VALUES (
      v_tx.id,
      'referral_expense',
      -v_referral_expense_ttd, -- Negative because it's an expense
      v_tx.points_delta,
      v_tx.user_value_per_point_at_time,
      true,
      v_topup_tx.bank_account_id,
      jsonb_build_object(
        'referral_id', v_tx.referral_id,
        'referred_user_id', v_tx.recipient_user_id,
        'topup_transaction_id', v_tx.topup_transaction_id
      ),
      v_tx.created_at
    );

    v_inserted_count := v_inserted_count + 1;
  END LOOP;

  RAISE NOTICE 'Inserted % referral_expense ledger entries', v_inserted_count;

  RAISE NOTICE 'Revenue ledger backfill completed.';
END $$;

-- Add comment documenting the backfill
COMMENT ON TABLE public.platform_revenue_ledger IS 
  'Tracks all platform revenue and expenses with historical pricing accuracy. Note: Entries for transactions created before 2025-01-14 were backfilled and may use approximated historical values.';

