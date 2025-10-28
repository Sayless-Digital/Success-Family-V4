"use client"

import React, { useState, useEffect } from "react"
import { CheckCircle2, XCircle, Eye, Search, MoreVertical, CreditCard, FileText } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-provider"
import type { PaymentReceipt, PaymentStatus } from "@/types"
import { toast } from "sonner"

interface PaymentWithDetails extends PaymentReceipt {
  user: {
    first_name: string
    last_name: string
    email: string
  }
  plan: {
    name: string
  }
  bank_account: {
    account_name: string
    bank_name: string
  }
}

interface CommunityPaymentsViewProps {
  communityId: string
  communityName: string
  ownerId: string
}

export default function CommunityPaymentsView({ communityId, communityName, ownerId }: CommunityPaymentsViewProps) {
  const { user } = useAuth()
  const colorStops = useAuroraColors()
  
  const [payments, setPayments] = useState<PaymentWithDetails[]>([])
  const [filteredPayments, setFilteredPayments] = useState<PaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch payments for this community
  useEffect(() => {
    fetchPayments()
  }, [communityId])

  // Filter and search payments
  useEffect(() => {
    let filtered = payments

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(p => p.status === statusFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.user.first_name.toLowerCase().includes(query) ||
        p.user.last_name.toLowerCase().includes(query) ||
        p.user.email.toLowerCase().includes(query) ||
        p.plan.name.toLowerCase().includes(query) ||
        p.bank_account.bank_name.toLowerCase().includes(query) ||
        p.bank_account.account_name.toLowerCase().includes(query)
      )
    }

    setFilteredPayments(filtered)
  }, [statusFilter, searchQuery, payments])

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_receipts')
        .select(`
          id,
          community_id,
          user_id,
          plan_id,
          billing_cycle,
          amount,
          receipt_url,
          status,
          verified_by,
          verified_at,
          rejection_reason,
          created_at,
          updated_at,
          users!payment_receipts_user_id_fkey(id, first_name, last_name, email),
          subscription_plans!payment_receipts_plan_id_fkey(id, name),
          bank_accounts!payment_receipts_bank_account_id_fkey(id, account_name, bank_name)
        `)
        .eq('community_id', communityId)
        .neq('user_id', ownerId)  // Exclude payments from the community owner (platform subscription)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Map the data to match our interface
      const mappedData = (data || []).map((payment: any) => ({
        ...payment,
        user: payment.users,
        plan: payment.subscription_plans,
        bank_account: payment.bank_accounts
      }))

      setPayments(mappedData as PaymentWithDetails[])
      setFilteredPayments(mappedData as PaymentWithDetails[])
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast.error("Failed to load payments")
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from('payment_receipts')
        .update({
          status: 'verified',
          verified_by: user?.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', paymentId)

      if (error) throw error

      toast.success("Payment verified successfully!")
      fetchPayments()
    } catch (error) {
      console.error('Error verifying payment:', error)
      toast.error("Failed to verify payment")
    }
  }

  const handleReject = async (paymentId: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }

    try {
      const { error } = await supabase
        .from('payment_receipts')
        .update({
          status: 'rejected',
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          rejection_reason: rejectionReason
        })
        .eq('id', paymentId)

      if (error) throw error

      toast.success("Payment rejected")
      fetchPayments()
      setDialogOpen(false)
      setRejectionReason("")
    } catch (error) {
      console.error('Error rejecting payment:', error)
      toast.error("Failed to reject payment")
    }
  }

  const viewReceipt = (url: string) => {
    window.open(url, '_blank')
  }

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
        <div className="fixed inset-0 z-0 overflow-hidden">
          <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.3} />
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    )
  }

  const pendingCount = payments.filter(p => p.status === 'pending').length
  const verifiedCount = payments.filter(p => p.status === 'verified').length
  const rejectedCount = payments.filter(p => p.status === 'rejected').length

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.3} />
      </div>
      
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Payment Management</h1>
            <p className="text-white/60 text-sm mt-1">Manage payments for {communityName}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <InputGroup className="bg-white/10 border-white/20 text-white">
              <InputGroupAddon>
                <Search className="h-4 w-4 text-white/60" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search by user, plan, or bank..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-white placeholder:text-white/60"
              />
            </InputGroup>
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PaymentStatus | "all")}>
            <SelectTrigger className="w-full sm:w-[200px] bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({payments.length})</SelectItem>
              <SelectItem value="pending">Pending ({pendingCount})</SelectItem>
              <SelectItem value="verified">Verified ({verifiedCount})</SelectItem>
              <SelectItem value="rejected">Rejected ({rejectedCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Payments - Cards on Mobile, Table on Desktop */}
        {filteredPayments.length === 0 ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <CreditCard className="h-12 w-12 text-white/60 mx-auto mb-4" />
            <p className="text-white/80">No payments found</p>
            <p className="text-white/60 text-sm mt-1">
              {searchQuery || statusFilter !== "all" 
                ? "No payments match your filters"
                : "No payment receipts have been submitted yet"
              }
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-4">
              {filteredPayments.map((payment) => (
                <ContextMenu key={payment.id}>
                  <ContextMenuTrigger asChild>
                    <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 cursor-context-menu">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-white text-lg">
                            {payment.user.first_name} {payment.user.last_name}
                          </h3>
                          <p className="text-white/60 text-sm">{payment.user.email}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-white/70">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => viewReceipt(payment.receipt_url)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Receipt
                            </DropdownMenuItem>
                            {payment.status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleVerify(payment.id)}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Verify Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedPayment(payment)
                                    setDialogOpen(true)
                                  }}
                                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject Payment
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Amount:</span>
                          <span className="text-white font-mono text-sm">${payment.amount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Plan:</span>
                          <span className="text-white text-sm">{payment.plan.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Bank:</span>
                          <span className="text-white text-sm">{payment.bank_account.bank_name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-sm">Status:</span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            payment.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                            payment.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {payment.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => viewReceipt(payment.receipt_url)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Receipt
                    </ContextMenuItem>
                    {payment.status === 'pending' && (
                      <>
                        <ContextMenuItem onClick={() => handleVerify(payment.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Verify Payment
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => {
                            setSelectedPayment(payment)
                            setDialogOpen(true)
                          }}
                          className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject Payment
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <ContextMenu key={payment.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="cursor-context-menu">
                          <TableCell>
                            <div>
                              <div className="font-medium">{payment.user.first_name} {payment.user.last_name}</div>
                              <div className="text-sm text-white/60">{payment.user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">${payment.amount}</TableCell>
                          <TableCell>{payment.plan.name}</TableCell>
                          <TableCell>{payment.bank_account.bank_name}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              payment.status === 'verified' ? 'bg-green-500/20 text-green-400' :
                              payment.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {payment.status}
                            </span>
                          </TableCell>
                          <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-white/70">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => viewReceipt(payment.receipt_url)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Receipt
                                </DropdownMenuItem>
                                {payment.status === 'pending' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleVerify(payment.id)}>
                                      <CheckCircle2 className="h-4 w-4 mr-2" />
                                      Verify Payment
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setSelectedPayment(payment)
                                        setDialogOpen(true)
                                      }}
                                      className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject Payment
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => viewReceipt(payment.receipt_url)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Receipt
                        </ContextMenuItem>
                        {payment.status === 'pending' && (
                          <>
                            <ContextMenuItem onClick={() => handleVerify(payment.id)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Verify Payment
                            </ContextMenuItem>
                            <ContextMenuItem 
                              onClick={() => {
                                setSelectedPayment(payment)
                                setDialogOpen(true)
                              }}
                              className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Reject Payment
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Rejection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this payment..."
                className="min-h-[100px]"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => selectedPayment && handleReject(selectedPayment.id)}
                disabled={!rejectionReason.trim()}
                className="flex-1 bg-red-500 text-white hover:bg-red-600"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Payment
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false)
                  setRejectionReason("")
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

