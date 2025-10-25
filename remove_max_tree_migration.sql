-- Migration: Remove max_tree limit from subscription plans
-- Date: 2025-10-25
-- Description: Removes member limit restrictions from communities, allowing unlimited growth

-- Remove max_tree column from subscription_plans table
ALTER TABLE public.subscription_plans
DROP COLUMN IF EXISTS max_tree;