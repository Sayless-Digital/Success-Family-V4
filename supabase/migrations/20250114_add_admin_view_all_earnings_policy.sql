-- =============================================
-- ADD ADMIN POLICY FOR VIEWING ALL EARNINGS
-- This allows admins to view all earnings ledger entries,
-- not just their own, which is needed for revenue calculations
-- =============================================

-- Add RLS policy to allow admins to view all earnings ledger entries
-- This is necessary because the admin revenue page needs to see all user earnings
-- to calculate total money owed to users, regardless of who earned it
CREATE POLICY "Admins can view all earnings ledger"
  ON public.wallet_earnings_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

COMMENT ON POLICY "Admins can view all earnings ledger" ON public.wallet_earnings_ledger IS 
'Allows platform admins to view all earnings ledger entries for revenue calculations and administrative purposes. Regular users can still only view their own earnings via the existing policy.';

