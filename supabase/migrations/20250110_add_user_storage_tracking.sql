-- =============================================
-- USER STORAGE TRACKING SYSTEM
-- Tracks video storage usage across all communities
-- 1 GB free, then 4 points per GB per month
-- =============================================

-- Create user_storage table to track storage limits and usage
CREATE TABLE IF NOT EXISTS public.user_storage (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  total_storage_bytes BIGINT NOT NULL DEFAULT 0, -- Current total storage used
  storage_limit_bytes BIGINT NOT NULL DEFAULT 1073741824, -- 1 GB free default (1073741824 bytes)
  monthly_cost_points BIGINT NOT NULL DEFAULT 0, -- Current monthly cost in points
  last_billing_date DATE, -- Last date billing was processed
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- When storage was last calculated
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_storage_user_id ON public.user_storage(user_id);

-- Enable RLS
ALTER TABLE public.user_storage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_storage
-- Users can view their own storage
CREATE POLICY "Users can view their own storage"
  ON public.user_storage FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own storage (for limit increases)
CREATE POLICY "Users can update their own storage"
  ON public.user_storage FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to calculate user's total storage usage
-- Sums file_size_bytes from all event_recordings where user owns the event
CREATE OR REPLACE FUNCTION public.calculate_user_storage_usage(p_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  v_total_bytes BIGINT;
BEGIN
  SELECT COALESCE(SUM(er.file_size_bytes), 0) INTO v_total_bytes
  FROM public.event_recordings er
  JOIN public.community_events ce ON ce.id = er.event_id
  WHERE ce.owner_id = p_user_id
    AND er.file_size_bytes IS NOT NULL
    AND er.file_size_bytes > 0;
  
  RETURN v_total_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user storage usage
CREATE OR REPLACE FUNCTION public.update_user_storage_usage(p_user_id UUID)
RETURNS TABLE (
  total_storage_bytes BIGINT,
  storage_limit_bytes BIGINT,
  monthly_cost_points BIGINT,
  is_over_limit BOOLEAN
) AS $$
DECLARE
  v_total_bytes BIGINT;
  v_limit_bytes BIGINT;
  v_free_bytes BIGINT := 1073741824; -- 1 GB free
  v_over_limit_bytes BIGINT;
  v_cost_points BIGINT;
BEGIN
  -- Calculate total storage
  v_total_bytes := public.calculate_user_storage_usage(p_user_id);
  
  -- Ensure user_storage record exists
  INSERT INTO public.user_storage (user_id, total_storage_bytes, storage_limit_bytes)
  VALUES (p_user_id, v_total_bytes, v_free_bytes)
  ON CONFLICT (user_id) DO UPDATE
  SET total_storage_bytes = v_total_bytes,
      last_calculated_at = now(),
      updated_at = now();
  
  -- Get current limit
  SELECT storage_limit_bytes INTO v_limit_bytes
  FROM public.user_storage
  WHERE user_id = p_user_id;
  
  -- Calculate cost (4 points per GB over 1 GB free)
  IF v_total_bytes > v_free_bytes THEN
    v_over_limit_bytes := v_total_bytes - v_free_bytes;
    -- Convert to GB and multiply by 4 points
    v_cost_points := CEIL((v_over_limit_bytes::NUMERIC / 1073741824.0) * 4);
  ELSE
    v_cost_points := 0;
  END IF;
  
  -- Update storage record with cost
  UPDATE public.user_storage
  SET monthly_cost_points = v_cost_points,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Return results
  RETURN QUERY
  SELECT 
    v_total_bytes,
    v_limit_bytes,
    v_cost_points,
    (v_total_bytes > v_limit_bytes) AS is_over_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process monthly storage billing
-- Should be called on the 1st of each month
CREATE OR REPLACE FUNCTION public.process_monthly_storage_billing(p_user_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  points_deducted BIGINT,
  remaining_balance BIGINT,
  message TEXT
) AS $$
DECLARE
  v_storage_record RECORD;
  v_points_before BIGINT;
  v_points_after BIGINT;
  v_tx_id UUID;
  v_current_date DATE := CURRENT_DATE;
  v_last_billing DATE;
BEGIN
  -- Get user storage record
  SELECT * INTO v_storage_record
  FROM public.user_storage
  WHERE user_id = p_user_id;
  
  IF v_storage_record IS NULL THEN
    -- Create storage record if it doesn't exist
    PERFORM public.update_user_storage_usage(p_user_id);
    SELECT * INTO v_storage_record
    FROM public.user_storage
    WHERE user_id = p_user_id;
  END IF;
  
  -- Check if already billed this month
  v_last_billing := v_storage_record.last_billing_date;
  IF v_last_billing IS NOT NULL AND DATE_TRUNC('month', v_last_billing) = DATE_TRUNC('month', v_current_date) THEN
    RETURN QUERY
    SELECT 
      true AS success,
      0::BIGINT AS points_deducted,
      (SELECT points_balance FROM public.wallets WHERE user_id = p_user_id) AS remaining_balance,
      'Already billed this month'::TEXT AS message;
    RETURN;
  END IF;
  
  -- Update storage usage first
  PERFORM public.update_user_storage_usage(p_user_id);
  
  -- Get updated cost
  SELECT monthly_cost_points INTO v_storage_record.monthly_cost_points
  FROM public.user_storage
  WHERE user_id = p_user_id;
  
  -- If no cost, just update billing date
  IF v_storage_record.monthly_cost_points = 0 THEN
    UPDATE public.user_storage
    SET last_billing_date = v_current_date,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    RETURN QUERY
    SELECT 
      true AS success,
      0::BIGINT AS points_deducted,
      (SELECT points_balance FROM public.wallets WHERE user_id = p_user_id) AS remaining_balance,
      'No storage cost this month'::TEXT AS message;
    RETURN;
  END IF;
  
  -- Get wallet balance with lock
  SELECT points_balance INTO v_points_before
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF v_points_before IS NULL THEN
    -- Create wallet if doesn't exist
    INSERT INTO public.wallets (user_id, points_balance)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    v_points_before := 0;
  END IF;
  
  -- Check if user has enough points
  IF v_points_before < v_storage_record.monthly_cost_points THEN
    -- Still update billing date, but mark as insufficient
    UPDATE public.user_storage
    SET last_billing_date = v_current_date,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    RETURN QUERY
    SELECT 
      false AS success,
      0::BIGINT AS points_deducted,
      v_points_before AS remaining_balance,
      format('Insufficient points. Required: %s, Available: %s', 
             v_storage_record.monthly_cost_points, v_points_before)::TEXT AS message;
    RETURN;
  END IF;
  
  v_points_after := v_points_before - v_storage_record.monthly_cost_points;
  
  -- Create transaction
  INSERT INTO public.transactions (
    user_id,
    type,
    points_delta,
    recipient_user_id
  )
  VALUES (
    p_user_id,
    'point_spend',
    -v_storage_record.monthly_cost_points,
    NULL -- Goes to platform
  )
  RETURNING id INTO v_tx_id;
  
  -- Update wallet
  UPDATE public.wallets
  SET points_balance = v_points_after,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Update storage billing date
  UPDATE public.user_storage
  SET last_billing_date = v_current_date,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN QUERY
  SELECT 
    true AS success,
    v_storage_record.monthly_cost_points AS points_deducted,
    v_points_after AS remaining_balance,
    format('Storage billing processed: %s points deducted', v_storage_record.monthly_cost_points)::TEXT AS message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increase storage limit (for future purchase feature)
CREATE OR REPLACE FUNCTION public.increase_storage_limit(
  p_user_id UUID,
  p_additional_gb BIGINT
)
RETURNS TABLE (
  success BOOLEAN,
  new_limit_bytes BIGINT,
  message TEXT
) AS $$
DECLARE
  v_current_limit BIGINT;
  v_new_limit BIGINT;
  v_bytes_per_gb BIGINT := 1073741824; -- 1 GB in bytes
BEGIN
  -- Get current limit
  SELECT storage_limit_bytes INTO v_current_limit
  FROM public.user_storage
  WHERE user_id = p_user_id;
  
  IF v_current_limit IS NULL THEN
    -- Create storage record if doesn't exist
    PERFORM public.update_user_storage_usage(p_user_id);
    SELECT storage_limit_bytes INTO v_current_limit
    FROM public.user_storage
    WHERE user_id = p_user_id;
  END IF;
  
  v_new_limit := v_current_limit + (p_additional_gb * v_bytes_per_gb);
  
  -- Update limit
  UPDATE public.user_storage
  SET storage_limit_bytes = v_new_limit,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  RETURN QUERY
  SELECT 
    true AS success,
    v_new_limit AS new_limit_bytes,
    format('Storage limit increased by %s GB', p_additional_gb)::TEXT AS message;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_user_storage_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_storage_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_monthly_storage_billing(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increase_storage_limit(UUID, BIGINT) TO authenticated;

-- Comments
COMMENT ON TABLE public.user_storage IS 'Tracks user video storage usage and limits across all communities';
COMMENT ON FUNCTION public.calculate_user_storage_usage IS 'Calculates total storage bytes used by a user across all their event recordings';
COMMENT ON FUNCTION public.update_user_storage_usage IS 'Updates user storage usage and calculates monthly cost (4 points per GB over 1 GB free)';
COMMENT ON FUNCTION public.process_monthly_storage_billing IS 'Processes monthly storage billing on the 1st of each month, deducting points from wallet';
COMMENT ON FUNCTION public.increase_storage_limit IS 'Increases user storage limit by specified GB amount';

