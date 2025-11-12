-- =============================================
-- FIX ORPHANED BOOST TRANSACTIONS
-- This migration creates missing post_boosts and earnings ledger entries
-- for boost transactions that exist but are missing their related records
-- =============================================

-- Step 1: Create missing post_boosts records for the 3 orphaned transactions
-- We'll link them to the most recent post by the author at the time of the boost
INSERT INTO public.post_boosts (id, post_id, user_id, created_at)
SELECT 
  gen_random_uuid(),
  (SELECT p.id 
   FROM public.posts p 
   WHERE p.author_id = t.recipient_user_id
   AND p.created_at <= t.created_at
   ORDER BY p.created_at DESC
   LIMIT 1) as post_id,
  t.user_id,
  t.created_at
FROM public.transactions t
WHERE t.id IN (
  'b6acb068-2a1b-4d92-8514-8143a6ca1320',
  '31aceacd-ff11-4f47-91f4-e0976e480239',
  'ba62f109-877a-44e7-a8e8-d4f5005751f1'
)
AND t.type = 'point_spend'
AND t.recipient_user_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.post_boosts pb
  WHERE pb.user_id = t.user_id
  AND pb.created_at BETWEEN t.created_at - interval '1 minute' AND t.created_at + interval '1 minute'
)
ON CONFLICT DO NOTHING;

-- Step 2: Create missing earnings ledger entries for these boosts
-- We need to determine if they came from point_balance or earning_balance
-- Since we can't know for sure, we'll check the transaction context and wallet state
INSERT INTO public.wallet_earnings_ledger (
  id,
  user_id,
  source_type,
  source_id,
  points,
  amount_ttd,
  status,
  available_at,
  metadata,
  created_at
)
SELECT 
  gen_random_uuid(),
  t.recipient_user_id, -- Author receives the earnings
  'boost',
  pb.id, -- Link to the post_boost we just created
  1, -- 1 point earned
  (SELECT user_value_per_point FROM public.platform_settings WHERE id = 1) * 1, -- Calculate amount
  'confirmed', -- Status
  t.created_at + interval '60 seconds', -- Available after 60 seconds (standard boost hold)
  jsonb_build_object(
    'post_id', pb.post_id,
    'boost_id', pb.id,
    'from_user_id', t.user_id,
    'boost_source', 
    CASE 
      -- If transaction context has matched_from_earn_tx, it came from earnings
      WHEN t.context->>'matched_from_earn_tx' IS NOT NULL THEN 'earning_balance'
      -- Otherwise, assume point_balance (conservative - creates new liability)
      ELSE 'point_balance'
    END,
    'is_transfer',
    CASE 
      WHEN t.context->>'matched_from_earn_tx' IS NOT NULL THEN true
      ELSE false
    END,
    'recovered', true,
    'recovered_at', now()
  ),
  t.created_at -- Use transaction time
FROM public.transactions t
JOIN public.post_boosts pb ON pb.user_id = t.user_id
  AND pb.created_at BETWEEN t.created_at - interval '1 minute' AND t.created_at + interval '1 minute'
WHERE t.id IN (
  'b6acb068-2a1b-4d92-8514-8143a6ca1320',
  '31aceacd-ff11-4f47-91f4-e0976e480239',
  'ba62f109-877a-44e7-a8e8-d4f5005751f1'
)
AND t.type = 'point_spend'
AND t.recipient_user_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM public.wallet_earnings_ledger wel
  WHERE wel.source_id = pb.id
  AND wel.source_type = 'boost'
)
ON CONFLICT DO NOTHING;

-- Step 3: Create missing earnings_credit transactions for the newly created earnings entries
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
  gen_random_uuid(),
  wel.user_id,
  'earning_credit',
  wel.amount_ttd,
  0, -- points_delta is 0 for earnings
  wel.points, -- earnings_points_delta
  (wel.metadata->>'from_user_id')::UUID, -- recipient_user_id (booster)
  (wel.metadata->>'from_user_id')::UUID, -- sender_user_id
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
  wel.created_at, -- Use earnings ledger created_at
  now()
FROM public.wallet_earnings_ledger wel
WHERE wel.metadata->>'recovered' = 'true'
AND wel.source_type = 'boost'
AND NOT EXISTS (
  SELECT 1 FROM public.transactions t
  WHERE t.ledger_entry_id = wel.id
)
ON CONFLICT DO NOTHING;

-- Step 4: Update post_boosts to link to earnings ledger entries (if column exists)
-- Note: ledger_entry_id column may not exist in all versions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'post_boosts' 
    AND column_name = 'ledger_entry_id'
  ) THEN
    UPDATE public.post_boosts pb
    SET ledger_entry_id = wel.id
    FROM public.wallet_earnings_ledger wel
    WHERE wel.source_id = pb.id
    AND wel.source_type = 'boost'
    AND pb.ledger_entry_id IS NULL
    AND wel.metadata->>'recovered' = 'true';
  END IF;
END $$;

COMMENT ON TABLE public.post_boosts IS 'Post boosts table. Some boost records may have been recovered if the original records were deleted.';

