"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { DollarSign, Coins, Mic, Calendar, Database, TrendingUp, Wallet } from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface RevenueStats {
  pointsPurchases: number
  voiceNotes: number
  events: number
  storage: number
  totalPlatformRevenue: number
  totalUserEarnings: number
  availableForWithdrawal: number
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
    totalUserEarnings: 0,
    availableForWithdrawal: 0,
  })
  const [platformSettings, setPlatformSettings] = useState<{
    user_value_per_point: number
    buy_price_per_point: number
  } | null>(null)

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch revenue data
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchRevenueData()
    }
  }, [userProfile])

  const fetchRevenueData = async () => {
    try {
      setLoading(true)

      // Fetch platform settings
      const { data: settings, error: settingsError } = await supabase
        .from('platform_settings')
        .select('user_value_per_point, buy_price_per_point')
        .eq('id', 1)
        .single()

      if (settingsError) throw settingsError
      setPlatformSettings(settings)

      if (!settings) {
        toast.error('Platform settings not found')
        return
      }

      const valuePerPoint = settings.user_value_per_point || 0
      const buyPricePerPoint = settings.buy_price_per_point || 0

      // 1. Revenue from points purchases - calculate platform fee for each top-up
      // Platform fee = amount paid - (points credited * user_value_per_point)
      // This is the platform's cut upfront when users buy points
      const { data: topUpRevenue, error: topUpError } = await supabase
        .from('transactions')
        .select('amount_ttd, points_delta')
        .eq('type', 'top_up')
        .not('amount_ttd', 'is', null)
        .not('points_delta', 'is', null)
        .eq('status', 'verified')

      if (topUpError) throw topUpError

      // Calculate platform revenue for each transaction
      // Since points = amount_ttd / buy_price_per_point, the platform's revenue is:
      // Platform revenue = (points_delta * buy_price_per_point) - (points_delta * user_value_per_point)
      // Which simplifies to: points_delta * (buy_price_per_point - user_value_per_point)
      // This is the margin/profit per point
      const pointsPurchases = (topUpRevenue || [])
        .reduce((sum, tx) => {
          const amountPaid = Number(tx.amount_ttd) || 0
          const pointsCredited = Number(tx.points_delta) || 0
          
          // Platform revenue = margin per point * number of points
          // Margin per point = buy_price_per_point - user_value_per_point
          // This represents the platform's profit on each point sold
          const marginPerPoint = buyPricePerPoint - valuePerPoint
          const platformRevenue = pointsCredited * marginPerPoint
          
          return sum + Math.max(0, platformRevenue) // Ensure non-negative
        }, 0)

      // 2. Points consumption from voice notes (point_spend with recipient_user_id = NULL and points_delta = -1)
      // This is NOT revenue - it's consumption of already-purchased points
      // We show this for analytics but don't count it as revenue
      const { data: voiceNoteTxs, error: voiceNoteError } = await supabase
        .from('transactions')
        .select('points_delta')
        .eq('type', 'point_spend')
        .is('recipient_user_id', null)
        .eq('points_delta', -1)
        .eq('status', 'verified')

      if (voiceNoteError) throw voiceNoteError

      const voiceNotesCount = (voiceNoteTxs || []).length
      const voiceNotesValue = voiceNotesCount * valuePerPoint

      // 3. Points consumption from events (stream creation - point_spend with recipient_user_id = NULL and points_delta < -1)
      // This is NOT revenue - it's consumption of already-purchased points
      const { data: eventTxs, error: eventError } = await supabase
        .from('transactions')
        .select('points_delta')
        .eq('type', 'point_spend')
        .is('recipient_user_id', null)
        .lt('points_delta', 0)
        .neq('points_delta', -1)
        .eq('status', 'verified')

      if (eventError) throw eventError

      const eventsValue = (eventTxs || [])
        .reduce((sum, tx) => sum + (Math.abs(Number(tx.points_delta)) * valuePerPoint), 0)

      // 4. Points consumption from storage (we'll identify these separately when we can)
      // For now, storage billing is included in events consumption
      const storageValue = 0 // TODO: Calculate separately when we can distinguish storage billing

      // Total platform revenue is ONLY from points purchases
      // Point spends are consumption, not revenue (points were already paid for)
      const totalPlatformRevenue = pointsPurchases

      // 5. User earnings (from wallet_earnings_ledger)
      const { data: earnings, error: earningsError } = await supabase
        .from('wallet_earnings_ledger')
        .select('amount_ttd, status')
        .neq('status', 'reversed')

      if (earningsError) throw earningsError

      const totalUserEarnings = (earnings || [])
        .reduce((sum, entry) => sum + (Number(entry.amount_ttd) || 0), 0)

      // Available for withdrawal = Platform profit (revenue - user earnings) - already withdrawn
      // Platform profit = Total revenue - User earnings (what we owe to users)
      // Available for withdrawal = Platform profit - Completed withdrawals
      const { data: withdrawals, error: withdrawalsError } = await supabase
        .from('platform_withdrawals')
        .select('amount_ttd, status')
        .in('status', ['pending', 'processing', 'completed'])

      if (withdrawalsError && withdrawalsError.code !== 'PGRST116') {
        // PGRST116 = relation does not exist (table hasn't been created yet)
        throw withdrawalsError
      }

      const totalWithdrawn = (withdrawals || [])
        .filter(w => w.status === 'completed')
        .reduce((sum, w) => sum + (Number(w.amount_ttd) || 0), 0)

      // Platform profit = Revenue - User Earnings
      const platformProfit = totalPlatformRevenue - totalUserEarnings
      
      // Available for withdrawal = Profit - Already withdrawn
      const availableForWithdrawal = platformProfit - totalWithdrawn

      setStats({
        pointsPurchases,
        voiceNotes: voiceNotesValue,
        events: eventsValue,
        storage: storageValue,
        totalPlatformRevenue,
        totalUserEarnings,
        availableForWithdrawal: Math.max(0, availableForWithdrawal),
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-white/80">Total Platform Revenue</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">
                      {formatCurrency(stats.totalPlatformRevenue)}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-white/80">Available for Withdrawal</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">
                      {formatCurrency(stats.availableForWithdrawal)}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
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
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-white/80">Net Platform Income</p>
                    <p className="text-xl sm:text-2xl font-bold text-white mt-1 sm:mt-2">
                      {formatCurrency(stats.totalPlatformRevenue - stats.totalUserEarnings)}
                    </p>
                  </div>
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
                Revenue & Points Consumption
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Coins className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Points Purchases</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.pointsPurchases)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Actual revenue (100% of revenue)
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Mic className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Voice Notes</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.voiceNotes)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Points consumed (not revenue)
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Events</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.events)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Points consumed (not revenue)
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Database className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Storage</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.storage)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    Points consumed (not revenue)
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

