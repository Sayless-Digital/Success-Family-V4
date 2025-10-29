-- Add cents_per_point and drop point_value_ttd_per_point
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS cents_per_point NUMERIC(12,2) NOT NULL DEFAULT 100.00;

ALTER TABLE public.platform_settings
  DROP COLUMN IF EXISTS point_value_ttd_per_point;

-- Update apply_topup to use cents_per_point with cent-accurate calculations
CREATE OR REPLACE FUNCTION public.apply_topup(p_user_id UUID, p_amount_ttd NUMERIC)
RETURNS TABLE (transaction_id UUID, points_before NUMERIC, points_after NUMERIC, points_credited NUMERIC, platform_fee_ttd NUMERIC) AS $$
DECLARE
  v_cents_per_point NUMERIC;
  v_platform_fee_percent NUMERIC;
  v_amount_cents BIGINT;
  v_fee_cents BIGINT;
  v_points_credited NUMERIC;
  v_points_before NUMERIC;
  v_points_after NUMERIC;
  v_tx_id UUID;
BEGIN
  SELECT cents_per_point, platform_fee_percent INTO v_cents_per_point, v_platform_fee_percent
  FROM public.platform_settings WHERE id = 1;

  IF v_cents_per_point IS NULL THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  v_amount_cents := ROUND(p_amount_ttd * 100.0);
  v_fee_cents := ROUND(v_amount_cents * (v_platform_fee_percent / 100.0));

  -- points credited = (amount_cents - fee_cents) / cents_per_point
  v_points_credited := (v_amount_cents - v_fee_cents) / v_cents_per_point;

  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id, points_balance, last_topup_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT points_balance INTO v_points_before FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  v_points_after := v_points_before + v_points_credited;

  -- Insert transaction with TTD fee (convert fee_cents back to TTD)
  INSERT INTO public.transactions (user_id, type, amount_ttd, platform_fee_ttd, points_delta)
  VALUES (p_user_id, 'top_up', p_amount_ttd, (v_fee_cents / 100.0), v_points_credited)
  RETURNING id INTO v_tx_id;

  -- Update wallet
  UPDATE public.wallets
  SET points_balance = v_points_after, last_topup_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_tx_id, v_points_before, v_points_after, v_points_credited, (v_fee_cents / 100.0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


