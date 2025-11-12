-- =============================================
-- ADD FIRST TOP-UP TRACKING
-- Adds column to track if user has completed their first top-up
-- =============================================

-- Add has_completed_first_topup column to wallets table
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS has_completed_first_topup BOOLEAN NOT NULL DEFAULT false;

-- Update existing wallets to set has_completed_first_topup based on transaction history
-- If user has any verified top_up transactions, they've completed their first top-up
UPDATE public.wallets w
SET has_completed_first_topup = true
WHERE EXISTS (
  SELECT 1
  FROM public.transactions t
  WHERE t.user_id = w.user_id
    AND t.type = 'top_up'
    AND t.status = 'verified'
  LIMIT 1
);

COMMENT ON COLUMN public.wallets.has_completed_first_topup IS 'Whether the user has completed their first top-up (used for bonus eligibility)';

