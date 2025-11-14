-- =============================================
-- PLATFORM WITHDRAWALS
-- Adds table to track platform withdrawals from bank accounts
-- =============================================

-- Create platform_withdrawals table
CREATE TABLE IF NOT EXISTS public.platform_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE RESTRICT,
  amount_ttd NUMERIC(12,2) NOT NULL CHECK (amount_ttd > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'failed')) DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  processed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_withdrawals ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view and manage platform withdrawals
CREATE POLICY "Admins can view all platform withdrawals"
  ON public.platform_withdrawals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can create platform withdrawals"
  ON public.platform_withdrawals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
    AND requested_by = auth.uid()
  );

CREATE POLICY "Admins can update platform withdrawals"
  ON public.platform_withdrawals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_bank_account_id ON public.platform_withdrawals(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_status ON public.platform_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_requested_at ON public.platform_withdrawals(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_requested_by ON public.platform_withdrawals(requested_by);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.platform_withdrawals_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_platform_withdrawals_updated_at ON public.platform_withdrawals;
CREATE TRIGGER trg_platform_withdrawals_updated_at
  BEFORE UPDATE ON public.platform_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.platform_withdrawals_set_updated_at();

COMMENT ON TABLE public.platform_withdrawals IS 'Tracks platform withdrawals from bank accounts for revenue management';
COMMENT ON COLUMN public.platform_withdrawals.bank_account_id IS 'Bank account from which the withdrawal is made';
COMMENT ON COLUMN public.platform_withdrawals.amount_ttd IS 'Withdrawal amount in TTD';
COMMENT ON COLUMN public.platform_withdrawals.status IS 'Withdrawal status: pending, processing, completed, cancelled, failed';
COMMENT ON COLUMN public.platform_withdrawals.requested_by IS 'Admin user who requested the withdrawal';
COMMENT ON COLUMN public.platform_withdrawals.processed_by IS 'Admin user who processed the withdrawal';
COMMENT ON COLUMN public.platform_withdrawals.notes IS 'Additional notes about the withdrawal';






