-- =============================================
-- FIX MISSING EARNINGS_CREDIT TRANSACTIONS
-- This migration creates missing earnings_credit transactions for earnings ledger entries
-- that don't have corresponding transaction records
-- =============================================

-- Create missing earnings_credit transactions for the two boost earnings entries
-- These entries have status 'confirmed' and were created before the transaction was deleted
INSERT INTO public.transactions (
  id,
  user_id,
  type,
  amount_ttd,
  points_delta,
  earnings_points_delta,
  recipient_user_id,
  sender_user_id,
  source_type,
  source_id,
  ledger_entry_id,
  status,
  context,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(), -- Generate new transaction ID
  wel.user_id,
  'earning_credit',
  wel.amount_ttd,
  0, -- points_delta is 0 for earnings (they go to earnings_points, not points_balance)
  wel.points, -- earnings_points_delta
  (wel.metadata->>'from_user_id')::UUID, -- recipient_user_id (who sent the boost)
  (wel.metadata->>'from_user_id')::UUID, -- sender_user_id (same as recipient_user_id for earning_credit)
  wel.source_type,
  wel.source_id,
  wel.id, -- ledger_entry_id
  'verified',
  jsonb_build_object(
    'source_type', wel.source_type,
    'source_id', wel.source_id,
    'ledger_entry_id', wel.id,
    'recovered', true,
    'recovered_at', now()
  ),
  wel.created_at, -- Use the original earnings ledger created_at
  now()
FROM public.wallet_earnings_ledger wel
WHERE wel.id IN (
  '2122a601-9b0f-4ea2-849e-74ac6b4d2745',
  'e5e173dd-7ee8-4646-933a-4272bde7595e'
)
AND NOT EXISTS (
  SELECT 1 
  FROM public.transactions t 
  WHERE t.ledger_entry_id = wel.id
);

COMMENT ON TABLE public.transactions IS 'Transactions table. Some earnings_credit transactions may have been recovered if the original transaction was deleted.';

