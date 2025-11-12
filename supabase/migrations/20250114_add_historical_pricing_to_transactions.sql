-- =============================================
-- ADD HISTORICAL PRICING TO TRANSACTIONS
-- Adds columns to store pricing at time of transaction
-- =============================================

-- Add historical pricing columns to transactions table
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS buy_price_per_point_at_time NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS user_value_per_point_at_time NUMERIC(12,4);

-- Add comments for documentation
COMMENT ON COLUMN public.transactions.buy_price_per_point_at_time IS 'Buy price per point at the time this transaction was created (historical value)';
COMMENT ON COLUMN public.transactions.user_value_per_point_at_time IS 'User value per point at the time this transaction was created (historical value)';

-- Create index for efficient queries on historical pricing
CREATE INDEX IF NOT EXISTS idx_transactions_buy_price_at_time 
  ON public.transactions(buy_price_per_point_at_time) 
  WHERE buy_price_per_point_at_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_value_at_time 
  ON public.transactions(user_value_per_point_at_time) 
  WHERE user_value_per_point_at_time IS NOT NULL;

