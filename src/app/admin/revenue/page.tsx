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

      // 1. Revenue from points purchases (amount_ttd from top_up transactions)
      // The entire amount paid by users is platform revenue (no fee structure)
      const { data: topUpRevenue, error: topUpError } = await supabase
        .from('transactions')
        .select('amount_ttd')
        .eq('type', 'top_up')
        .not('amount_ttd', 'is', null)
        .eq('status', 'verified')

      if (topUpError) throw topUpError

      const pointsPurchases = (topUpRevenue || [])
        .reduce((sum, tx) => sum + (Number(tx.amount_ttd) || 0), 0)

      // 2. Revenue from voice notes (point_spend with recipient_user_id = NULL and points_delta = -1)
      // Voice notes cost 1 point each, so we count transactions with -1 point delta
      const { data: voiceNoteTxs, error: voiceNoteError } = await supabase
        .from('transactions')
        .select('points_delta')
        .eq('type', 'point_spend')
        .is('recipient_user_id', null)
        .eq('points_delta', -1)
        .eq('status', 'verified')

      if (voiceNoteError) throw voiceNoteError

      const voiceNotesCount = (voiceNoteTxs || []).length
      const voiceNotes = voiceNotesCount * valuePerPoint

      // 3. Revenue from events (stream creation - point_spend with recipient_user_id = NULL and points_delta < -1)
      // Stream creation costs more than 1 point, so we filter for point_spend with NULL recipient and negative delta != -1
      const { data: eventTxs, error: eventError } = await supabase
        .from('transactions')
        .select('points_delta')
        .eq('type', 'point_spend')
        .is('recipient_user_id', null)
        .lt('points_delta', 0)
        .neq('points_delta', -1)
        .eq('status', 'verified')

      if (eventError) throw eventError

      const eventsRevenue = (eventTxs || [])
        .reduce((sum, tx) => sum + (Math.abs(Number(tx.points_delta)) * valuePerPoint), 0)

      // 4. Revenue from storage (we'll identify these as point_spend with NULL recipient that aren't voice notes or events)
      // For now, we'll calculate total platform revenue from all point_spend with NULL recipient
      // and subtract voice notes and events to get storage (or we can query storage billing separately)
      // Actually, storage billing goes through the same point_spend flow, so we'll include it in events for now
      // TODO: Add metadata/context field to distinguish storage billing from event creation

      // Total platform revenue
      const totalPlatformRevenue = pointsPurchases + voiceNotes + eventsRevenue

      // 5. User earnings (from wallet_earnings_ledger)
      const { data: earnings, error: earningsError } = await supabase
        .from('wallet_earnings_ledger')
        .select('amount_ttd, status')
        .neq('status', 'reversed')

      if (earningsError) throw earningsError

      const totalUserEarnings = (earnings || [])
        .reduce((sum, entry) => sum + (Number(entry.amount_ttd) || 0), 0)

      // Available for withdrawal = platform revenue - user earnings (what's owed to users)
      // Actually, available for withdrawal should be: platform revenue that hasn't been withdrawn yet
      // For now, we'll show total platform revenue as available (minus any withdrawals we track)
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

      const availableForWithdrawal = totalPlatformRevenue - totalWithdrawn

      setStats({
        pointsPurchases,
        voiceNotes,
        events: eventsRevenue,
        storage: 0, // TODO: Calculate separately when we can distinguish storage billing
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

            {/* Revenue Breakdown by Source */}
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6 shadow-lg">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">
                Revenue Breakdown by Source
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Coins className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Points Purchases</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.pointsPurchases)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    {stats.totalPlatformRevenue > 0
                      ? `${((stats.pointsPurchases / stats.totalPlatformRevenue) * 100).toFixed(1)}% of revenue`
                      : '0% of revenue'}
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Mic className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Voice Notes</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.voiceNotes)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    {stats.totalPlatformRevenue > 0
                      ? `${((stats.voiceNotes / stats.totalPlatformRevenue) * 100).toFixed(1)}% of revenue`
                      : '0% of revenue'}
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Events</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.events)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    {stats.totalPlatformRevenue > 0
                      ? `${((stats.events / stats.totalPlatformRevenue) * 100).toFixed(1)}% of revenue`
                      : '0% of revenue'}
                  </p>
                </div>

                <div className="rounded-lg bg-white/5 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Database className="h-5 w-5 text-white/70" />
                    <h3 className="font-medium text-white">Storage</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(stats.storage)}</p>
                  <p className="text-xs text-white/60 mt-1">
                    {stats.totalPlatformRevenue > 0
                      ? `${((stats.storage / stats.totalPlatformRevenue) * 100).toFixed(1)}% of revenue`
                      : '0% of revenue'}
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

