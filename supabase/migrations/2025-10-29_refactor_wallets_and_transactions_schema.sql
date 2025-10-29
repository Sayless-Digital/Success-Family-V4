-- Create wallets table (replacing user_points_balances)
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  points_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  last_topup_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own wallet via functions" ON public.wallets FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Data migration from user_points_balances -> wallets
INSERT INTO public.wallets (user_id, points_balance, last_topup_at, updated_at)
SELECT user_id, points_balance, last_topup_at, updated_at FROM public.user_points_balances
ON CONFLICT (user_id) DO NOTHING;

-- Create unified transactions table (replacing topups)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('top_up','payout','point_spend','point_refund')),
  amount_ttd NUMERIC(12,2), -- present for monetary operations (top_up/payout)
  platform_fee_ttd NUMERIC(12,2), -- only for top_up currently
  points_delta NUMERIC(18,4) NOT NULL DEFAULT 0, -- positive to credit, negative to debit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own monetary transactions" ON public.transactions FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_transactions_user_created_at ON public.transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);

-- Recreate apply_topup to use wallets + transactions
DROP FUNCTION IF EXISTS public.apply_topup(UUID, NUMERIC);
CREATE OR REPLACE FUNCTION public.apply_topup(p_user_id UUID, p_amount_ttd NUMERIC)
RETURNS TABLE (transaction_id UUID, points_before NUMERIC, points_after NUMERIC, points_credited NUMERIC, platform_fee_ttd NUMERIC) AS $$
DECLARE
  v_point_value NUMERIC;
  v_platform_fee_percent NUMERIC;
  v_platform_fee_ttd NUMERIC;
  v_points_credited NUMERIC;
  v_points_before NUMERIC;
  v_points_after NUMERIC;
  v_tx_id UUID;
BEGIN
  SELECT point_value_ttd_per_point, platform_fee_percent INTO v_point_value, v_platform_fee_percent
  FROM public.platform_settings WHERE id = 1;

  IF v_point_value IS NULL THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  v_platform_fee_ttd := ROUND(p_amount_ttd * (v_platform_fee_percent / 100.0), 2);
  v_points_credited := (p_amount_ttd - v_platform_fee_ttd) / v_point_value;

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

-- Migrate data from topups -> transactions
INSERT INTO public.transactions (id, user_id, type, amount_ttd, platform_fee_ttd, points_delta, created_at)
SELECT id, user_id, 'top_up', amount_ttd, platform_fee_ttd, points_credited, created_at FROM public.topups
ON CONFLICT (id) DO NOTHING;

-- Drop old tables
DROP TABLE IF EXISTS public.user_points_balances CASCADE;
DROP TABLE IF EXISTS public.topups CASCADE;


