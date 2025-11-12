-- =============================================
-- FIX debit_user_points COLUMN NAMES
-- The function was returning points_from_wallet/points_from_earnings
-- but boost_post expects wallet_points_spent/earnings_points_spent
-- =============================================

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS public.debit_user_points(UUID, BIGINT);
DROP FUNCTION IF EXISTS public.debit_user_points(UUID, BIGINT, JSONB);

-- Create the correct version with proper column names
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

  -- Process any matured earnings before debiting
  PERFORM public.process_matured_earnings(p_user_id, 100);

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

  -- Return with correct column names that boost_post expects
  RETURN QUERY SELECT v_wallet_spent, v_earnings_spent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.debit_user_points(UUID, BIGINT) IS 'Debits points from user, prioritizing point_balance over earnings_points. Returns wallet_points_spent and earnings_points_spent.';

