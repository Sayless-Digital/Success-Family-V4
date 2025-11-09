"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import { toast } from "sonner"
import { RefreshCcw, CheckCircle2, XCircle, PlayCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type PayoutRow = {
  id: string
  user_id: string
  points: number
  locked_points: number
  amount_ttd: number
  status: string
  scheduled_for: string
  processed_at?: string | null
  created_at: string
  user?: {
    first_name?: string | null
    last_name?: string | null
    username?: string | null
    email?: string | null
  } | null
}

const formatter = new Intl.NumberFormat("en-TT", { style: "currency", currency: "TTD", minimumFractionDigits: 2 })
const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"
const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString() : "—"

const statusStyles: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-white/10 text-white/80" },
  processing: { label: "Processing", className: "bg-white/10 text-white/80" },
  paid: { label: "Paid", className: "bg-white/20 text-white" },
  cancelled: { label: "Cancelled", className: "bg-white/10 text-white/60" },
}

export function AdminPayoutsClient() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [payouts, setPayouts] = useState<PayoutRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("payouts")
      .select(
        "id, user_id, points, locked_points, amount_ttd, status, scheduled_for, processed_at, created_at, users!inner(first_name, last_name, username, email)"
      )
      .order("scheduled_for", { ascending: false })
      .limit(200)

    if (error) {
      toast.error(error.message)
      setPayouts([])
    } else {
      const rows: PayoutRow[] =
        data?.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          points: Number(row.points ?? 0),
          locked_points: Number(row.locked_points ?? 0),
          amount_ttd: Number(row.amount_ttd ?? 0),
          status: row.status,
          scheduled_for: row.scheduled_for,
          processed_at: row.processed_at,
          created_at: row.created_at,
          user: row.users
            ? {
                first_name: row.users.first_name,
                last_name: row.users.last_name,
                username: row.users.username,
                email: row.users.email,
              }
            : null,
        })) ?? []
      setPayouts(rows)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleMarkProcessing = useCallback(
    async (payout: PayoutRow) => {
      const { error } = await supabase.from("payouts").update({ status: "processing" }).eq("id", payout.id)
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Payout marked as processing")
        load()
      }
    },
    [load]
  )

  const handleCancel = useCallback(
    async (payout: PayoutRow) => {
      const reason = prompt("Optional cancellation note (will be stored with the payout):")
      const { error } = await supabase.rpc("cancel_payout", {
        p_payout_id: payout.id,
        p_reason: reason ?? null,
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Payout cancelled")
        load()
      }
    },
    [load]
  )

  const handleComplete = useCallback(
    async (payout: PayoutRow) => {
      if (!user) return
      const defaultAmount = payout.amount_ttd?.toFixed(2) ?? "0.00"
      const amountStr = prompt("Enter the payout amount in TTD:", defaultAmount)
      if (amountStr === null) return
      const amount = Number(amountStr)
      if (!Number.isFinite(amount) || amount < 0) {
        toast.error("Invalid payout amount")
        return
      }
      const { error } = await supabase.rpc("complete_payout", {
        p_payout_id: payout.id,
        p_processed_by: user.id,
        p_transaction_amount: amount,
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Payout marked as paid")
        load()
      }
    },
    [load, user]
  )

  const statusBadge = useCallback((status: string) => {
    const entry = statusStyles[status] ?? statusStyles.pending
    return <Badge className={cn("border border-white/20", entry.className)}>{entry.label}</Badge>
  }, [])

  const totals = useMemo(() => {
    const pending = payouts.filter((p) => p.status === "pending" || p.status === "processing")
    const pendingPoints = pending.reduce((sum, p) => sum + Number(p.locked_points ?? 0), 0)
    const pendingTtd = pending.reduce((sum, p) => sum + Number(p.amount_ttd ?? 0), 0)
    return {
      pendingPoints,
      pendingTtd,
    }
  }, [payouts])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payout Administration"
        subtitle="Review locked earnings and reconcile manual payments each month."
      />

      <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-white/60">Locked earnings awaiting payout</div>
          <div className="text-2xl font-semibold text-white">
            {totals.pendingPoints.toLocaleString()} pts{" "}
            <span className="text-lg text-white/60">({formatter.format(totals.pendingTtd)})</span>
          </div>
        </div>
        <Button
          onClick={load}
          variant="ghost"
          className="text-white/80 hover:text-white hover:bg-white/10 touch-feedback inline-flex items-center gap-2"
        >
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-white/80">Creator</TableHead>
              <TableHead className="text-white/80">Scheduled For</TableHead>
              <TableHead className="text-white/80">Status</TableHead>
              <TableHead className="text-white/80">Points</TableHead>
              <TableHead className="text-white/80">Locked Points</TableHead>
              <TableHead className="text-white/80">TTD</TableHead>
              <TableHead className="text-white/80">Processed</TableHead>
              <TableHead className="text-white/80 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.map((payout) => {
              const userLabel =
                payout.user?.username ||
                (payout.user?.first_name && payout.user?.last_name
                  ? `${payout.user.first_name} ${payout.user.last_name}`
                  : payout.user?.email) ||
                payout.user_id

              return (
                <TableRow key={payout.id}>
                  <TableCell className="text-white/80">{userLabel}</TableCell>
                  <TableCell className="text-white/80">{formatDate(payout.scheduled_for)}</TableCell>
                  <TableCell className="text-white/80">{statusBadge(payout.status)}</TableCell>
                  <TableCell className="text-white/80">{payout.points.toLocaleString()}</TableCell>
                  <TableCell className="text-white/80">{payout.locked_points.toLocaleString()}</TableCell>
                  <TableCell className="text-white/80">{formatter.format(payout.amount_ttd)}</TableCell>
                  <TableCell className="text-white/80">{formatDateTime(payout.processed_at)}</TableCell>
                  <TableCell className="text-white/80">
                    <div className="flex items-center justify-end gap-2">
                      {(payout.status === "pending" || payout.status === "processing") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/80 hover:text-white hover:bg-white/10 touch-feedback"
                          onClick={() => handleMarkProcessing(payout)}
                        >
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Processing
                        </Button>
                      )}
                      {payout.status !== "paid" && payout.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/80 hover:text-white hover:bg-white/10 touch-feedback"
                          onClick={() => handleComplete(payout)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      {payout.status !== "cancelled" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white/60 hover:text-white hover:bg-white/10 touch-feedback"
                          onClick={() => handleCancel(payout)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {payouts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-white/60 text-center py-10">
                  {loading ? "Loading payouts..." : "No payouts found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
      </Table>
    </div>
  )
}


