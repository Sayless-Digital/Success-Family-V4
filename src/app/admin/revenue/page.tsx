"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { DollarSign, Coins, Mic, Calendar, Database, TrendingUp } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface RevenueStats {
  pointsPurchases: number
  voiceNotes: number
  events: number
  storage: number
  totalPlatformRevenue: number // Total money that came into the platform (sum of all top-ups)
  totalPlatformProfit: number // Profit from operations (topup_profit + voice_note_fee + live_event_fee - referral_expense)
  totalUserEarnings: number // Money owed to users (from earnings ledger)
  totalUserPayouts: number // Money already paid out to users (completed payouts)
  totalPlatformWithdrawals: number // Money the platform has withdrawn for itself
  availableForWithdrawal: number // Total Revenue - User Earnings - Completed User Payouts - Completed Platform Withdrawals
  referralExpenses: number
  totalTopupAmount: number // Sum of all top-up amounts
}

export default function RevenuePage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<RevenueStats>({
    pointsPurchases: 0,
    voiceNotes: 0,
    events: 0,
    storage: 0,
    totalPlatformRevenue: 0,
    totalPlatformProfit: 0,
    totalUserEarnings: 0,
    totalUserPayouts: 0,
    totalPlatformWithdrawals: 0,
    availableForWithdrawal: 0,
    referralExpenses: 0,
    totalTopupAmount: 0,
  })

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch revenue data
  useEffect(() => {
    if (userProfile?.role === 'admin' && !isLoading) {
      // Small delay to ensure hydration is complete
      const timer = setTimeout(() => {
        fetchRevenueData()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [userProfile, isLoading])

  const fetchRevenueData = async () => {
    try {
      setLoading(true)

      // 1. Total Platform Revenue = Sum of all top-up amounts (total money that came into the platform)
      const { data: topups, error: topupsError } = await supabase
        .from('transactions')
        .select('amount_ttd')
        .eq('type', 'top_up')
        .eq('status', 'verified')
        .not('amount_ttd', 'is', null)

      if (topupsError) throw topupsError

      const totalTopupAmount = (topups || [])
        .reduce((sum, tx) => sum + (Number(tx.amount_ttd) || 0), 0)

      // Total Platform Revenue = Total money that came into the platform
      const totalPlatformRevenue = totalTopupAmount

      // 2. Fetch revenue data from platform_revenue_ledger (historical accuracy)
      // This uses historical pricing values stored at transaction time, not current settings
      const { data: revenueLedger, error: ledgerError } = await supabase
        .from('platform_revenue_ledger')
        .select('revenue_type, amount_ttd, points_involved, is_liquid')

      if (ledgerError) throw ledgerError

      // Calculate revenue breakdown by type from ledger
      const topupProfit = (revenueLedger || [])
        .filter(entry => entry.revenue_type === 'topup_profit')
        .reduce((sum, entry) => sum + (Number(entry.amount_ttd) || 0), 0)

      const voiceNoteFee = (revenueLedger || [])
        .filter(entry => entry.revenue_type === 'voice_note_fee')
        .reduce((sum, entry) => sum + (Number(entry.amount_ttd) || 0), 0)

      const liveEventFee = (revenueLedger || [])
        .filter(entry => entry.revenue_type === 'live_event_fee')
        .reduce((sum, entry) => sum + (Number(entry.amount_ttd) || 0), 0)

      const referralExpense = (revenueLedger || [])
        .filter(entry => entry.revenue_type === 'referral_expense')
        .reduce((sum, entry) => sum + (Number(entry.amount_ttd) || 0), 0) // Already negative

      // Total Platform Profit = Revenue from operations (topup_profit + voice_note_fee + live_event_fee - referral_expense)
      const totalPlatformProfit = topupProfit + voiceNoteFee + liveEventFee + referralExpense // referralExpense is already negative

      // 3. User earnings (from wallet_earnings_ledger - this is what we owe to users)
      // Count all earnings that haven't been paid out yet (status NOT 'paid' and NOT 'reversed')
      // This includes: 'pending', 'available', 'confirmed', 'locked'
      // IMPORTANT: For boost earnings, only count NEW liabilities (from point_balance), not transfers (from earning_balance)
      // When points come from earning_balance, it's just a transfer between users - no new liability is created
      // When points come from point_balance, it creates a new liability (user paid for points, now we owe earnings to someone else)
      const { data: earnings, error: earningsError } = await supabase
        .from('wallet_earnings_ledger')
        .select('amount_ttd, status, source_type, metadata')

      if (earningsError) throw earningsError

      // Filter out 'paid' and 'reversed' statuses - these are no longer owed
      // For boost earnings, only count if boost_source = 'point_balance' (new liability)
      // Exclude transfers (boost_source = 'earning_balance' or is_transfer = true)
      // NOTE: Admin users' earnings ARE included - all user earnings count regardless of role
      const filteredEarnings = (earnings || []).filter(entry => {
        const status = entry.status?.toLowerCase()
        if (status === 'paid' || status === 'reversed') {
          return false
        }
        
        // For boost earnings, check if it's a transfer (from earning_balance)
        // Transfers don't create new liabilities - they just move existing liabilities between users
        // When points come from point_balance: creates NEW liability (user paid for points, now we owe earnings to someone else)
        // When points come from earning_balance: just a TRANSFER (User A's earnings decrease, User B's earnings increase - net change: 0)
        if (entry.source_type === 'boost') {
          // Handle cases where metadata might be null or undefined
          if (!entry.metadata) {
            // No metadata - assume it's a new liability (conservative approach for legacy data)
            return true
          }
          
          // Safely access metadata properties (handle both object and null cases)
          const boostSource = entry.metadata?.boost_source
          const isTransfer = entry.metadata?.is_transfer
          
          // Convert is_transfer to boolean (handle both boolean and string values from JSONB)
          // Supabase returns JSONB booleans as actual booleans, but be defensive
          // Also handle null/undefined cases
          const isTransferBool = isTransfer === true || isTransfer === 'true' || String(isTransfer).toLowerCase() === 'true'
          
          // Exclude transfers: if boost came from earning_balance OR is_transfer is true
          if (boostSource === 'earning_balance' || isTransferBool) {
            return false
          }
          
          // Include new liabilities: if boost came from point_balance
          // This is the main condition - if boost_source is 'point_balance', include it
          if (boostSource === 'point_balance') {
            return true
          }
          
          // For legacy entries without boost_source metadata:
          // - If is_transfer is explicitly true, exclude (it's a transfer)
          // - Otherwise, include (assume new liability - conservative approach)
          if (!boostSource) {
            return !isTransferBool
          }
          
          // Safety: if we can't determine, exclude it
          return false
        }
        
        // For non-boost earnings, include them
        return true
      })
      
      const totalUserEarnings = filteredEarnings.reduce((sum, entry) => {
        const amount = Number(entry.amount_ttd) || 0
        return sum + amount
      }, 0)
      
      // Debug logging to help identify issues
      const allBoostEntries = (earnings || []).filter(e => e.source_type === 'boost')
      const filteredBoostIds = new Set(filteredEarnings.filter(e => e.source_type === 'boost').map(e => e.amount_ttd))
      
      console.log('Earnings calculation debug:', {
        totalEntries: earnings?.length || 0,
        filteredEntries: filteredEarnings.length,
        totalUserEarnings,
        boostEntriesCount: filteredEarnings.filter(e => e.source_type === 'boost').length,
        allBoostEntries: allBoostEntries.map(e => ({
          amount: e.amount_ttd,
          status: e.status,
          boostSource: e.metadata?.boost_source,
          isTransfer: e.metadata?.is_transfer,
          included: filteredBoostIds.has(e.amount_ttd)
        }))
      })

      // 4. Get completed user payouts (money that has already been paid out to users)
      // These are payouts with status 'paid' - money that has already left the platform
      // Note: When payouts are completed, the earnings ledger entries might be marked as 'paid',
      // so we count payouts separately to track money that has actually been paid out
      const { data: userPayouts, error: payoutsError } = await supabase
        .from('payouts')
        .select('amount_ttd, status')
        .eq('status', 'paid') // Only count completed payouts

      if (payoutsError && payoutsError.code !== 'PGRST116') {
        throw payoutsError
      }

      const totalUserPayouts = (userPayouts || [])
        .reduce((sum, p) => sum + (Number(p.amount_ttd) || 0), 0)

      // 5. Get completed platform withdrawals (money that the platform has withdrawn for itself)
      const { data: platformWithdrawals, error: withdrawalsError } = await supabase
        .from('platform_withdrawals')
        .select('amount_ttd, status')
        .in('status', ['pending', 'processing', 'completed'])

      if (withdrawalsError && withdrawalsError.code !== 'PGRST116') {
        throw withdrawalsError
      }

      const totalPlatformWithdrawals = (platformWithdrawals || [])
        .filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + (Number(w.amount_ttd) || 0), 0)

      // 6. Available for Withdrawal = Total Platform Revenue - User Earnings - Completed User Payouts - Completed Platform Withdrawals
      // This represents the money available from total revenue after accounting for:
      // - User earnings (money owed to users from boosts, etc.) - this comes from total revenue, not profit
      // - Completed user payouts (money already paid out to users)
      // - Completed platform withdrawals (money the platform has withdrawn for itself)
      // Note: Boost earnings reduce available revenue because that money is owed to users (it came from the revenue pool)
      const availableForWithdrawal = totalPlatformRevenue - totalUserEarnings - totalUserPayouts - totalPlatformWithdrawals

      setStats({
        pointsPurchases: topupProfit,
        voiceNotes: voiceNoteFee, // Revenue from voice notes (platform earns when points are spent)
        events: liveEventFee, // Revenue from live events (platform earns when events are created)
        storage: 0, // TODO: Add storage revenue tracking when implemented
        totalPlatformRevenue, // Total money that came into the platform
        totalPlatformProfit, // Profit from operations
        totalUserEarnings, // Money owed to users
        totalUserPayouts, // Money already paid out to users
        totalPlatformWithdrawals, // Money the platform has withdrawn for itself
        availableForWithdrawal: Math.max(0, availableForWithdrawal), // Available from total revenue after accounting for user earnings (including boosts), user payouts, and platform withdrawals
        referralExpenses: Math.abs(referralExpense), // Convert to positive for display
        totalTopupAmount, // Sum of all top-up amounts (same as totalPlatformRevenue)
      })
    } catch (error: any) {
      console.error('Error fetching revenue data:', error)
      toast.error('Failed to load revenue data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-TT', {
      style: 'currency',
      currency: 'TTD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <Breadcrumb items={[{ label: "Revenue", icon: DollarSign }]} />

        {loading ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <p className="text-white/80">Loading revenue data...</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-white/80">Total Platform Revenue</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">
                      {formatCurrency(stats.totalPlatformRevenue)}
                    </p>
                    <p className="text-xs text-white/60 mt-1">Total money that came into platform</p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-white/80">Total Platform Profit</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">
                      {formatCurrency(stats.totalPlatformProfit)}
                    </p>
                    <p className="text-xs text-white/60 mt-1">Net liquid revenue from operations</p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-white/80">Total User Earnings</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">
                      {formatCurrency(stats.totalUserEarnings)}
                    </p>
                    <p className="text-xs text-white/60 mt-1">Money owed to users</p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Profit Breakdown */}
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
                Profit Breakdown (Historical Pricing)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Coins className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Top-Up Profit</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.pointsPurchases)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Profit margin from point purchases (buy_price - user_value) × points
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Mic className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Voice Note Fees</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.voiceNotes)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Revenue from voice notes (platform earns when points are spent)
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Live Event Fees</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.events)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Revenue from live event creation (platform earns when events are created)
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Coins className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Referral Expenses</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">-{formatCurrency(stats.referralExpenses)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Points awarded to referrers (reduces profit)
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-xs text-white/60">
                  <strong>Total Platform Profit</strong> = Top-Up Profit + Voice Note Fees + Live Event Fees - Referral Expenses
                  <br />
                  All profit calculations use historical pricing values stored at the time of each transaction, 
                  ensuring accuracy even when platform settings change.
                </p>
              </div>
            </div>

            {/* User Earnings Breakdown */}
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
                User Earnings Breakdown
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-white/80">Total User Earnings (owed)</span>
                  <span className="text-lg font-bold text-white">{formatCurrency(stats.totalUserEarnings)}</span>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60">
                    This includes earnings from boosts, voice notes, live events, and other sources. 
                    User earnings reduce available revenue because this money is owed to users and came from the revenue pool.
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
                Financial Summary
              </h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-white/80">Total Platform Revenue</span>
                  <span className="text-lg font-bold text-white">{formatCurrency(stats.totalPlatformRevenue)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-white/80">Total Platform Profit</span>
                  <span className="text-lg font-bold text-white">{formatCurrency(stats.totalPlatformProfit)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-white/80">Total User Earnings (owed)</span>
                  <span className="text-lg font-bold text-white">-{formatCurrency(stats.totalUserEarnings)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-white/80">Completed User Payouts</span>
                  <span className="text-lg font-bold text-white">-{formatCurrency(stats.totalUserPayouts)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                  <span className="text-white/80">Completed Platform Withdrawals</span>
                  <span className="text-lg font-bold text-white">-{formatCurrency(stats.totalPlatformWithdrawals)}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border-t-2 border-white/20 pt-3 mt-2">
                  <span className="text-white font-semibold">Available for Withdrawal</span>
                  <span className="text-xl font-bold text-white">{formatCurrency(stats.availableForWithdrawal)}</span>
                </div>
                <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60">
                    <strong>Available for Withdrawal</strong> = Total Platform Revenue - User Earnings (owed) - Completed User Payouts - Completed Platform Withdrawals
                    <br />
                    <strong>Total Platform Profit</strong> = Net liquid revenue from operations (topup profit + voice note fees + live event fees - referral expenses)
                    <br />
                    User earnings (including from boosts) reduce available revenue because that money is owed to users and came from the revenue pool. Completed payouts and withdrawals represent money that has already been paid out.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

