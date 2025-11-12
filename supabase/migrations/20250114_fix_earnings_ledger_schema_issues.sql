-- =============================================
-- FIX EARNINGS LEDGER SCHEMA ISSUES
-- This migration fixes redundant, inaccurate, and outdated columns
-- =============================================

-- ISSUES FOUND:
-- 1. Migration file defines 'points_amount' and 'release_at' but actual table has 'points' and 'available_at'
-- 2. Status enum mismatch: migration defines ('pending', 'available', 'locked', 'paid', 'reversed')
--    but constraint allows ('pending', 'confirmed', 'locked', 'reversed')
-- 3. Unused columns: confirmed_at and reversed_at are never populated (all NULL)
-- 4. Missing column: locked_by is in migration but doesn't exist in table
-- 5. Functions in migration use wrong column names (points_amount, release_at) but actual functions use correct names

-- The actual table structure is correct (points, available_at)
-- The migration file is outdated and doesn't match reality
-- We need to:
-- 1. Remove unused timestamp columns (confirmed_at, reversed_at) - they're redundant with status
-- 2. Update the status constraint to match what's actually used
-- 3. Ensure functions match the actual table structure

-- Step 1: Remove unused timestamp columns (confirmed_at, reversed_at)
-- These are redundant - status already tells us the state, and we have created_at for timing
ALTER TABLE public.wallet_earnings_ledger
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS reversed_at;

-- Step 2: The status constraint already matches what's used ('pending', 'confirmed', 'locked', 'reversed')
-- No change needed - the constraint is correct

-- Step 3: Verify the actual column names match what functions use
-- Functions use: points, available_at (CORRECT)
-- Migration file says: points_amount, release_at (OUTDATED - ignore migration file)

-- Step 4: Add comment documenting the correct structure
COMMENT ON TABLE public.wallet_earnings_ledger IS 
'Wallet earnings ledger tracks all user earnings with historical accuracy. 
Columns: points (not points_amount), available_at (not release_at).
Status values: pending, confirmed, locked, reversed (not available/paid).
confirmed_at and reversed_at columns removed as redundant with status field.';

COMMENT ON COLUMN public.wallet_earnings_ledger.points IS 
'Points earned (column name is "points", not "points_amount" as in outdated migration files)';

COMMENT ON COLUMN public.wallet_earnings_ledger.available_at IS 
'When earnings become available (column name is "available_at", not "release_at" as in outdated migration files)';

COMMENT ON COLUMN public.wallet_earnings_ledger.status IS 
'Earnings status: pending (not yet available), confirmed (available and counted in wallet), locked (locked for payout), reversed (cancelled). 
Note: "available" and "paid" statuses from migration file are not used - use "confirmed" instead.';

