"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useFormStatus } from "react-dom"
import { Coins, Wallet as WalletIcon, Eye, X, Gift, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TopUpAmount } from "@/components/ui/topup-amount"
import { CopyField } from "@/components/ui/copy-field"
import { WalletSuccessToast } from "@/components/wallet-success-toast"
import { BonusCountdown } from "@/components/bonus-countdown"
import { ReceiptUpload } from "@/components/receipt-upload"
import { cn } from "@/lib/utils"

type WalletSnapshot = {
  points_balance: number | null
  earnings_points: number | null
  locked_earnings_points: number | null
  next_topup_due_on?: string | null
}

type Bank = {
  id: string
  account_name: string
  bank_name: string
  account_number: string
  account_type: string
}

type Transaction = {
  id: string
  type: string
  amount_ttd: number | null
  points_delta: number
  earnings_points_delta: number
  receipt_url: string | null
  status: string
  created_at: string
  recipient_user_id: string | null
  sender_user_id?: string | null
  sender_name?: string | null
  recipient_name?: string | null
  signed_url?: string | null
  context?: Record<string, unknown> | null
}

type WalletEarningsEntry = {
  id: string
  source_type: string
  source_id?: string | null
  community_id?: string | null
  points: number
  amount_ttd?: number | null
  status: string
  available_at?: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

type Payout = {
  id: string
  points: number
  amount_ttd: number
  status: string
  scheduled_for: string
  created_at: string
  processed_at?: string | null
  processed_by?: string | null
  transaction_id?: string | null
  notes?: string | null
  locked_points: number
}

const transactionTypeLabels: Record<string, string> = {
  top_up: "Top Up",
  payout: "Payout",
  payout_lock: "Earnings Locked",
  payout_release: "Locked Released",
  point_spend: "Point Spend",
  point_refund: "Point Refund",
  earning_credit: "Earned",
  earning_reversal: "Earnings Reversal",
}

const earningsSourceLabels: Record<string, string> = {
  boost: "Post Boost",
  live_registration: "Live Registration",
  manual_adjustment: "Manual Adjustment",
  storage_credit: "Storage Credit",
}

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  paid: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  processing: "bg-amber-500/15 text-amber-200 border-amber-500/30",
  locked: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  reversed: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  rejected: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  cancelled: "bg-rose-500/15 text-rose-200 border-rose-500/30",
}

const renderStatus = (status: string) => {
  const s = (status || "").toLowerCase()
  const base =
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-white/20"
  const cls = STATUS_STYLES[s] ?? "bg-white/10 text-white/80 border-white/20"
  const label = s.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())
  return <span className={cn(base, cls)}>{label}</span>
}
const TRANSACTION_TYPE_STYLES: Record<string, string> = {
  top_up: "bg-sky-500/15 text-sky-200 border-sky-500/30",
  payout: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  payout_lock: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  payout_release: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  point_spend: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  point_refund: "bg-amber-500/20 text-amber-100 border-amber-500/40",
  earning_credit: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  earning_reversal: "bg-rose-500/15 text-rose-200 border-rose-500/30",
}

const getTransactionTypeLabel = (type: string) =>
  transactionTypeLabels[type] || type.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase())

const renderTransactionTypeBadge = (type: string) => {
  const key = (type || "").toLowerCase()
  const label = getTransactionTypeLabel(key)
  const base =
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border border-white/20"
  const cls = TRANSACTION_TYPE_STYLES[key] ?? "bg-white/10 text-white/80 border-white/20"
  return <span className={cn(base, cls)}>{label}</span>
}


const formatPointsDelta = (value: number) => {
  if (!value) return "—"
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value} pts`
}

const formatCurrencyTtd = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return "—"
  }
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return "—"
  }
  const sign = numeric < 0 ? "-" : ""
  const absolute = Math.abs(numeric).toFixed(2)
  return `${sign}$${absolute} TTD`
}

const valuePillClasses =
  "inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-white/80"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

const PAGE_SIZE = 20
const TAB_VALUES = ["transactions", "earnings", "payouts"] as const
type TabValue = (typeof TAB_VALUES)[number]

const isValidTab = (value: string | null | undefined): value is TabValue =>
  !!value && TAB_VALUES.includes(value as TabValue)

// Submit button component that uses useFormStatus for loading state
function TopUpSubmitButton({ 
  topupBonusEnabled, 
  topupBonusPoints, 
  topupBonusEndTime 
}: { 
  topupBonusEnabled: boolean
  topupBonusPoints: number
  topupBonusEndTime: string | null
}) {
  const { pending } = useFormStatus()
  const expirationTime = topupBonusEndTime ? new Date(topupBonusEndTime) : null
  const isExpired = expirationTime ? new Date() >= expirationTime : false
  const hasBonus = topupBonusEnabled && topupBonusPoints > 0 && !isExpired

  return (
    <Button 
      type="submit" 
      form="topup-form"
      disabled={pending}
      className={cn(
        "w-full h-11 text-base font-bold relative overflow-hidden group",
        hasBonus
          ? "text-white"
          : "bg-white/15 text-white hover:bg-white/25"
      )}
      style={hasBonus
        ? {
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #9333EA 100%)',
            boxShadow: '0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(147, 51, 234, 0.3)',
          }
        : undefined
      }
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2 text-white" />
          Submitting...
        </>
      ) : (
        hasBonus ? "Top Up with Bonus" : "Top Up"
      )}
      {hasBonus && !pending && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
      )}
    </Button>
  )
}

export function WalletView({
  initialWallet,
  initialBanks,
  initialTransactions,
  initialTransactionsHasMore,
  initialEarnings,
  initialPayouts,
  buyPricePerPoint,
  userValuePerPoint,
  payoutMinimumTtd,
  mandatoryTopupTtd,
  topupBonusEnabled,
  topupBonusPoints,
  topupBonusEndTime,
  hasCompletedFirstTopup,
  onSubmitAction,
}: {
  initialWallet: WalletSnapshot | null
  initialBanks: Bank[]
  initialTransactions: Transaction[]
  initialTransactionsHasMore: boolean
  initialEarnings: WalletEarningsEntry[]
  initialPayouts: Payout[]
  buyPricePerPoint: number
  userValuePerPoint: number
  payoutMinimumTtd: number
  mandatoryTopupTtd: number
  topupBonusEnabled: boolean
  topupBonusPoints: number
  topupBonusEndTime: string | null
  hasCompletedFirstTopup: boolean
  onSubmitAction: (formData: FormData) => void
}) {
  const {
    user,
    walletBalance,
    walletEarningsBalance,
    walletLockedEarningsBalance,
    nextTopupDueOn,
  } = useAuth()

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const searchParamsString = React.useMemo(() => searchParams.toString(), [searchParams])

  const [activeTab, setActiveTab] = React.useState<TabValue>(() => {
    const tabParam = searchParams.get("tab")
    return isValidTab(tabParam) ? tabParam : "transactions"
  })
  const [transactions, setTransactions] = React.useState<Transaction[]>(
    (initialTransactions ?? []).map((t) => ({
      ...t,
      points_delta: Number(t.points_delta ?? 0),
      earnings_points_delta: Number(t.earnings_points_delta ?? 0),
    }))
  )
  const [hasMoreTransactions, setHasMoreTransactions] = React.useState<boolean>(initialTransactionsHasMore)
  const [loadingMoreTransactions, setLoadingMoreTransactions] = React.useState(false)
  const [earningsEntries, setEarningsEntries] = React.useState<WalletEarningsEntry[]>(initialEarnings ?? [])
  const [payoutsEntries, setPayoutsEntries] = React.useState<Payout[]>(initialPayouts ?? [])
  const [banks] = React.useState<Bank[]>(initialBanks)
  const [walletPoints, setWalletPoints] = React.useState<number>(
    Math.trunc(Number(initialWallet?.points_balance ?? 0))
  )
  const [earningsPoints, setEarningsPoints] = React.useState<number>(
    Math.trunc(Number(initialWallet?.earnings_points ?? 0))
  )
  const [lockedEarningsPoints, setLockedEarningsPoints] = React.useState<number>(
    Math.trunc(Number(initialWallet?.locked_earnings_points ?? 0))
  )
  const [topupDue, setTopupDue] = React.useState<string | null>(initialWallet?.next_topup_due_on ?? null)
  const [receiptViewer, setReceiptViewer] = React.useState<{ url: string } | null>(null)
  const [topupDialogOpen, setTopupDialogOpen] = React.useState(false)

  const loadMoreRef = React.useRef<HTMLDivElement | null>(null)
  const transactionsRef = React.useRef<Transaction[]>(transactions)

  React.useEffect(() => {
    transactionsRef.current = transactions
  }, [transactions])

  React.useEffect(() => {
    if (typeof walletBalance === "number") {
      setWalletPoints(Math.trunc(walletBalance))
    }
  }, [walletBalance])

  React.useEffect(() => {
    if (typeof walletEarningsBalance === "number") {
      setEarningsPoints(Math.trunc(walletEarningsBalance))
    }
  }, [walletEarningsBalance])

  React.useEffect(() => {
    if (typeof walletLockedEarningsBalance === "number") {
      setLockedEarningsPoints(Math.trunc(walletLockedEarningsBalance))
    }
  }, [walletLockedEarningsBalance])

  React.useEffect(() => {
    if (nextTopupDueOn) {
      setTopupDue(nextTopupDueOn)
    }
  }, [nextTopupDueOn])

  // Check for openTopup parameter and open dialog automatically
  React.useEffect(() => {
    const openTopup = searchParams.get("openTopup")
    if (openTopup === "true") {
      setTopupDialogOpen(true)
      // Remove the parameter from URL
      const params = new URLSearchParams(searchParamsString)
      params.delete("openTopup")
      const query = params.toString()
      const href = query ? `${pathname}?${query}` : pathname
      router.replace(href, { scroll: false })
    }
  }, [searchParams, searchParamsString, pathname, router])

  React.useEffect(() => {
    const params = new URLSearchParams(searchParamsString)
    const currentTabParam = params.get("tab")

    const tabMatches =
      (isValidTab(currentTabParam) && currentTabParam === activeTab) ||
      (!currentTabParam && activeTab === "transactions")

    if (tabMatches) {
      return
    }

    if (activeTab === "transactions") {
      params.delete("tab")
    } else {
      params.set("tab", activeTab)
    }

    const query = params.toString()
    const href = query ? `${pathname}?${query}` : pathname

    router.replace(href, { scroll: false })
  }, [activeTab, pathname, router, searchParamsString])

  const processTransactions = React.useCallback(
    async (list: any[]) => {
      if (!list || list.length === 0) {
        return []
      }

      // Names are now stored directly in the transaction table, so we don't need to fetch them separately
      // Only need to create signed URLs for receipts
      const signed = await Promise.all(
        list.map(async (t: any) => {
          const base = {
            ...t,
            points_delta: Number(t.points_delta ?? 0),
            earnings_points_delta: Number(t.earnings_points_delta ?? 0),
          }
          if (!t.receipt_url) {
            return { ...base, signed_url: null }
          }
          const { data: signedUrl } = await supabase.storage.from("receipts").createSignedUrl(t.receipt_url, 600)
          return { ...base, signed_url: signedUrl?.signedUrl || null }
        })
      )

      return signed as Transaction[]
    },
    [supabase]
  )

  const fetchTransactionsBatch = React.useCallback(
    async (offset: number, pageSize: number) => {
      if (!user) {
        return { processed: [], hasMore: false }
      }

      try {
        await supabase.rpc("process_matured_earnings", { p_user_id: user.id, p_limit: 200 })
      } catch (error) {
        console.error("Error releasing matured earnings:", error)
      }

      const to = offset + pageSize
      const { data, error } = await supabase
        .from("transactions")
        .select(
          "id, type, amount_ttd, points_delta, earnings_points_delta, receipt_url, status, created_at, recipient_user_id, sender_user_id, sender_name, recipient_name, context"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .range(offset, to)

      if (error || !data) {
        if (error) {
          console.error("Error fetching transactions batch:", error)
        }
        return { processed: [], hasMore: false }
      }

      const hasMore = data.length > pageSize
      const trimmed = hasMore ? data.slice(0, pageSize) : data
      const processed = await processTransactions(trimmed)
      return { processed, hasMore }
    },
    [user, processTransactions, supabase]
  )

  const refreshTransactions = React.useCallback(async () => {
    if (!user) return
    const currentLength = Math.max(transactionsRef.current.length, PAGE_SIZE)
    const { processed, hasMore } = await fetchTransactionsBatch(0, currentLength || PAGE_SIZE)
    setTransactions(processed)
    setHasMoreTransactions(hasMore)
  }, [user, fetchTransactionsBatch])

  const refreshEarnings = React.useCallback(async () => {
    if (!user) return
    try {
      await supabase.rpc("process_matured_earnings", { p_user_id: user.id, p_limit: 200 })
    } catch (error) {
      console.error("Error processing matured earnings:", error)
    }

    const { data, error } = await supabase
      .from("wallet_earnings_ledger")
      .select(
        "id, user_id, source_type, source_id, community_id, points, amount_ttd, status, available_at, created_at, metadata"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data) {
      setEarningsEntries(data as WalletEarningsEntry[])
    }
  }, [user])

  const refreshPayouts = React.useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from("payouts")
      .select("id, points, amount_ttd, status, scheduled_for, created_at, processed_at, processed_by, transaction_id, notes, locked_points")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (!error && data) {
      setPayoutsEntries(data as Payout[])
    }
  }, [user])

  const loadMoreTransactions = React.useCallback(async () => {
    if (!user || loadingMoreTransactions || !hasMoreTransactions) {
      return
    }

    setLoadingMoreTransactions(true)
    try {
      const offset = transactionsRef.current.length
      const { processed, hasMore } = await fetchTransactionsBatch(offset, PAGE_SIZE)
      if (processed.length > 0) {
        const existingIds = new Set(transactionsRef.current.map((tx) => tx.id))
        const deduped = processed.filter((tx) => !existingIds.has(tx.id))
        if (deduped.length > 0) {
          setTransactions((prev) => [...prev, ...deduped])
        }
        setHasMoreTransactions(hasMore)
      } else {
        setHasMoreTransactions(false)
      }
    } catch (error) {
      console.error("Error loading more transactions:", error)
    } finally {
      setLoadingMoreTransactions(false)
    }
  }, [user, loadingMoreTransactions, hasMoreTransactions, fetchTransactionsBatch])

  React.useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`wallet-transactions-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` },
        () => {
          refreshTransactions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refreshTransactions])

  React.useEffect(() => {
    if (activeTab !== "transactions") return
    if (!hasMoreTransactions) return
    const node = loadMoreRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreTransactions()
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [activeTab, hasMoreTransactions, loadMoreTransactions])

  React.useEffect(() => {
    refreshEarnings()
    refreshPayouts()
  }, [refreshEarnings, refreshPayouts])

  React.useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`wallet-earnings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallet_earnings_ledger",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshEarnings()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refreshEarnings])

  React.useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`wallet-payouts-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payouts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refreshPayouts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, refreshPayouts])

  const singleBank = banks.length === 1 ? banks[0] : null

  const currencyFormatter = React.useMemo(
    () => new Intl.NumberFormat("en-TT", { style: "currency", currency: "TTD", minimumFractionDigits: 2 }),
    []
  )

  const earningsValueTtd = earningsPoints * userValuePerPoint
  const lockedValueTtd = lockedEarningsPoints * userValuePerPoint
  const minimumPayoutPoints = userValuePerPoint > 0 ? Math.ceil(payoutMinimumTtd / userValuePerPoint) : 0
  const earningsReadyForPayout = minimumPayoutPoints > 0 && earningsPoints >= minimumPayoutPoints

  const dueDate = React.useMemo(() => {
    if (!topupDue) return null
    const parsed = new Date(topupDue)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }, [topupDue])

  const isPastDue = dueDate ? new Date().setHours(0, 0, 0, 0) > dueDate.setHours(0, 0, 0, 0) : false

  const formatDateTime = (value: string) => dateFormatter.format(new Date(value))
  const handleOpenReceipt = React.useCallback((url: string) => {
    if (!url) return
    setReceiptViewer({ url })
  }, [])
  const handleCloseReceipt = React.useCallback(() => {
    setReceiptViewer(null)
  }, [])

  return (
    <div className="space-y-6">
      <WalletSuccessToast />

      <div className="flex w-full gap-4 overflow-x-auto pb-2 pr-4 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 xl:grid-cols-4">
        <div className="min-w-[260px] md:min-w-0 rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Wallet Balance</div>
            <div className="text-3xl font-bold text-white">
              {walletPoints.toLocaleString()} <span className="text-xl font-medium text-white/60">pts</span>
            </div>
          </div>
          <Dialog open={topupDialogOpen} onOpenChange={setTopupDialogOpen}>
            <DialogTrigger asChild>
              <Button className="mt-4 bg-white/10 text-white/80 hover:bg-white/20 touch-feedback">Top Up</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg [&>div]:flex [&>div]:flex-col [&>div]:p-0 [&>div]:h-full">
              <div className="flex-1 min-h-0 overflow-y-auto px-6 pt-6">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-2xl font-bold">Top Up Wallet</DialogTitle>
                  <DialogDescription className="text-white/70">
                    Upload your receipt and select the bank account used to add points to your wallet.
                  </DialogDescription>
              </DialogHeader>
                <form action={onSubmitAction} id="topup-form" className="space-y-5 pt-2 pb-6">
                  {(() => {
                    const isBonusValid = topupBonusEnabled && topupBonusPoints > 0
                    const expirationTime = topupBonusEndTime ? new Date(topupBonusEndTime) : null
                    const isExpired = expirationTime ? new Date() >= expirationTime : false
                    const isTodayOnly = expirationTime && expirationTime.toDateString() === new Date().toDateString()
                    
                    if (!isBonusValid || isExpired) return null
                    
                    return (
                      <div 
                        className="rounded-lg border-2 border-yellow-400/40 p-4 space-y-3 relative overflow-hidden"
                        style={{
                          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(255, 215, 0, 0.15) 50%, rgba(147, 51, 234, 0.15) 100%)',
                          boxShadow: '0 0 20px rgba(147, 51, 234, 0.3), 0 0 40px rgba(255, 215, 0, 0.2), inset 0 0 30px rgba(147, 51, 234, 0.1)',
                        }}
                      >
                        {/* Animated gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 via-purple-500/5 to-yellow-400/5 animate-pulse pointer-events-none z-0" />
                        
                        <div className="relative z-10 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 via-yellow-500 to-purple-500 flex items-center justify-center border-2 border-yellow-400/50 shadow-lg relative overflow-hidden"
                                style={{
                                  boxShadow: '0 0 15px rgba(255, 215, 0, 0.6), 0 0 30px rgba(147, 51, 234, 0.4)',
                                }}
                              >
                                <Gift className="h-4 w-4 text-white relative z-10 drop-shadow-lg" />
                              </div>
                              <div className="text-sm font-bold bg-gradient-to-r from-yellow-400 via-yellow-300 to-purple-400 bg-clip-text text-transparent">Top-Up Bonus!</div>
                            </div>
                            {isTodayOnly && (
                              <span 
                                className="text-xs font-bold text-white bg-gradient-to-r from-yellow-500/90 to-purple-500/90 px-3 py-1 rounded-full border-2 border-yellow-400/50 shadow-lg"
                                style={{
                                  boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                                }}
                              >
                                Today Only
                              </span>
                            )}
                          </div>
                          <div className="text-center">
                            <div className="inline-flex items-baseline gap-1.5">
                              <span 
                                className="text-3xl sm:text-4xl font-black bg-gradient-to-br from-yellow-400 via-yellow-300 to-purple-400 bg-clip-text text-transparent drop-shadow-lg"
                                style={{
                                  textShadow: '0 0 15px rgba(255, 215, 0, 0.5), 0 0 30px rgba(147, 51, 234, 0.3)',
                                  filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))',
                                }}
                              >
                                +{topupBonusPoints.toLocaleString()}
                              </span>
                              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-yellow-300 to-purple-300 bg-clip-text text-transparent">bonus points</span>
                            </div>
                          </div>
                          {expirationTime && (
                            <>
                              <BonusCountdown endTime={topupBonusEndTime!} />
                              <div className="text-center">
                                <p className="text-[10px] sm:text-xs text-white/60 font-medium">
                                  Expires: {expirationTime.toLocaleString(undefined, { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                <div className="space-y-2">
                    <Label htmlFor="points" className="text-white/90 font-medium">
                    Points
                  </Label>
                    <TopUpAmount 
                      buyPricePerPoint={Number(buyPricePerPoint ?? 1)} 
                      minAmount={mandatoryTopupTtd}
                      showBonus={(() => {
                        const expirationTime = topupBonusEndTime ? new Date(topupBonusEndTime) : null
                        const isExpired = expirationTime ? new Date() >= expirationTime : false
                        return topupBonusEnabled && topupBonusPoints > 0 && !isExpired
                      })()}
                      bonusPoints={topupBonusPoints}
                      bonusEndTime={topupBonusEndTime}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="text-white/90 font-medium">Bank Account</Label>
                  {singleBank ? (
                    <>
                      <input type="hidden" name="bank_account_id" value={singleBank.id} />
                        <div className="rounded-lg bg-white/10 border border-white/20 p-4 space-y-4">
                          <div className="pb-2 border-b border-white/10">
                            <div className="text-white font-semibold text-base">{singleBank.bank_name}</div>
                          </div>
                          <div className="space-y-3">
                            <CopyField label="Account Name" value={singleBank.account_name ?? ''} />
                            <CopyField label="Account Number" value={singleBank.account_number ?? ''} />
                            <CopyField label="Account Type" value={singleBank.account_type ?? ''} />
                          </div>
                      </div>
                    </>
                  ) : (
                    <Select name="bank_account_id" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bank_name} — {b.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="file" className="text-white/90 font-medium">
                    Receipt File
                  </Label>
                    <ReceiptUpload
                      id="file"
                      name="file"
                      accept="image/*,application/pdf"
                      required
                    />
                </div>
              </form>
              </div>
              <div className="border-t border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md py-3 sm:py-4">
                <div className="px-6">
                  <TopUpSubmitButton 
                    topupBonusEnabled={topupBonusEnabled}
                    topupBonusPoints={topupBonusPoints}
                    topupBonusEndTime={topupBonusEndTime}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="min-w-[260px] md:min-w-0 rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Earnings Available</div>
          <div className="text-3xl font-bold text-white">
            {earningsPoints.toLocaleString()}
            <span className="text-xl font-medium text-white/60"> pts</span>
          </div>
          <div className="text-sm text-white/60 mt-1">{currencyFormatter.format(earningsValueTtd || 0)}</div>
          <div className="text-xs text-white/50 mt-3 space-y-1">
            <div>
              Minimum payout: {minimumPayoutPoints.toLocaleString()} pts ({currencyFormatter.format(payoutMinimumTtd)})
            </div>
            <div>
              {earningsReadyForPayout ? (
                <span className="text-white/80">Great! You meet the payout threshold.</span>
              ) : (
                <span className="text-white/60">Keep earning to qualify for the next payout window.</span>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-[260px] md:min-w-0 rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Earnings Locked for Payout</div>
          <div className="text-3xl font-bold text-white">
            {lockedEarningsPoints.toLocaleString()}
            <span className="text-xl font-medium text-white/60"> pts</span>
          </div>
          <div className="text-sm text-white/60 mt-1">{currencyFormatter.format(lockedValueTtd || 0)}</div>
          <div className="text-xs text-white/60 mt-3">
            Locked earnings will be paid once the manual review completes on the 1st of the month.
          </div>
        </div>

        <div className="min-w-[260px] md:min-w-0 rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Mandatory Top-Up</div>
          <div className="text-xl font-semibold text-white">
            {currencyFormatter.format(mandatoryTopupTtd)}{" "}
            <span className="text-sm font-medium text-white/60">monthly</span>
          </div>
          <div className="text-sm text-white/60 mt-2">
            {dueDate ? (
              <span className={cn("font-medium", isPastDue ? "text-white" : "text-white/80")}>
                {isPastDue ? "Overdue since " : "Due on "}
                {dueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            ) : (
              <span className="text-white/60">Scheduled after your first top-up.</span>
            )}
          </div>
          <div className="text-xs text-white/50 mt-3">
            We’ll email a reminder before your due date so you can stay current.
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4 text-sm text-white/70">
        Payouts are processed manually on the 1st of each month. Once your confirmed earnings cross the threshold, they
        will move into the payouts tab automatically.
      </div>

      {banks.length > 1 && (
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-5 space-y-4">
          <div className="text-white font-semibold text-lg pb-1">Bank Details</div>
          <div className="space-y-4">
            {banks.map((b) => (
              <div key={b.id} className="rounded-lg bg-white/10 border border-white/20 p-4 space-y-4">
                <div className="pb-3 border-b border-white/10">
                  <div className="text-white font-semibold text-base">{b.bank_name}</div>
                </div>
                <div className="space-y-3">
                  <CopyField label="Account Name" value={b.account_name ?? ''} />
                  <CopyField label="Account Number" value={b.account_number ?? ''} />
                  <CopyField label="Account Type" value={b.account_type ?? ''} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (isValidTab(value)) {
            setActiveTab(value)
          }
        }}
        className="space-y-6"
      >
        <TabsList className="w-full bg-white/10 text-white/80">
          <TabsTrigger value="transactions" className="flex-1">Transactions</TabsTrigger>
          <TabsTrigger value="earnings" className="flex-1">Earnings</TabsTrigger>
          <TabsTrigger value="payouts" className="flex-1">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <div className="hidden md:block">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-white/80">Date</TableHead>
                <TableHead className="text-white/80">Type</TableHead>
                <TableHead className="text-white/80">Status</TableHead>
                <TableHead className="text-white/80">TTD</TableHead>
                <TableHead className="text-white/80">Wallet Change</TableHead>
                <TableHead className="text-white/80">Earnings Change</TableHead>
                <TableHead className="text-white/80">Recipient</TableHead>
                <TableHead className="text-white/80">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const amountDisplay = formatCurrencyTtd(t.amount_ttd)
                const walletDelta = formatPointsDelta(t.points_delta)
                const earningsDelta = formatPointsDelta(t.earnings_points_delta)
                
                // Determine recipient label based on transaction type
                // Names are now stored directly in the transaction table
                let recipientLabel = "—"
                if (t.type === "point_refund" && t.points_delta > 0) {
                  recipientLabel = "You"
                } else if (t.type === "earning_credit" && t.sender_name) {
                  // For earning_credit, sender_name is who sent the money
                  recipientLabel = `Received from ${t.sender_name}`
                } else if (t.type === "point_spend" && t.points_delta < 0) {
                  // For point_spend, recipient_name is who received the points
                  recipientLabel = t.recipient_name ? `Sent to ${t.recipient_name}` : (t.recipient_user_id ? "Sent to user" : "Platform")
                } else if (t.recipient_name) {
                  recipientLabel = t.recipient_name
                } else if (t.sender_name && t.type !== "earning_credit") {
                  recipientLabel = t.sender_name
                }

                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-white/80">{formatDateTime(t.created_at)}</TableCell>
                <TableCell className="text-white/80">{renderTransactionTypeBadge(t.type)}</TableCell>
                    <TableCell className="text-white/80">{renderStatus(t.status)}</TableCell>
                    <TableCell className="text-white/80">
                      {amountDisplay !== "—" ? (
                        <div className={valuePillClasses}>
                          <Coins className="h-4 w-4 text-white/70" />
                          <span>{amountDisplay}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-white/80">
                      {walletDelta !== "—" ? (
                        <div className={valuePillClasses}>
                          <WalletIcon className="h-4 w-4 text-white/70" />
                          <span>{walletDelta}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-white/80">
                      {earningsDelta !== "—" ? (
                        <div className={valuePillClasses}>
                          <WalletIcon className="h-4 w-4 text-white/70" />
                          <span>{earningsDelta}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-white/80">{recipientLabel}</TableCell>
                    <TableCell className="text-white/80">
                      {t.signed_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="inline-flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10 touch-feedback"
                          onClick={() => handleOpenReceipt(t.signed_url ?? "")}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-white/60">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4 md:hidden">
          {transactions.map((t) => {
            const createdAt = new Date(t.created_at)
            const walletDelta = formatPointsDelta(t.points_delta)
            const earningsDelta = formatPointsDelta(t.earnings_points_delta)
            const amountDisplay = formatCurrencyTtd(t.amount_ttd)
            
            // Determine recipient label based on transaction type
            // Names are now stored directly in the transaction table
            let recipientLabel = "—"
            if (t.type === "point_refund" && t.points_delta > 0) {
              recipientLabel = "You"
            } else if (t.type === "earning_credit" && t.sender_name) {
              // For earning_credit, sender_name is who sent the money
              recipientLabel = `Received from ${t.sender_name}`
            } else if (t.type === "point_spend" && t.points_delta < 0) {
              // For point_spend, recipient_name is who received the points
              recipientLabel = t.recipient_name ? `Sent to ${t.recipient_name}` : (t.recipient_user_id ? "Sent to user" : "Platform")
            } else if (t.recipient_name) {
              recipientLabel = t.recipient_name
            } else if (t.sender_name && t.type !== "earning_credit") {
              recipientLabel = t.sender_name
            }

            return (
              <div
                key={t.id}
                className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center">
                      {renderTransactionTypeBadge(t.type)}
                    </div>
                    <div className="text-xs text-white/50">
                      {createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      {" • "}
                      {createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                  <div>{renderStatus(t.status)}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                    <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Wallet Change</div>
                    <div className="text-lg font-semibold text-white">
                      {walletDelta !== "—" ? (
                        <div className="inline-flex items-center gap-2 text-white">
                          <WalletIcon className="h-4 w-4 text-white/70" />
                          <span>{walletDelta}</span>
                        </div>
                      ) : (
                        <span className="text-white/60">—</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                    <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Earnings Change</div>
                    <div className="text-lg font-semibold text-white">
                      {earningsDelta !== "—" ? (
                        <div className="inline-flex items-center gap-2 text-white">
                          <WalletIcon className="h-4 w-4 text-white/70" />
                          <span>{earningsDelta}</span>
                        </div>
                      ) : (
                        <span className="text-white/60">—</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2 rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                    <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Amount (TTD)</div>
                    <div className="text-lg font-semibold text-white">
                      {amountDisplay !== "—" ? (
                        <div className="inline-flex items-center gap-2 text-white">
                          <Coins className="h-4 w-4 text-white/70" />
                          <span>{amountDisplay}</span>
                        </div>
                      ) : (
                        <span className="text-white/60">—</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-2 text-sm">
                  <div className="flex items-center justify-between text-white/70">
                    <span className="text-xs font-medium uppercase tracking-wide text-white/50">Recipient</span>
                    <span className="text-white/80">{recipientLabel}</span>
                  </div>
                  {t.signed_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="inline-flex items-center gap-2 text-white/80 hover:text-white hover:bg-white/10 touch-feedback px-2 py-1"
                      onClick={() => handleOpenReceipt(t.signed_url ?? "")}
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  ) : (
                    <span className="text-xs text-white/50">No receipt attached</span>
                  )}
                </div>
              </div>
            )
          })}
          {transactions.length === 0 && (
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-8 text-center">
              <p className="text-white/60">No transactions yet.</p>
            </div>
          )}
        </div>
          {loadingMoreTransactions && (
            <div className="text-center text-white/60 text-sm">Loading transactions…</div>
          )}
          <div ref={loadMoreRef} className="h-1" />
          {!hasMoreTransactions && transactions.length > 0 && !loadingMoreTransactions && (
            <div className="text-center text-white/50 text-xs pb-2">No more transactions.</div>
          )}
        </TabsContent>

        <TabsContent value="earnings" className="space-y-4">
          <div className="text-xs text-white/60">
            Earnings become available after the reversal window for boosts and live registrations.
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white/80">Created</TableHead>
                  <TableHead className="text-white/80">Source</TableHead>
                  <TableHead className="text-white/80">Points</TableHead>
                  <TableHead className="text-white/80">TTD</TableHead>
                  <TableHead className="text-white/80">Status</TableHead>
                  <TableHead className="text-white/80">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earningsEntries.length > 0 ? (
                  earningsEntries.map((entry) => {
                    const amountDisplay = formatCurrencyTtd(entry.amount_ttd)
                    const pointsDisplay = `${entry.points.toLocaleString()} pts`

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-white/80">{formatDateTime(entry.created_at)}</TableCell>
                        <TableCell className="text-white/80">
                          {earningsSourceLabels[entry.source_type] || entry.source_type}
                        </TableCell>
                        <TableCell className="text-white/80">
                          <div className={valuePillClasses}>
                            <WalletIcon className="h-4 w-4 text-white/70" />
                            <span>{pointsDisplay}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-white/80">
                          {amountDisplay !== "—" ? (
                            <div className={valuePillClasses}>
                              <Coins className="h-4 w-4 text-white/70" />
                              <span>{amountDisplay}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-white/80">{renderStatus(entry.status)}</TableCell>
                        <TableCell className="text-white/80">
                          {entry.available_at ? formatDateTime(entry.available_at) : "Instant"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-white/60">
                      No earnings yet. Host live sessions or earn boosts to build your balance.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-4 md:hidden">
            {earningsEntries.length > 0 ? (
              earningsEntries.map((entry) => {
                const sourceLabel =
                  earningsSourceLabels[entry.source_type] ||
                  entry.source_type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
                const availableLabel = entry.available_at ? formatDateTime(entry.available_at) : "Instant"
                const pointsDisplay = `${entry.points.toLocaleString()} pts`
                const amountDisplay = formatCurrencyTtd(entry.amount_ttd)

                return (
                  <div
                    key={entry.id}
                    className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="text-base font-semibold text-white">{sourceLabel}</div>
                      <div className="flex items-center">{renderStatus(entry.status)}</div>
                    </div>
                    <div className="text-xs text-white/50 text-right whitespace-nowrap">
                      {formatDateTime(entry.created_at)}
                    </div>
                    </div>

                  <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                        <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Points</div>
                        <div className="text-lg font-semibold text-white">
                          <div className="inline-flex items-center gap-2 text-white">
                            <WalletIcon className="h-4 w-4 text-white/70" />
                            <span>{pointsDisplay}</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                        <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Available</div>
                        <div className="text-sm text-white/80">{availableLabel}</div>
                      </div>
                    </div>

                  <div className="rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                    <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Amount (TTD)</div>
                    <div className="text-lg font-semibold text-white">
                      {amountDisplay !== "—" ? (
                        <div className="inline-flex items-center gap-2 text-white">
                          <Coins className="h-4 w-4 text-white/70" />
                          <span>{amountDisplay}</span>
                        </div>
                      ) : (
                        <span className="text-white/60">—</span>
                      )}
                    </div>
                  </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-8 text-center">
                <p className="text-white/60">No earnings yet. Host live sessions or earn boosts to build your balance.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-4">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white/80">Scheduled For</TableHead>
                  <TableHead className="text-white/80">Status</TableHead>
                  <TableHead className="text-white/80">Points</TableHead>
                  <TableHead className="text-white/80">TTD</TableHead>
                  <TableHead className="text-white/80">Locked Points</TableHead>
                  <TableHead className="text-white/80">Processed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutsEntries.length > 0 ? (
                  payoutsEntries.map((payout) => {
                    const pointsDisplay = `${payout.points.toLocaleString()} pts`
                    const lockedPointsDisplay = `${payout.locked_points.toLocaleString()} pts`
                    const amountDisplay = formatCurrencyTtd(payout.amount_ttd)

                    return (
                      <TableRow key={payout.id}>
                        <TableCell className="text-white/80">
                          {new Date(payout.scheduled_for).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-white/80">{renderStatus(payout.status)}</TableCell>
                        <TableCell className="text-white/80">
                          <div className={valuePillClasses}>
                            <WalletIcon className="h-4 w-4 text-white/70" />
                            <span>{pointsDisplay}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-white/80">
                          {amountDisplay !== "—" ? (
                            <div className={valuePillClasses}>
                              <Coins className="h-4 w-4 text-white/70" />
                              <span>{amountDisplay}</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-white/80">
                          <div className={valuePillClasses}>
                            <WalletIcon className="h-4 w-4 text-white/70" />
                            <span>{lockedPointsDisplay}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-white/80">
                          {payout.processed_at ? formatDateTime(payout.processed_at) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-white/60">
                      No payouts yet. Once you meet the minimum, your earnings will lock into the next cycle automatically.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-4 md:hidden">
            {payoutsEntries.length > 0 ? (
              payoutsEntries.map((payout) => {
                const scheduledLabel = new Date(payout.scheduled_for).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
                const createdLabel = new Date(payout.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
                const processedLabel = payout.processed_at ? formatDateTime(payout.processed_at) : "—"
                const pointsDisplay = `${payout.points.toLocaleString()} pts`
                const lockedPointsDisplay = `${payout.locked_points.toLocaleString()} pts`
                const amountDisplay = formatCurrencyTtd(payout.amount_ttd)

                return (
                  <div
                    key={payout.id}
                    className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-base font-semibold text-white">Scheduled {scheduledLabel}</div>
                        <div className="text-xs text-white/50">Created {createdLabel}</div>
                      </div>
                      <div className="flex-shrink-0">{renderStatus(payout.status)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                        <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Points</div>
                        <div className="text-lg font-semibold text-white">
                          <div className="inline-flex items-center gap-2 text-white">
                            <WalletIcon className="h-4 w-4 text-white/70" />
                            <span>{pointsDisplay}</span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                        <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Locked Points</div>
                        <div className="text-lg font-semibold text-white">
                          <div className="inline-flex items-center gap-2 text-white">
                            <WalletIcon className="h-4 w-4 text-white/70" />
                            <span>{lockedPointsDisplay}</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-2 rounded-md bg-white/5 border border-white/10 p-3 space-y-1">
                        <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Amount (TTD)</div>
                        <div className="text-lg font-semibold text-white">
                          {amountDisplay !== "—" ? (
                            <div className="inline-flex items-center gap-2 text-white">
                              <Coins className="h-4 w-4 text-white/70" />
                              <span>{amountDisplay}</span>
                            </div>
                          ) : (
                            <span className="text-white/60">—</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-white/10 pt-2 text-sm">
                      <div className="flex items-center justify-between text-white/70">
                        <span className="text-xs font-medium uppercase tracking-wide text-white/50">Processed</span>
                        <span className="text-white/80">{processedLabel}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-8 text-center">
                <p className="text-white/60">
                  No payouts yet. Once you meet the minimum, your earnings will lock into the next cycle automatically.
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!receiptViewer} onOpenChange={(open) => (!open ? handleCloseReceipt() : null)}>
        <DialogContent className="!max-w-[95vw] !max-h-[95dvh] !w-[95vw] !h-[95dvh] !top-[2.5dvh] !left-[2.5vw] !translate-x-0 !translate-y-0 border-0 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Receipt preview</DialogTitle>
            <DialogDescription>Review the uploaded receipt in full size. Close the dialog to return to your wallet.</DialogDescription>
          </DialogHeader>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCloseReceipt}
            className="absolute right-4 top-4 z-50 h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 border border-white/20 text-white backdrop-blur-sm"
          >
            <X className="h-5 w-5" />
          </Button>
          {receiptViewer ? (
            receiptViewer.url.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={`${receiptViewer.url}#toolbar=0`}
                className="w-full h-full"
                title="Receipt PDF"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receiptViewer.url}
                alt="Receipt"
                className="block w-full h-full object-contain bg-black/40"
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

