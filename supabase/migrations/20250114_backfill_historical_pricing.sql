-- =============================================
-- BACKFILL HISTORICAL PRICING FOR EXISTING TRANSACTIONS
-- Uses current platform settings to backfill historical pricing for all existing transactions
-- Note: This is an approximation - actual historical values may differ if settings changed
-- =============================================

DO $$
DECLARE
  v_current_buy_price NUMERIC;
  v_current_user_value NUMERIC;
  v_updated_count INTEGER;
BEGIN
  -- Get current platform settings
  SELECT buy_price_per_point, user_value_per_point
  INTO v_current_buy_price, v_current_user_value
  FROM public.platform_settings
  WHERE id = 1;

  IF v_current_buy_price IS NULL OR v_current_user_value IS NULL THEN
    RAISE EXCEPTION 'Platform settings not found. Cannot backfill historical pricing.';
  END IF;

  -- Backfill historical pricing for all top_up transactions
  -- These need both buy_price and user_value
  UPDATE public.transactions
  SET 
    buy_price_per_point_at_time = v_current_buy_price,
    user_value_per_point_at_time = v_current_user_value
  WHERE type = 'top_up'
    AND (buy_price_per_point_at_time IS NULL OR user_value_per_point_at_time IS NULL);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % top_up transactions with historical pricing', v_updated_count;

  -- Backfill user_value for point_spend transactions where recipient is NULL (platform fees)
  -- These are voice notes and live event creation fees
  UPDATE public.transactions
  SET user_value_per_point_at_time = v_current_user_value
  WHERE type = 'point_spend'
    AND recipient_user_id IS NULL
    AND user_value_per_point_at_time IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % point_spend (platform fee) transactions with historical pricing', v_updated_count;

  -- Backfill user_value for referral_bonus transactions
  UPDATE public.transactions
  SET user_value_per_point_at_time = v_current_user_value
  WHERE type = 'referral_bonus'
    AND user_value_per_point_at_time IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % referral_bonus transactions with historical pricing', v_updated_count;

  RAISE NOTICE 'Historical pricing backfill completed. Note: This uses current settings as approximation.';
END $$;

-- Add a comment to the transactions table documenting the backfill
COMMENT ON COLUMN public.transactions.buy_price_per_point_at_time IS 
  'Buy price per point at the time this transaction was created (historical value). Note: For transactions created before 2025-01-14, this value was backfilled using current settings and may be an approximation.';

COMMENT ON COLUMN public.transactions.user_value_per_point_at_time IS 
  'User value per point at the time this transaction was created (historical value). Note: For transactions created before 2025-01-14, this value was backfilled using current settings and may be an approximation.';

