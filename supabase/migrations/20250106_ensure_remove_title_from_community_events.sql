-- Ensure title column is removed from community_events
-- This migration handles cases where the previous migration might not have been applied

-- Drop the column entirely (will fail gracefully if it doesn't exist)
ALTER TABLE public.community_events DROP COLUMN IF EXISTS title;

COMMENT ON TABLE public.community_events IS 'Live stream events: title removed; use description/content only.';

