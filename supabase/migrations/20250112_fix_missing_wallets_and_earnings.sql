-- =============================================
-- FIX MISSING WALLETS AND EARNINGS
-- Creates wallets for users with earnings/transactions but no wallets
-- Updates wallet balances based on existing earnings ledger entries
-- =============================================

-- 1. Create wallets for users with earnings ledger entries but no wallets
INSERT INTO public.wallets (user_id, points_balance, earnings_points, locked_earnings_points)
SELECT DISTINCT
  wel.user_id,
  0::BIGINT as points_balance,
  0::BIGINT as earnings_points,
  0::BIGINT as locked_earnings_points
FROM public.wallet_earnings_ledger wel
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallets w WHERE w.user_id = wel.user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- 2. Create wallets for users with transactions but no wallets
INSERT INTO public.wallets (user_id, points_balance, earnings_points, locked_earnings_points)
SELECT DISTINCT
  t.user_id,
  0::BIGINT as points_balance,
  0::BIGINT as earnings_points,
  0::BIGINT as locked_earnings_points
FROM public.transactions t
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallets w WHERE w.user_id = t.user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- 3. Recalculate wallet balances from source of truth
-- For each user, recalculate earnings_points from confirmed earnings ledger entries
-- Note: Earnings are 'pending' until they mature, then become 'confirmed'
-- The process_matured_earnings function handles the transition and updates wallet balances
-- But we need to sync wallet balances with confirmed ledger entries
UPDATE public.wallets w
SET earnings_points = COALESCE(confirmed_earnings.total, 0),
    updated_at = now()
FROM (
  SELECT 
    user_id,
    COALESCE(SUM(points), 0)::BIGINT as total
  FROM public.wallet_earnings_ledger
  WHERE status = 'confirmed'
  GROUP BY user_id
) confirmed_earnings
WHERE w.user_id = confirmed_earnings.user_id;

-- Set earnings_points to 0 for users with no confirmed earnings
UPDATE public.wallets
SET earnings_points = 0,
    updated_at = now()
WHERE earnings_points IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.wallet_earnings_ledger wel
    WHERE wel.user_id = wallets.user_id
      AND wel.status = 'confirmed'
  );

-- Note: locked_earnings_points is managed by the payout system
-- and doesn't have a corresponding status in the ledger
-- We'll leave it as is for existing wallets
UPDATE public.wallets
SET locked_earnings_points = COALESCE(locked_earnings_points, 0),
    updated_at = now()
WHERE locked_earnings_points IS NULL;

-- 4. Recalculate points_balance from transactions
-- Only count transactions that affect points_balance (not earnings)
-- Note: This assumes existing wallets have correct balances, we're just fixing missing wallets
-- For existing wallets, we don't recalculate to avoid issues with historical data
-- For new wallets (just created), set balance based on verified transactions
UPDATE public.wallets w
SET points_balance = COALESCE(GREATEST(0, tx_balance.total_delta), 0),
    updated_at = now()
FROM (
  SELECT 
    user_id,
    SUM(points_delta) as total_delta
  FROM public.transactions
  WHERE type IN ('top_up', 'point_spend', 'point_refund', 'payout')
    AND status = 'verified'
  GROUP BY user_id
) tx_balance
WHERE w.user_id = tx_balance.user_id
  AND w.points_balance = 0  -- Only update if balance is 0 (newly created wallet)
  AND tx_balance.total_delta != 0;

-- 5. Process any pending earnings that have matured
-- This will move pending earnings to confirmed status and update wallet balances
-- Process in batches until no more pending earnings are found
DO $$
DECLARE
  v_has_more BOOLEAN := true;
  v_count INTEGER;
BEGIN
  WHILE v_has_more LOOP
    -- Process up to 1000 pending earnings
    SELECT COUNT(*) INTO v_count
    FROM public.process_matured_earnings(NULL, 1000);
    
    -- If no earnings were processed, we're done
    IF v_count = 0 THEN
      v_has_more := false;
    END IF;
    
    -- Safety check: don't loop forever
    EXIT WHEN v_count = 0;
  END LOOP;
END $$;

-- 6. Create a helper function to ensure wallet exists (for future use)
CREATE OR REPLACE FUNCTION public.ensure_wallet_exists(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Add comment
COMMENT ON FUNCTION public.ensure_wallet_exists IS 'Ensures a wallet exists for a user. Safe to call multiple times.';

