-- =============================================
-- ADD COMMUNITY PRICING FIELDS MIGRATION
-- Adds pricing fields to communities table for community owners to set their own pricing
-- Allows free, one-time, or recurring (monthly/annual) pricing models
-- =============================================

-- Add community pricing fields to communities table
-- This allows community owners to set their own pricing for users to access/post
-- Pricing is automatic: free if no price set, paid if price > 0
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS pricing_type TEXT CHECK (pricing_type IN ('free', 'one_time', 'recurring')),
ADD COLUMN IF NOT EXISTS one_time_price NUMERIC(10, 2) CHECK (one_time_price >= 0),
ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10, 2) CHECK (monthly_price >= 0),
ADD COLUMN IF NOT EXISTS annual_price NUMERIC(10, 2) CHECK (annual_price >= 0);

-- Default to free for existing communities
UPDATE public.communities 
SET pricing_type = 'free' 
WHERE pricing_type IS NULL;

-- Add index for pricing queries
CREATE INDEX IF NOT EXISTS idx_communities_pricing_type ON public.communities(pricing_type);

