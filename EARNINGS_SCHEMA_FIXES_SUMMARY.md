# Earnings Schema Fixes Summary

## Issues Found and Fixed

### 1. ✅ FIXED: Unused Redundant Columns
**Problem**: `confirmed_at` and `reversed_at` timestamp columns in `wallet_earnings_ledger` were never populated (all NULL)
- These are redundant because the `status` field already indicates the state
- `created_at` provides timing information

**Fix**: Removed both columns
- `confirmed_at` - redundant with `status = 'confirmed'`
- `reversed_at` - redundant with `status = 'reversed'`

### 2. ✅ DOCUMENTED: Column Name Mismatch in Migration File
**Problem**: Migration file `20251107_earnings_and_payouts.sql` defines:
- `points_amount` (but actual column is `points`)
- `release_at` (but actual column is `available_at`)
- `locked_by` (column doesn't exist in actual table)

**Status**: The actual database structure is CORRECT
- Functions use correct column names: `points`, `available_at`
- Migration file is outdated and doesn't match reality
- Added comments to document correct structure

### 3. ✅ DOCUMENTED: Status Enum Mismatch
**Problem**: Migration file defines enum: `('pending', 'available', 'locked', 'paid', 'reversed')`
- But actual constraint allows: `('pending', 'confirmed', 'locked', 'reversed')`
- TypeScript type matches actual: `'pending' | 'confirmed' | 'locked' | 'reversed'`

**Status**: Actual constraint is CORRECT
- Migration file is outdated
- Updated TypeScript types with clarifying comments
- Status values in use: `'confirmed'` (not `'available'` or `'paid'`)

### 4. ✅ VERIFIED: Wallet Columns Are NOT Redundant
**Status**: `wallets.earnings_points` and `wallets.locked_earnings_points` are **NOT redundant**
- These are cached values for performance
- Functions keep them in sync with the ledger
- They match calculated values from ledger (verified)
- Used by functions for quick balance checks

## Final Structure

### wallet_earnings_ledger (11 columns - cleaned up)
- `id` (uuid)
- `user_id` (uuid)
- `source_type` (text)
- `source_id` (uuid, nullable)
- `community_id` (uuid, nullable)
- `points` (bigint) - **NOT** `points_amount`
- `amount_ttd` (numeric)
- `status` (text) - values: `'pending' | 'confirmed' | 'locked' | 'reversed'`
- `available_at` (timestamptz, nullable) - **NOT** `release_at`
- `created_at` (timestamptz)
- `metadata` (jsonb)
- **REMOVED**: `confirmed_at`, `reversed_at` (redundant)

### wallets (earnings columns - kept)
- `earnings_points` (bigint) - cached sum of `status = 'confirmed'` entries
- `locked_earnings_points` (bigint) - cached sum of `status = 'locked'` entries
- These are kept in sync by functions and are NOT redundant

## Notes

- The migration file `20251107_earnings_and_payouts.sql` is outdated and doesn't match the actual database structure
- All functions use the correct column names (`points`, `available_at`)
- The actual database structure is correct
- TypeScript types have been updated to match reality

