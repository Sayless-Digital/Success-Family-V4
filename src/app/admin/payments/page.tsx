"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Eye, Search, MoreVertical, CreditCard } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { supabase } from "@/lib/supabase"
import type { PaymentReceipt, PaymentStatus } from "@/types"

interface PaymentWithDetails extends PaymentReceipt {
  community: {
    name: string
    slug: string
  }
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

export default function PaymentsPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  const colorStops = useAuroraColors()
  
  const [payments, setPayments] = useState<PaymentWithDetails[]>([])
  const [filteredPayments, setFilteredPayments] = useState<PaymentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState<PaymentWithDetails | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch payments
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchPayments()
    }
  }, [userProfile])

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
        p.community.name.toLowerCase().includes(query) ||
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
          *,
          communities!payment_receipts_community_id_fkey(name, slug),
          users!payment_receipts_user_id_fkey(first_name, last_name, email),
          subscription_plans!payment_receipts_plan_id_fkey(name),
          bank_accounts!payment_receipts_bank_account_id_fkey(account_name, bank_name)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error:', error)
        throw error
      }

      // Map the data to match our interface
      const mappedData = (data || []).map((payment: any) => ({
        ...payment,
        community: payment.communities,
        user: payment.users,
        plan: payment.subscription_plans,
        bank_account: payment.bank_accounts
      }))

      setPayments(mappedData as PaymentWithDetails[] || [])
      setFilteredPayments(mappedData as PaymentWithDetails[] || [])
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (paymentId: string) => {
    try {
      const payment = payments.find(p => p.id === paymentId)
      if (!payment) throw new Error('Payment not found')

      const now = new Date()
      const startDate = now.toISOString()
      
      // Calculate next billing date based on billing cycle
      const nextBillingDate = new Date(now)
      if (payment.billing_cycle === 'monthly') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
      } else {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1)
      }

      // Update the existing pending subscription to active
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          start_date: startDate,
          next_billing_date: nextBillingDate.toISOString()
        })
        .eq('community_id', payment.community_id)
        .eq('status', 'pending')

      if (subscriptionError) throw subscriptionError

      // Update payment receipt and mark as verified
      const { error: paymentError } = await supabase
        .from('payment_receipts')
        .update({
          status: 'verified',
          verified_by: user?.id,
          verified_at: now.toISOString(),
          rejection_reason: null
        })
        .eq('id', paymentId)

      if (paymentError) throw paymentError

      // Activate the community
      await supabase
        .from('communities')
        .update({
          is_active: true,
          subscription_status: 'active',
          subscription_start_date: startDate,
          next_billing_date: nextBillingDate.toISOString()
        })
        .eq('id', payment.community_id)

      fetchPayments()
      setDialogOpen(false)
    } catch (error) {
      console.error('Error verifying payment:', error)
      alert('Failed to verify payment')
    }
  }

  const handleReject = async (paymentId: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason')
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

      fetchPayments()
      setDialogOpen(false)
      setRejectionReason("")
    } catch (error) {
      console.error('Error rejecting payment:', error)
      alert('Failed to reject payment')
    }
  }

  const viewReceipt = (url: string) => {
    window.open(url, '_blank')
  }

  if (isLoading || loading) {
    return (
      <div className="relative min-h-[calc(100vh-8rem)] w-full overflow-x-hidden">
        <div className="fixed inset-0 z-0 overflow-hidden">
          <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.3} />
        </div>
        <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    )
  }

  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  const pendingCount = payments.filter(p => p.status === 'pending').length
  const verifiedCount = payments.filter(p => p.status === 'verified').length
  const rejectedCount = payments.filter(p => p.status === 'rejected').length

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Breadcrumb items={[{ label: "Payment Verification", icon: CreditCard }]} />
        </div>


        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <InputGroup className="bg-white/10 border-white/20 text-white">
              <InputGroupAddon>
                <Search className="h-4 w-4 text-white/60" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search payments by community, user, plan, or bank..."
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
              <SelectItem value="all">All Payments ({payments.length})</SelectItem>
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
                ? "No payment receipts match your current search or filter"
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
                          <h3 className="font-medium text-white text-lg">{payment.community.name}</h3>
                          <p className="text-white/60 text-sm">
                            {payment.user.first_name} {payment.user.last_name} ({payment.user.email})
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="admin-ghost"
                              size="icon"
                            >
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
                          <span className="text-white/60 text-sm">Plan:</span>
                          <span className="text-white text-sm">{payment.plan.name} ({payment.billing_cycle})</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Amount:</span>
                          <span className="text-white text-sm">TTD ${payment.amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Bank:</span>
                          <span className="text-white text-sm">{payment.bank_account.bank_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Submitted:</span>
                          <span className="text-white text-sm">
                            {new Date(payment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-sm">Status:</span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              payment.status === 'pending'
                                ? 'bg-yellow-500/20 text-yellow-500'
                                : payment.status === 'verified'
                                ? 'bg-green-500/20 text-green-500'
                                : 'bg-red-500/20 text-red-500'
                            }`}
                          >
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </span>
                        </div>
                        {payment.rejection_reason && (
                          <div className="mt-2 p-2 rounded-md bg-red-500/10 border border-red-500/30">
                            <p className="text-xs text-red-400">
                              <span className="font-medium">Rejection Reason:</span> {payment.rejection_reason}
                            </p>
                          </div>
                        )}
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
                    <TableHead>Community</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <ContextMenu key={payment.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="cursor-context-menu">
                          <TableCell className="font-medium">{payment.community.name}</TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm">{payment.user.first_name} {payment.user.last_name}</div>
                              <div className="text-xs text-muted-foreground">{payment.user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>{payment.plan.name} ({payment.billing_cycle})</TableCell>
                          <TableCell>TTD ${payment.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="text-sm">{payment.bank_account.bank_name}</div>
                              <div className="text-xs text-muted-foreground">{payment.bank_account.account_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                payment.status === 'pending'
                                  ? 'bg-yellow-500/20 text-yellow-500'
                                  : payment.status === 'verified'
                                  ? 'bg-green-500/20 text-green-500'
                                  : 'bg-red-500/20 text-red-500'
                              }`}
                            >
                              {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="admin-ghost"
                                  size="icon"
                                >
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
        <DialogContent className="bg-background border-border">
          <DialogHeader>
            <DialogTitle>Reject Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Rejection Reason *</Label>
              <textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this payment..."
                className="w-full min-h-[100px] rounded-md border border-border bg-background px-3 py-2 text-foreground"
                rows={4}
              />
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => selectedPayment && handleReject(selectedPayment.id)}
                variant="destructive"
                className="flex-1"
              >
                Reject Payment
              </Button>
              <Button
                type="button"
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