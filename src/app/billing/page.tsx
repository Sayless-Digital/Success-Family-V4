"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Receipt, Calendar, Package, DollarSign, ExternalLink, Clock, CheckCircle2, XCircle, AlertCircle, RefreshCw, Download, FileText, TrendingUp, CreditCard, ChevronRight, MoreVertical, ChevronDown } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/ui/page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { supabase } from "@/lib/supabase"
import type { PaymentReceipt, Subscription, SubscriptionStatus } from "@/types"
import { toast } from "sonner"

interface PaymentWithDetails extends PaymentReceipt {
  community: {
    name: string
    slug: string
  }
  plan: {
    name: string
  }
}

interface CommunityPayments {
  communityId: string
  communityName: string
  slug: string
  payments: PaymentWithDetails[]
  subscription?: Subscription
}

export default function BillingPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  const colorStops = useAuroraColors()
  
  const [groupedPayments, setGroupedPayments] = useState<CommunityPayments[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityPayments | null>(null)
  const [cancellationReason, setCancellationReason] = useState("")
  const [processing, setProcessing] = useState(false)
  const [expandedSubscriptions, setExpandedSubscriptions] = useState<Set<string>>(new Set())

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/')
    }
  }, [user, isLoading, router])

  // Fetch payments
  useEffect(() => {
    if (user) {
      fetchPayments()
    }
  }, [user])

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_receipts')
        .select(`
          *,
          communities!payment_receipts_community_id_fkey(name, slug),
          subscription_plans!payment_receipts_plan_id_fkey(name)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Map the data to match our interface
      const mappedData = (data || []).map((payment: any) => ({
        ...payment,
        community: payment.communities,
        plan: payment.subscription_plans
      }))

      // Get unique community IDs
      const communityIds = [...new Set(mappedData.map((p: any) => p.community_id))]

      // Fetch active subscriptions for these communities
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .in('community_id', communityIds)
        .in('status', ['active', 'cancelled'])
        .order('created_at', { ascending: false })

      if (subError) throw subError

      // Group payments by community and attach subscription
      const grouped = (mappedData as PaymentWithDetails[] || []).reduce((acc, payment) => {
        const existing = acc.find(g => g.communityId === payment.community_id)
        const subscription = (subscriptions || []).find(s => s.community_id === payment.community_id)
        
        if (existing) {
          existing.payments.push(payment)
        } else {
          acc.push({
            communityId: payment.community_id,
            communityName: payment.community.name,
            slug: payment.community.slug,
            payments: [payment],
            subscription
          })
        }
        return acc
      }, [] as CommunityPayments[])

      setGroupedPayments(grouped)
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setLoading(false)
    }
  }

  const viewReceipt = (url: string) => {
    window.open(url, '_blank')
  }

  const toggleSubscriptionExpansion = (communityId: string) => {
    setExpandedSubscriptions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(communityId)) {
        newSet.delete(communityId)
      } else {
        newSet.add(communityId)
      }
      return newSet
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-500/20 text-green-500 border-green-500/30'
      case 'rejected':
        return 'bg-red-500/20 text-red-500 border-red-500/30'
      default:
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
    }
  }

  const getSubscriptionStatusColor = (status: SubscriptionStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-500 border-green-500/30'
      case 'cancelled':
        return 'bg-orange-500/20 text-orange-500 border-orange-500/30'
      case 'expired':
        return 'bg-red-500/20 text-red-500 border-red-500/30'
      default:
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
    }
  }

  const handleCancelSubscription = async () => {
    if (!selectedCommunity?.subscription || !cancellationReason.trim()) {
      alert('Please provide a cancellation reason')
      return
    }

    setProcessing(true)
    try {
      const now = new Date()
      const endDate = new Date(selectedCommunity.subscription.next_billing_date || now)

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: now.toISOString(),
          cancellation_reason: cancellationReason,
          end_date: endDate.toISOString()
        })
        .eq('id', selectedCommunity.subscription.id)

      if (error) throw error

      // Update community status
      await supabase
        .from('communities')
        .update({
          subscription_status: 'cancelled'
        })
        .eq('id', selectedCommunity.communityId)

      await fetchPayments()
      setCancelDialogOpen(false)
      setCancellationReason("")
      setSelectedCommunity(null)
    } catch (error) {
      console.error('Error cancelling subscription:', error)
      alert('Failed to cancel subscription')
    } finally {
      setProcessing(false)
    }
  }

  const handleReactivateSubscription = async (communityId: string) => {
    setProcessing(true)
    try {
      // Update the subscription status to active
      const { error } = await supabase
        .from('subscriptions')
        .update({ 
          status: 'active',
          cancelled_at: undefined,
          cancellation_reason: undefined
        })
        .eq('community_id', communityId)

      if (error) {
        console.error('Error reactivating subscription:', error)
        toast.error('Failed to reactivate subscription. Please try again.')
        return
      }

      // Update local state to reflect the change
      setGroupedPayments(prev => 
        prev.map(group => 
          group.communityId === communityId 
            ? {
                ...group,
                subscription: group.subscription ? {
                  ...group.subscription,
                  status: 'active' as SubscriptionStatus,
                  cancelled_at: undefined,
                  cancellation_reason: undefined
                } : undefined
              }
            : group
        )
      )

      toast.success('Subscription reactivated successfully!')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to reactivate subscription. Please try again.')
    } finally {
      setProcessing(false)
    }
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

  if (!user) return null


  return (
    <div className="relative min-h-[calc(100vh-8rem)] w-full overflow-x-hidden">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      <div className="relative z-10 space-y-8">
        <PageHeader
          title="Billing & Payments"
          subtitle="Manage your community subscriptions and payment history"
        />



        {/* Payments by Community */}
        {groupedPayments.length === 0 ? (
          <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20">
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-6">
                <Receipt className="h-8 w-8 text-white/60" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Payment History</h3>
              <p className="text-white/60 mb-6 max-w-md mx-auto">
                You haven't made any payments yet. Create your first community to get started with our platform.
            </p>
            <Button
              onClick={() => router.push('/create-community')}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
                <Package className="h-4 w-4 mr-2" />
                Create Your First Community
            </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedPayments.map((group) => (
              <div key={group.communityId} className="space-y-4">
                {/* Community Header */}
                <div className="space-y-4">
                  {/* Desktop Layout */}
                  <div className="hidden md:flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
                        <Package className="h-6 w-6 text-white/70" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">{group.communityName}</h2>
                        <p className="text-white/60">
                          {group.payments.length} payment{group.payments.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {group.subscription && (
                        <Badge variant="outline" className={getSubscriptionStatusColor(group.subscription.status)}>
                            {group.subscription.status.charAt(0).toUpperCase() + group.subscription.status.slice(1)}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="admin-ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => router.push(`/${group.slug}`)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Community
                          </DropdownMenuItem>
                       {group.subscription?.status === 'active' && (
                              <DropdownMenuItem 
                           onClick={() => {
                             setSelectedCommunity(group)
                             setCancelDialogOpen(true)
                           }}
                                className="text-orange-500 focus:text-orange-500"
                         >
                           <XCircle className="h-4 w-4 mr-2" />
                           Cancel Subscription
                              </DropdownMenuItem>
                       )}
                       {group.subscription?.status === 'cancelled' && (
                              <DropdownMenuItem 
                           onClick={() => handleReactivateSubscription(group.communityId)}
                                className="text-green-500 focus:text-green-500"
                         >
                           <RefreshCw className="h-4 w-4 mr-2" />
                           Reactivate
                              </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div className="block md:hidden space-y-3">
                    {/* Community Name and Icon */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-white/70" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold text-white truncate">{group.communityName}</h2>
                        <p className="text-white/60 text-sm">
                          {group.payments.length} payment{group.payments.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    
                    {/* Status Badge and Actions */}
                    <div className="flex items-center justify-between">
                      {group.subscription && (
                        <Badge variant="outline" className={getSubscriptionStatusColor(group.subscription.status)}>
                            {group.subscription.status.charAt(0).toUpperCase() + group.subscription.status.slice(1)}
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="admin-ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => router.push(`/${group.slug}`)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Community
                          </DropdownMenuItem>
                         {group.subscription?.status === 'active' && (
                                <DropdownMenuItem 
                             onClick={() => {
                               setSelectedCommunity(group)
                               setCancelDialogOpen(true)
                             }}
                                  className="text-orange-500 focus:text-orange-500"
                           >
                             <XCircle className="h-4 w-4 mr-2" />
                             Cancel Subscription
                                </DropdownMenuItem>
                         )}
                         {group.subscription?.status === 'cancelled' && (
                                <DropdownMenuItem 
                             onClick={() => handleReactivateSubscription(group.communityId)}
                                  className="text-green-500 focus:text-green-500"
                           >
                             <RefreshCw className="h-4 w-4 mr-2" />
                             Reactivate
                                </DropdownMenuItem>
                              )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Cards */}
                <div className="block md:hidden">
                  {/* Latest Payment */}
                  <ContextMenu key={group.payments[0].id}>
                    <ContextMenuTrigger asChild>
                      <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-6 cursor-context-menu">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3">
                              {getStatusIcon(group.payments[0].status)}
                              <Badge variant="outline" className={getStatusColor(group.payments[0].status)}>
                                {group.payments[0].status.charAt(0).toUpperCase() + group.payments[0].status.slice(1)}
                              </Badge>
                              <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10">Latest</Badge>
                            </div>
                            <div className="text-2xl font-bold text-white mb-4">
                              TTD ${group.payments[0].amount.toFixed(2)}
                            </div>
                            </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="admin-ghost" size="icon" className="shrink-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => viewReceipt(group.payments[0].receipt_url)}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Receipt
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                            </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-white/60 text-sm">Plan:</span>
                            <span className="text-white text-sm font-medium">{group.payments[0].plan.name}</span>
                              </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/60 text-sm">Billing Cycle:</span>
                            <span className="text-white text-sm font-medium capitalize">{group.payments[0].billing_cycle}</span>
                            </div>
                          <div className="flex justify-between items-center">
                            <span className="text-white/60 text-sm">Payment Date:</span>
                            <span className="text-white text-sm font-medium">
                              {new Date(group.payments[0].created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {group.payments[0].status === 'verified' && group.payments[0].verified_at && (
                            <div className="mt-3 p-3 rounded-md bg-green-500/10 border border-green-500/30">
                              <p className="text-xs text-green-400">
                                <span className="font-medium">Verified:</span> {new Date(group.payments[0].verified_at).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                          {group.payments[0].status === 'rejected' && group.payments[0].rejection_reason && (
                            <div className="mt-3 p-3 rounded-md bg-red-500/10 border border-red-500/30">
                              <p className="text-xs text-red-400">
                                <span className="font-medium">Rejected:</span> {group.payments[0].rejection_reason}
                              </p>
                            </div>
                          )}
                          {group.payments[0].status === 'pending' && (
                            <div className="mt-3 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                              <p className="text-xs text-yellow-400">
                                Payment verification in progress (24-48 hours)
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => viewReceipt(group.payments[0].receipt_url)}>
                        <FileText className="h-4 w-4 mr-2" />
                        View Receipt
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>

                  {/* Expand/Collapse Button */}
                  {group.payments.length > 1 && (
                    <div className="flex justify-center mt-4">
                        <Button
                        variant="outline"
                        onClick={() => toggleSubscriptionExpansion(group.communityId)}
                        className="text-white border-white/20 hover:bg-white/10 px-6 py-2"
                      >
                        {expandedSubscriptions.has(group.communityId) ? (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2 rotate-180" />
                            Hide {group.payments.length - 1} Older Payment{group.payments.length - 1 !== 1 ? 's' : ''}
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Show {group.payments.length - 1} Older Payment{group.payments.length - 1 !== 1 ? 's' : ''}
                          </>
                        )}
                        </Button>
                      </div>
                  )}

                  {/* Older Payments */}
                  {expandedSubscriptions.has(group.communityId) && (
                    <div className="mt-4 space-y-4">
                      {group.payments.slice(1).map((payment) => (
                        <ContextMenu key={payment.id}>
                          <ContextMenuTrigger asChild>
                            <div className="rounded-lg bg-gradient-to-br from-white/5 to-transparent backdrop-blur-md p-6 cursor-context-menu border border-white/10">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-3">
                                    {getStatusIcon(payment.status)}
                                    <Badge variant="outline" className={getStatusColor(payment.status)}>
                                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                    </Badge>
                                  </div>
                                  <div className="text-2xl font-bold text-white mb-4">
                                    TTD ${payment.amount.toFixed(2)}
                                  </div>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="admin-ghost" size="icon" className="shrink-0">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => viewReceipt(payment.receipt_url)}>
                                      <FileText className="h-4 w-4 mr-2" />
                                      View Receipt
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-white/60 text-sm">Plan:</span>
                                  <span className="text-white text-sm font-medium">{payment.plan.name}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-white/60 text-sm">Billing Cycle:</span>
                                  <span className="text-white text-sm font-medium capitalize">{payment.billing_cycle}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-white/60 text-sm">Payment Date:</span>
                                  <span className="text-white text-sm font-medium">
                                    {new Date(payment.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                                {payment.status === 'verified' && payment.verified_at && (
                                  <div className="mt-3 p-3 rounded-md bg-green-500/10 border border-green-500/30">
                                    <p className="text-xs text-green-400">
                                      <span className="font-medium">Verified:</span> {new Date(payment.verified_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                )}
                                {payment.status === 'rejected' && payment.rejection_reason && (
                                  <div className="mt-3 p-3 rounded-md bg-red-500/10 border border-red-500/30">
                                    <p className="text-xs text-red-400">
                                      <span className="font-medium">Rejected:</span> {payment.rejection_reason}
                                    </p>
                                  </div>
                                )}
                                {payment.status === 'pending' && (
                                  <div className="mt-3 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                                    <p className="text-xs text-yellow-400">
                                      Payment verification in progress (24-48 hours)
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => viewReceipt(payment.receipt_url)}>
                              <FileText className="h-4 w-4 mr-2" />
                              View Receipt
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Billing Cycle</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Latest Payment */}
                      <ContextMenu key={group.payments[0].id}>
                        <ContextMenuTrigger asChild>
                          <TableRow className="cursor-context-menu">
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {group.payments[0].plan.name}
                                <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10">Latest</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">TTD ${group.payments[0].amount.toFixed(2)}</TableCell>
                            <TableCell className="capitalize">{group.payments[0].billing_cycle}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getStatusIcon(group.payments[0].status)}
                                <Badge variant="outline" className={getStatusColor(group.payments[0].status)}>
                                  {group.payments[0].status.charAt(0).toUpperCase() + group.payments[0].status.slice(1)}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>{new Date(group.payments[0].created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="admin-ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => viewReceipt(group.payments[0].receipt_url)}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    View Receipt
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onClick={() => viewReceipt(group.payments[0].receipt_url)}>
                            <FileText className="h-4 w-4 mr-2" />
                            View Receipt
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>

                      {/* Expand/Collapse Button Row */}
                      {group.payments.length > 1 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            <Button
                              variant="outline"
                              onClick={() => toggleSubscriptionExpansion(group.communityId)}
                              className="text-white border-white/20 hover:bg-white/10"
                            >
                              {expandedSubscriptions.has(group.communityId) ? (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-2 rotate-180" />
                                  Hide {group.payments.length - 1} Older Payment{group.payments.length - 1 !== 1 ? 's' : ''}
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-2" />
                                  Show {group.payments.length - 1} Older Payment{group.payments.length - 1 !== 1 ? 's' : ''}
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Older Payments */}
                      {expandedSubscriptions.has(group.communityId) && group.payments.slice(1).map((payment) => (
                        <ContextMenu key={payment.id}>
                          <ContextMenuTrigger asChild>
                            <TableRow className="cursor-context-menu">
                              <TableCell className="font-medium">{payment.plan.name}</TableCell>
                              <TableCell className="font-semibold">TTD ${payment.amount.toFixed(2)}</TableCell>
                              <TableCell className="capitalize">{payment.billing_cycle}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(payment.status)}
                                  <Badge variant="outline" className={getStatusColor(payment.status)}>
                                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>{new Date(payment.created_at).toLocaleDateString()}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="admin-ghost" size="icon">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => viewReceipt(payment.receipt_url)}>
                                      <FileText className="h-4 w-4 mr-2" />
                                      View Receipt
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => viewReceipt(payment.receipt_url)}>
                              <FileText className="h-4 w-4 mr-2" />
                              View Receipt
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cancel Subscription Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">Cancel Subscription</DialogTitle>
            <DialogDescription className="text-white/70">
              Your subscription will remain active until {selectedCommunity?.subscription?.next_billing_date ? new Date(selectedCommunity.subscription.next_billing_date).toLocaleDateString() : 'the end of your billing period'}. You won't be charged for the next period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <Label htmlFor="cancel-reason" className="text-white font-medium">Reason for Cancellation *</Label>
              <textarea
                id="cancel-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Please tell us why you're cancelling..."
                className="w-full min-h-[100px] rounded-md border border-white/20 bg-white/10 backdrop-blur-md px-3 py-2 text-white placeholder:text-white/50 mt-2 focus:border-white/40 focus:ring-1 focus:ring-inset"
                rows={4}
              />
            </div>
            
            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-400">
                  <p className="font-semibold mb-2">Important Information:</p>
                  <ul className="list-disc list-inside space-y-1 text-orange-400/80">
                    <li>Your community will remain active until the end of the current billing period</li>
                    <li>You will not be charged for future billing periods</li>
                    <li>You can reactivate your subscription anytime by submitting a new payment</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={handleCancelSubscription}
                variant="destructive"
                className="flex-1"
                disabled={processing || !cancellationReason.trim()}
              >
                {processing ? 'Cancelling...' : 'Cancel Subscription'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false)
                  setCancellationReason("")
                  setSelectedCommunity(null)
                }}
                disabled={processing}
                className="text-white border-white/20 hover:bg-white/10"
              >
                Keep Subscription
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}