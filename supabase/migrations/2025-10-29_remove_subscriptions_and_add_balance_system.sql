-- Drop constraints that depend on subscriptions and plans
ALTER TABLE IF EXISTS public.payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_subscription_id_fkey;
ALTER TABLE IF EXISTS public.payment_receipts DROP CONSTRAINT IF EXISTS payment_receipts_plan_id_fkey;
ALTER TABLE IF EXISTS public.communities DROP CONSTRAINT IF EXISTS communities_plan_id_fkey;
ALTER TABLE IF EXISTS public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_community_id_fkey;
ALTER TABLE IF EXISTS public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_id_fkey;

-- Drop triggers referencing payment_receipts if any
DROP TRIGGER IF EXISTS set_invoice_number_trigger ON public.payment_receipts;
DROP FUNCTION IF EXISTS set_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS generate_invoice_number() CASCADE;

-- Drop subscriptions table
DROP TABLE IF EXISTS public.subscriptions CASCADE;

-- Drop payment_receipts table
DROP TABLE IF EXISTS public.payment_receipts CASCADE;

-- Drop subscription_plans table
DROP TABLE IF EXISTS public.subscription_plans CASCADE;

-- Remove subscription-related columns from communities
ALTER TABLE IF EXISTS public.communities 
  DROP COLUMN IF EXISTS plan_id,
  DROP COLUMN IF EXISTS billing_cycle,
  DROP COLUMN IF EXISTS subscription_start_date,
  DROP COLUMN IF EXISTS subscription_end_date,
  DROP COLUMN IF EXISTS next_billing_date,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancellation_reason,
  DROP COLUMN IF EXISTS pricing_type,
  DROP COLUMN IF EXISTS one_time_price,
  DROP COLUMN IF EXISTS monthly_price,
  DROP COLUMN IF EXISTS annual_price;

-- Drop enum types if no longer referenced
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_cycle') THEN
    DROP TYPE billing_cycle;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    DROP TYPE payment_status;
  END IF;
END $$;

-- New: platform settings for point value and platform fee
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  point_value_ttd_per_point NUMERIC(12,4) NOT NULL DEFAULT 1.00,
  platform_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure single row constraint by forcing id=1
INSERT INTO public.platform_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- New: user points balance (initial approach; superseded by wallets later)
CREATE TABLE IF NOT EXISTS public.user_points_balances (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  points_balance NUMERIC(18,4) NOT NULL DEFAULT 0,
  last_topup_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_points_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own points balance" ON public.user_points_balances
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own balance via controlled functions" ON public.user_points_balances
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- New: topups record (initial approach; superseded by transactions later)
CREATE TABLE IF NOT EXISTS public.topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_ttd NUMERIC(12,2) NOT NULL CHECK (amount_ttd >= 0),
  platform_fee_ttd NUMERIC(12,2) NOT NULL CHECK (platform_fee_ttd >= 0),
  points_credited NUMERIC(18,4) NOT NULL CHECK (points_credited >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.topups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own topups" ON public.topups
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own topups" ON public.topups
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Helper: function to apply a topup and credit points atomically (initial, replaced later)
CREATE OR REPLACE FUNCTION public.apply_topup(p_user_id UUID, p_amount_ttd NUMERIC)
RETURNS TABLE (topup_id UUID, points_before NUMERIC, points_after NUMERIC) AS $$
DECLARE
  v_point_value NUMERIC;
  v_platform_fee_percent NUMERIC;
  v_platform_fee_ttd NUMERIC;
  v_points_credited NUMERIC;
  v_points_before NUMERIC;
  v_points_after NUMERIC;
  v_topup_id UUID;
BEGIN
  SELECT point_value_ttd_per_point, platform_fee_percent INTO v_point_value, v_platform_fee_percent
  FROM public.platform_settings WHERE id = 1;

  IF v_point_value IS NULL THEN
    RAISE EXCEPTION 'Platform settings not configured';
  END IF;

  v_platform_fee_ttd := ROUND(p_amount_ttd * (v_platform_fee_percent / 100.0), 2);
  v_points_credited := (p_amount_ttd - v_platform_fee_ttd) / v_point_value;

  -- Upsert user balance row
  INSERT INTO public.user_points_balances (user_id, points_balance, last_topup_at)
  VALUES (p_user_id, 0, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT points_balance INTO v_points_before FROM public.user_points_balances WHERE user_id = p_user_id FOR UPDATE;
  v_points_after := v_points_before + v_points_credited;

  -- Insert topup record
  INSERT INTO public.topups (user_id, amount_ttd, platform_fee_ttd, points_credited)
  VALUES (p_user_id, p_amount_ttd, v_platform_fee_ttd, v_points_credited)
  RETURNING id INTO v_topup_id;

  -- Update balance
  UPDATE public.user_points_balances
  SET points_balance = v_points_after, last_topup_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_topup_id, v_points_before, v_points_after;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional index for monthly top-up checks
CREATE INDEX IF NOT EXISTS idx_topups_user_created_at ON public.topups(user_id, created_at);


