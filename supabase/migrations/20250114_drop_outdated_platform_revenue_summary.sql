-- =============================================
-- DROP OUTDATED PLATFORM_REVENUE_SUMMARY VIEW
-- This view is redundant, inaccurate, and not being used
-- =============================================

-- ISSUES WITH THE VIEW:
-- 1. total_revenue_ttd is WRONG: Calculates sum of revenue types ($37.50) 
--    but should be sum of all top-up amounts ($100.00)
-- 2. liquid_revenue_ttd is redundant with net_liquid_revenue_ttd
-- 3. net_liquid_revenue_ttd is misleading - it's actually profit, not what we need
-- 4. Missing key metrics: Total User Earnings, Total User Payouts, 
--    Total Platform Withdrawals, Available for Withdrawal
-- 5. NOT BEING USED: The admin revenue page calculates everything directly
--    from platform_revenue_ledger and transactions tables

-- The admin revenue page (src/app/admin/revenue/page.tsx) calculates:
-- - Total Platform Revenue: Sum of all top_up transaction amounts
-- - Total Platform Profit: Sum from platform_revenue_ledger (topup_profit + voice_note_fee + live_event_fee + referral_expense)
-- - Total User Earnings: From wallet_earnings_ledger (filtered by status)
-- - Total User Payouts: From payouts table
-- - Total Platform Withdrawals: From platform_withdrawals table
-- - Available for Withdrawal: Calculated as Total Revenue - User Earnings - Payouts - Withdrawals

-- Since the view is not being used and is inaccurate, we'll drop it
DROP VIEW IF EXISTS public.platform_revenue_summary;

