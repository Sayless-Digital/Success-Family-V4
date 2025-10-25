-- Migration: Add tags and ordering to subscription plans
-- Date: 2025-10-25
-- Description: Adds ability to tag plans (e.g., "Preferred", "Popular") and set display order

-- Add tags and ordering to subscription plans
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index for plan ordering
CREATE INDEX IF NOT EXISTS idx_subscription_plans_sort_order ON public.subscription_plans(sort_order, created_at);

-- Add comments for clarity
COMMENT ON COLUMN public.subscription_plans.tags IS 'Array of display labels (e.g., "Preferred", "Popular", "Best Value")';
COMMENT ON COLUMN public.subscription_plans.sort_order IS 'Display order for plans (lower numbers appear first)';