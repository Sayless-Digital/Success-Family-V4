-- =============================================
-- BACKFILL BOOST SOURCE METADATA FOR OLD TRANSACTIONS
-- This migration attempts to determine the source of old boost transactions
-- and updates the earnings ledger metadata accordingly
-- =============================================

-- Update wallet_earnings_ledger metadata for existing boost earnings
-- Strategy:
-- 1. If transaction context has "matched_from_earn_tx", it likely came from earnings (transfer)
-- 2. Otherwise, we can't definitively determine, so we mark as "point_balance" (conservative approach)
--    This assumes users paid for points, which is the safer assumption for revenue calculation
UPDATE public.wallet_earnings_ledger wel
SET metadata = wel.metadata || jsonb_build_object(
  'boost_source', 
  CASE 
    -- Check if transaction context suggests it came from earnings
    WHEN EXISTS (
      SELECT 1 
      FROM public.transactions t
      JOIN public.post_boosts pb ON pb.id = (wel.metadata->>'boost_id')::UUID
      WHERE t.user_id = pb.user_id
        AND t.type = 'point_spend'
        AND t.recipient_user_id IS NOT NULL
        AND t.created_at BETWEEN pb.created_at - interval '5 seconds' AND pb.created_at + interval '5 seconds'
        AND t.context->>'matched_from_earn_tx' IS NOT NULL
    ) THEN 'earning_balance'
    -- Otherwise, assume it came from point_balance (conservative - user paid for points)
    ELSE 'point_balance'
  END,
  'is_transfer',
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM public.transactions t
      JOIN public.post_boosts pb ON pb.id = (wel.metadata->>'boost_id')::UUID
      WHERE t.user_id = pb.user_id
        AND t.type = 'point_spend'
        AND t.recipient_user_id IS NOT NULL
        AND t.created_at BETWEEN pb.created_at - interval '5 seconds' AND pb.created_at + interval '5 seconds'
        AND t.context->>'matched_from_earn_tx' IS NOT NULL
    ) THEN true
    ELSE false
  END,
  'backfilled', true,
  'backfilled_at', now()
)
WHERE wel.source_type = 'boost'
AND (wel.metadata->>'boost_source' IS NULL OR wel.metadata->>'boost_source' = '');

-- Also update transaction context for old boost transactions that don't have boost_source
UPDATE public.transactions t
SET context = COALESCE(t.context, '{}'::jsonb) || jsonb_build_object(
  'boost_source',
  CASE 
    -- Check if context has "matched_from_earn_tx" - suggests it came from earnings
    WHEN t.context->>'matched_from_earn_tx' IS NOT NULL THEN 'earning_balance'
    -- Otherwise, assume point_balance (conservative)
    ELSE 'point_balance'
  END,
  'is_transfer',
  CASE 
    WHEN t.context->>'matched_from_earn_tx' IS NOT NULL THEN true
    ELSE false
  END,
  'backfilled', true,
  'backfilled_at', now()
)
WHERE t.type = 'point_spend'
AND t.recipient_user_id IS NOT NULL
AND (t.context->>'boost_source' IS NULL OR t.context->>'boost_source' = '')
AND EXISTS (
  SELECT 1 
  FROM public.post_boosts pb
  WHERE pb.user_id = t.user_id
    AND pb.created_at BETWEEN t.created_at - interval '5 seconds' AND t.created_at + interval '5 seconds'
);

COMMENT ON COLUMN public.wallet_earnings_ledger.metadata IS 'JSONB metadata. For boost earnings, includes: boost_source (point_balance or earning_balance), is_transfer (true if from earning_balance), wallet_points_spent, earnings_points_spent. May include backfilled=true for old transactions where source was inferred.';

