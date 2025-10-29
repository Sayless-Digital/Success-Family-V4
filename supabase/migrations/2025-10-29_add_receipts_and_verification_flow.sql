-- Receipts for bank transfer uploads tied to wallet top-ups
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id),
  amount_ttd NUMERIC(12,2) NOT NULL CHECK (amount_ttd > 0),
  receipt_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_by UUID REFERENCES public.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own receipts" ON public.receipts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own receipts" ON public.receipts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage receipts" ON public.receipts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_receipts_user_created_at ON public.receipts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON public.receipts(status);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_receipts_updated_at ON public.receipts;
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Verification function: verify a receipt -> creates a top_up transaction and updates wallet
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

  -- Apply topup (creates transaction and credits wallet)
  SELECT * INTO v_tx FROM public.apply_topup(v_receipt.user_id, v_receipt.amount_ttd) AS (transaction_id UUID, points_before NUMERIC, points_after NUMERIC, points_credited NUMERIC, platform_fee_ttd NUMERIC);

  -- Update receipt -> verified and link transaction
  UPDATE public.receipts
  SET status = 'verified', verified_by = v_admin_id, verified_at = now(), transaction_id = v_tx.transaction_id
  WHERE id = v_receipt.id;

  RETURN v_tx.transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rejection function
CREATE OR REPLACE FUNCTION public.reject_receipt(p_receipt_id UUID, p_reason TEXT)
RETURNS VOID AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM public.users WHERE id = auth.uid() AND role = 'admin';
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Only admins can reject receipts';
  END IF;

  UPDATE public.receipts
  SET status = 'rejected', rejection_reason = COALESCE(p_reason, 'Not specified'), verified_by = v_admin_id, verified_at = now()
  WHERE id = p_receipt_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt not found or not pending';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


