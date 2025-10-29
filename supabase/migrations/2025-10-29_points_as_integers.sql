-- Convert points to integer across schema
ALTER TABLE public.wallets
  ALTER COLUMN points_balance TYPE BIGINT USING FLOOR(points_balance)::BIGINT;

ALTER TABLE public.transactions
  ALTER COLUMN points_delta TYPE BIGINT USING FLOOR(points_delta)::BIGINT;

-- Replace apply_topup with integer points version
DROP FUNCTION IF EXISTS public.apply_topup(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.apply_topup(p_user_id UUID, p_amount_ttd NUMERIC)
RETURNS TABLE (transaction_id UUID, points_before BIGINT, points_after BIGINT, points_credited BIGINT, platform_fee_ttd NUMERIC) AS $$
DECLARE
  v_dollars_per_point NUMERIC;
  v_platform_fee_percent NUMERIC;
  v_platform_fee_ttd NUMERIC;
  v_points_credited BIGINT;
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_tx_id UUID;
BEGIN
  SELECT dollars_per_point, platform_fee_percent INTO v_dollars_per_point, v_platform_fee_percent
  FROM public.platform_settings WHERE id = 1;

  IF v_dollars_per_point IS NULL THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  v_platform_fee_ttd := ROUND(p_amount_ttd * (v_platform_fee_percent / 100.0), 2);
  v_points_credited := FLOOR((p_amount_ttd - v_platform_fee_ttd) / v_dollars_per_point);

  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id, points_balance, last_topup_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT points_balance INTO v_points_before FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  v_points_after := v_points_before + v_points_credited;

  -- Insert transaction
  INSERT INTO public.transactions (user_id, type, amount_ttd, platform_fee_ttd, points_delta)
  VALUES (p_user_id, 'top_up', p_amount_ttd, v_platform_fee_ttd, v_points_credited)
  RETURNING id INTO v_tx_id;

  -- Update wallet
  UPDATE public.wallets
  SET points_balance = v_points_after, last_topup_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_tx_id, v_points_before, v_points_after, v_points_credited, v_platform_fee_ttd;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


