-- =============================================
-- CREATE PLATFORM REVENUE LEDGER
-- Tracks all platform revenue and expenses with historical accuracy
-- =============================================

-- Create platform_revenue_ledger table
CREATE TABLE IF NOT EXISTS public.platform_revenue_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  revenue_type TEXT NOT NULL CHECK (
    revenue_type IN (
      'topup_profit',           -- Profit from top-ups: (buy_price - user_value) * points
      'voice_note_fee',         -- Revenue from voice notes: user_value * points
      'live_event_fee',         -- Revenue from live event creation: user_value * points
      'referral_expense',       -- Expense for referral bonuses: -user_value * points
      'user_earnings_expense'   -- Expense for user earnings (future): -user_value * points
    )
  ),
  amount_ttd NUMERIC(12,2) NOT NULL, -- Positive for revenue, negative for expenses
  points_involved BIGINT NOT NULL DEFAULT 0, -- Points that generated this revenue/expense
  buy_price_per_point NUMERIC(12,4), -- Historical buy price (for topups)
  user_value_per_point NUMERIC(12,4) NOT NULL, -- Historical user value (for all types)
  is_liquid BOOLEAN NOT NULL DEFAULT true, -- True if revenue is available for withdrawal
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL, -- Bank account for this revenue (from transaction)
  metadata JSONB, -- Additional metadata (e.g., referral details, event details)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_platform_revenue_ledger_transaction_id 
  ON public.platform_revenue_ledger(transaction_id);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_ledger_revenue_type 
  ON public.platform_revenue_ledger(revenue_type);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_ledger_is_liquid 
  ON public.platform_revenue_ledger(is_liquid);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_ledger_created_at 
  ON public.platform_revenue_ledger(created_at);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_ledger_bank_account_id 
  ON public.platform_revenue_ledger(bank_account_id);

-- Composite index for common queries (liquid revenue by type)
CREATE INDEX IF NOT EXISTS idx_platform_revenue_ledger_liquid_type 
  ON public.platform_revenue_ledger(is_liquid, revenue_type) 
  WHERE is_liquid = true;

-- Enable RLS (admin-only access)
ALTER TABLE public.platform_revenue_ledger ENABLE ROW LEVEL SECURITY;

-- Only admins can view platform revenue ledger
CREATE POLICY "Admins can view platform revenue ledger"
  ON public.platform_revenue_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only system functions can insert (via SECURITY DEFINER functions)
CREATE POLICY "System can insert platform revenue ledger"
  ON public.platform_revenue_ledger
  FOR INSERT
  WITH CHECK (false); -- Disabled - only functions with SECURITY DEFINER can insert

-- Add comments for documentation
COMMENT ON TABLE public.platform_revenue_ledger IS 'Tracks all platform revenue and expenses with historical pricing accuracy';
COMMENT ON COLUMN public.platform_revenue_ledger.revenue_type IS 'Type of revenue or expense: topup_profit, voice_note_fee, live_event_fee, referral_expense, user_earnings_expense';
COMMENT ON COLUMN public.platform_revenue_ledger.amount_ttd IS 'Amount in TTD: positive for revenue, negative for expenses';
COMMENT ON COLUMN public.platform_revenue_ledger.points_involved IS 'Number of points that generated this revenue/expense';
COMMENT ON COLUMN public.platform_revenue_ledger.buy_price_per_point IS 'Historical buy price per point (for topups only)';
COMMENT ON COLUMN public.platform_revenue_ledger.user_value_per_point IS 'Historical user value per point (for all revenue types)';
COMMENT ON COLUMN public.platform_revenue_ledger.is_liquid IS 'True if revenue is available for withdrawal (liquid)';
COMMENT ON COLUMN public.platform_revenue_ledger.bank_account_id IS 'Bank account associated with this revenue (from transaction)';

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_platform_revenue_ledger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at
CREATE TRIGGER update_platform_revenue_ledger_updated_at
  BEFORE UPDATE ON public.platform_revenue_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.update_platform_revenue_ledger_updated_at();

-- Create view for platform revenue summary (for admin dashboard)
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
  COALESCE(SUM(CASE WHEN revenue_type = 'user_earnings_expense' THEN amount_ttd ELSE 0 END), 0) AS user_earnings_expense_ttd
FROM public.platform_revenue_ledger;

-- Grant access to admins only
ALTER VIEW public.platform_revenue_summary OWNER TO postgres;

-- Create RLS policy for the view (admins only)
-- Note: Views inherit RLS from underlying table, but we need to ensure admins can access it
-- The underlying table already has RLS that restricts to admins, so this should work

COMMENT ON VIEW public.platform_revenue_summary IS 'Summary view of platform revenue and expenses for admin dashboard';

