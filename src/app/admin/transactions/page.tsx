"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, CreditCard, Eye, CheckCircle2, XCircle, ChevronDown, Wallet as WalletIcon, Coins } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const valuePillClasses =
  "inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-xs font-medium text-white/80"

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

const formatPointsDelta = (value: number | null | undefined) => {
  if (!value) return "—"
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "—"
  }
  const prefix = numeric > 0 ? "+" : ""
  return `${prefix}${numeric} pts`
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [activeTx, setActiveTx] = useState<any | null>(null)
  const [userMap, setUserMap] = useState<Record<string, { label: string; email?: string }> | null>(null)
  const [bankMap, setBankMap] = useState<Record<string, { label: string; detail?: string }> | null>(null)
  const [recipientMap, setRecipientMap] = useState<Record<string, { label: string; email?: string }> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*, recipient_user_id, points_delta')
      .order('created_at', { ascending: false })

    if (!error) {
      const rows = data ?? []

      // Build lookup sets
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)))
      const recipientIds = Array.from(new Set(rows.map((r) => r.recipient_user_id).filter(Boolean)))
      const bankIds = Array.from(new Set(rows.map((r) => r.bank_account_id).filter(Boolean)))
      const allUserIds = Array.from(new Set([...userIds, ...recipientIds]))

      // Fetch related users (best-effort; may be restricted by RLS)
      let usersById: Record<string, { label: string; email?: string }> = {}
      if (allUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, username')
          .in('id', allUserIds)

        if (usersData) {
          for (const u of usersData as any[]) {
            const fullName = u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : null
            const label = fullName || u.username || u.email || u.id
            usersById[u.id] = { label, email: u.email || undefined }
          }
        }
      }
      
      // Separate recipient map
      const recipientsById: Record<string, { label: string; email?: string }> = {}
      recipientIds.forEach(id => {
        if (usersById[id]) {
          recipientsById[id] = usersById[id]
        }
      })

      // Fetch related bank accounts (best-effort)
      let banksById: Record<string, { label: string; detail?: string }> = {}
      if (bankIds.length > 0) {
        const { data: bankData } = await supabase
          .from('bank_accounts')
          .select('id, account_name, bank_name, account_number')
          .in('id', bankIds)

        if (bankData) {
          for (const b of bankData as any[]) {
            banksById[b.id] = {
              label: b.account_name || b.bank_name || b.id,
              detail: b.bank_name && b.account_number ? `${b.bank_name} - ${b.account_number}` : undefined,
            }
          }
        }
      }

      const withSigned = await Promise.all(rows.map(async (t) => {
        if (!t.receipt_url) return { ...t, signed_url: null }
        const { data: signed } = await supabase.storage.from('receipts').createSignedUrl(t.receipt_url, 600)
        return { ...t, signed_url: signed?.signedUrl ?? null }
      }))
      setTransactions(withSigned)
      setUserMap(usersById)
      setBankMap(banksById)
      setRecipientMap(recipientsById)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('admin-transactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        () => {
          load()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [load])

  const handleView = (tx: any) => {
    setActiveTx(tx)
    setDetailsOpen(true)
  }

  const handleVerify = async (tx: any) => {
    await supabase.rpc('verify_transaction', { p_transaction_id: tx.id })
    await load()
  }

  const handleReject = async (tx: any) => {
    await supabase.rpc('reject_transaction', { p_transaction_id: tx.id, p_reason: 'Rejected by admin' })
    await load()
  }

  const handleStatusChange = async (tx: any, newStatus: string) => {
    await supabase
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', tx.id)
    await load()
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        subtitle="All platform transactions. Review and verify receipts where provided."
      />

      {loading ? (
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
          <p className="text-white/80">Loading transactions…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
          <CreditCard className="h-12 w-12 text-white/60 mx-auto mb-4" />
          <p className="text-white/80">No transactions found</p>
          <p className="text-white/60 text-sm mt-1">There are no transactions to display yet</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Bank Account</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Points</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Receipt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => {
              const typeLabel = t.type?.replaceAll('_', ' ') || 'unknown'
              const amountDisplay = formatCurrencyTtd(t.amount_ttd)
              const pointsDisplay = formatPointsDelta(t.points_delta)
              const recipientLabel = t.recipient_user_id
                ? recipientMap?.[t.recipient_user_id]?.label || t.recipient_user_id
                : t.type === 'point_spend' && t.points_delta < 0
                  ? 'Platform'
                  : '—'

              return (
                <ContextMenu key={t.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow className="cursor-context-menu">
                      <TableCell>
                        <div>
                          <div className="font-medium">{userMap?.[t.user_id]?.label || t.user_id}</div>
                          <div className="text-sm text-white/60">{userMap?.[t.user_id]?.email || '—'}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-white/10 text-white border-white/20 capitalize">
                          {typeLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {t.bank_account_id ? (
                          <div>
                            <div className="font-medium">{bankMap?.[t.bank_account_id]?.label || t.bank_account_id}</div>
                            {bankMap?.[t.bank_account_id]?.detail ? (
                              <div className="text-sm text-white/60">{bankMap[t.bank_account_id].detail}</div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-white/60">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {amountDisplay !== '—' ? (
                          <div className={valuePillClasses}>
                            <Coins className="h-4 w-4 text-white/70" />
                            <span>{amountDisplay}</span>
                          </div>
                        ) : (
                          <span className="text-white/60">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {pointsDisplay !== '—' ? (
                          <div className={valuePillClasses}>
                            <WalletIcon className="h-4 w-4 text-white/70" />
                            <span>{pointsDisplay}</span>
                          </div>
                        ) : (
                          <span className="text-white/60">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {t.recipient_user_id ? (
                          <div>
                            <div className="font-medium text-white/80">{recipientLabel}</div>
                            {recipientMap?.[t.recipient_user_id]?.email && (
                              <div className="text-sm text-white/60">{recipientMap[t.recipient_user_id].email}</div>
                            )}
                          </div>
                        ) : (
                          <span className={cn(recipientLabel === 'Platform' ? 'italic text-white/60' : 'text-white/60')}>
                            {recipientLabel}
                          </span>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
                        {t.status === 'verified' ? (
                          <Badge
                            variant="outline"
                            className="bg-green-500/20 text-green-400 border-green-500/30 w-fit text-xs"
                          >
                            {t.status}
                          </Badge>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer ${
                                  t.status === 'rejected'
                                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                }`}
                              >
                                {t.status}
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(t, 'pending')}
                                disabled={t.status === 'pending'}
                              >
                                Pending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleVerify(t)}
                              >
                                Verified
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleReject(t)}
                                disabled={t.status === 'rejected'}
                              >
                                Rejected
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{new Date(t.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-white/60">{new Date(t.created_at).toLocaleTimeString()}</div>
                      </TableCell>
                      <TableCell>
                        {t.signed_url ? (
                          <a
                            href={t.signed_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-white/80 hover:text-white underline"
                          >
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-white/60 text-sm">No receipt</span>
                        )}
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleView(t)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </ContextMenuItem>
                    {t.status !== 'verified' && (
                      <>
                        <ContextMenuItem onClick={() => handleVerify(t)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Verify
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleReject(t)} className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>Review the transaction metadata, status, and receipt information.</DialogDescription>
          </DialogHeader>
          {activeTx &&
            (() => {
              const amountDisplay = formatCurrencyTtd(activeTx.amount_ttd)
              const pointsDisplay = formatPointsDelta(activeTx.points_delta)
              const recipientLabel = activeTx.recipient_user_id
                ? recipientMap?.[activeTx.recipient_user_id]?.label || activeTx.recipient_user_id
                : activeTx.type === 'point_spend' && activeTx.points_delta < 0
                  ? 'Platform'
                  : '—'

              return (
                <div className="space-y-3 text-white/90">
                  <div className="flex justify-between"><span className="text-white/60">ID</span><span>{activeTx.id}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">User</span><span>{activeTx.user_id}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">Type</span><span className="capitalize">{activeTx.type?.replaceAll('_', ' ')}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">Status</span><span>{activeTx.status}</span></div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-white/60">Amount</span>
                    {amountDisplay !== '—' ? (
                      <span className="inline-flex items-center gap-2 text-white/80">
                        <Coins className="h-4 w-4 text-white/70" />
                        <span>{amountDisplay}</span>
                      </span>
                    ) : (
                      <span className="text-white/60">—</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span className="text-white/60">Points</span>
                    {pointsDisplay !== '—' ? (
                      <span className="inline-flex items-center gap-2 text-white/80">
                        <WalletIcon className="h-4 w-4 text-white/70" />
                        <span>{pointsDisplay}</span>
                      </span>
                    ) : (
                      <span className="text-white/60">—</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Recipient</span>
                    <span className={cn(recipientLabel === 'Platform' ? 'italic text-white/60' : 'text-white/80')}>
                      {recipientLabel}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-white/60">Bank Account</span><span>{activeTx.bank_account_id || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-white/60">Created</span><span>{new Date(activeTx.created_at).toLocaleString()}</span></div>
                  {activeTx.signed_url ? (
                    <div className="pt-2">
                      <a href={activeTx.signed_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-white/80 hover:text-white underline">
                        View Receipt <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : null}
                </div>
              )
            })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}


