"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Plus, MoreVertical, Loader2, Search, Wallet, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import type { PlatformWithdrawal, BankAccount } from "@/types"
import { toast } from "sonner"

export default function WithdrawalsPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  
  const [withdrawals, setWithdrawals] = useState<PlatformWithdrawal[]>([])
  const [filteredWithdrawals, setFilteredWithdrawals] = useState<PlatformWithdrawal[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  
  // Form state
  const [formData, setFormData] = useState({
    bank_account_id: "",
    amount_ttd: "",
    notes: "",
  })

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch withdrawals and bank accounts
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchWithdrawals()
      fetchBankAccounts()
    }
  }, [userProfile])

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_withdrawals')
        .select(`
          *,
          bank_account:bank_accounts(*),
          requested_by_user:users!requested_by(id, username, first_name, last_name),
          processed_by_user:users!processed_by(id, username, first_name, last_name)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        // If table doesn't exist yet, show empty state
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          setWithdrawals([])
          setFilteredWithdrawals([])
          return
        }
        throw error
      }
      
      setWithdrawals((data || []) as PlatformWithdrawal[])
      setFilteredWithdrawals((data || []) as PlatformWithdrawal[])
    } catch (error: any) {
      console.error('Error fetching withdrawals:', error)
      if (error.code !== 'PGRST116') {
        toast.error('Failed to load withdrawals')
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('is_active', true)
        .is('community_id', null) // Platform accounts only
        .order('account_name', { ascending: true })

      if (error) throw error
      setBankAccounts(data || [])
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
    }
  }

  // Filter withdrawals
  useEffect(() => {
    let filtered = withdrawals

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(w => w.status === statusFilter)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(w =>
        w.bank_account?.account_name.toLowerCase().includes(query) ||
        w.bank_account?.bank_name.toLowerCase().includes(query) ||
        w.amount_ttd.toString().includes(query) ||
        w.status.toLowerCase().includes(query)
      )
    }

    setFilteredWithdrawals(filtered)
  }, [searchQuery, statusFilter, withdrawals])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setIsSaving(true)
    
    try {
      const amount = parseFloat(formData.amount_ttd)
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount')
        return
      }

      if (!formData.bank_account_id) {
        toast.error('Please select a bank account')
        return
      }

      const { error } = await supabase
        .from('platform_withdrawals')
        .insert([{
          bank_account_id: formData.bank_account_id,
          amount_ttd: amount,
          notes: formData.notes || null,
          requested_by: user.id,
          status: 'pending',
        }])

      if (error) throw error

      // Reset form and close dialog
      setFormData({
        bank_account_id: "",
        amount_ttd: "",
        notes: "",
      })
      setDialogOpen(false)
      
      // Refresh list
      await fetchWithdrawals()
      
      toast.success('Withdrawal request created')
    } catch (error: any) {
      console.error('Error creating withdrawal:', error)
      toast.error(error?.message || 'Failed to create withdrawal')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusUpdate = async (withdrawalId: string, newStatus: PlatformWithdrawal['status']) => {
    if (!user) return

    try {
      const updateData: any = {
        status: newStatus,
      }

      if (newStatus === 'processing' || newStatus === 'completed') {
        updateData.processed_by = user.id
        if (newStatus === 'completed') {
          updateData.processed_at = new Date().toISOString()
        }
      }

      const { error } = await supabase
        .from('platform_withdrawals')
        .update(updateData)
        .eq('id', withdrawalId)

      if (error) throw error

      await fetchWithdrawals()
      toast.success(`Withdrawal status updated to ${newStatus}`)
    } catch (error: any) {
      console.error('Error updating withdrawal status:', error)
      toast.error('Failed to update withdrawal status')
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-TT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-400'
      case 'processing':
        return 'bg-blue-500/20 text-blue-400'
      case 'completed':
        return 'bg-green-500/20 text-green-400'
      case 'cancelled':
        return 'bg-gray-500/20 text-gray-400'
      case 'failed':
        return 'bg-red-500/20 text-red-400'
      default:
        return 'bg-white/20 text-white'
    }
  }

  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Breadcrumb items={[{ label: "Withdrawals", icon: Wallet }]} />
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setFormData({
                    bank_account_id: "",
                    amount_ttd: "",
                    notes: "",
                  })
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Request Withdrawal</span>
                <span className="sm:hidden">Request</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Withdrawal</DialogTitle>
                <DialogDescription>
                  Create a withdrawal request from a platform bank account.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="bank_account_id">Bank Account</Label>
                  <Select
                    value={formData.bank_account_id}
                    onValueChange={(value) => setFormData({ ...formData, bank_account_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.account_name} - {account.bank_name} ({account.account_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="amount_ttd">Amount (TTD)</Label>
                  <Input
                    id="amount_ttd"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount_ttd}
                    onChange={(e) => setFormData({ ...formData, amount_ttd: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this withdrawal..."
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={isSaving}>
                    {isSaving ? (
                      <span className="flex items-center gap-2 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Creating...</span>
                      </span>
                    ) : (
                      'Create Request'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <InputGroup className="bg-white/10 border-white/20 text-white">
              <InputGroupAddon>
                <Search className="h-4 w-4 text-white/60" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search withdrawals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-white placeholder:text-white/60"
              />
            </InputGroup>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Withdrawals List */}
        {loading ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/60 mx-auto mb-4" />
            <p className="text-white/80">Loading withdrawals...</p>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <Wallet className="h-12 w-12 text-white/60 mx-auto mb-4" />
            <p className="text-white/80">No withdrawals found</p>
            <p className="text-white/60 text-sm mt-1">
              {searchQuery || statusFilter !== 'all'
                ? "No withdrawals match your filters"
                : "Create your first withdrawal request to get started"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead>Processed At</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWithdrawals.map((withdrawal) => (
                  <ContextMenu key={withdrawal.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow className="cursor-context-menu">
                        <TableCell>
                          <div>
                            <p className="font-medium text-white">
                              {withdrawal.bank_account?.account_name || 'Unknown'}
                            </p>
                            <p className="text-sm text-white/60">
                              {withdrawal.bank_account?.bank_name} - {withdrawal.bank_account?.account_number}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-white">
                          {formatCurrency(withdrawal.amount_ttd)}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(withdrawal.status)}`}>
                            {withdrawal.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-white/80">
                          {withdrawal.requested_by_user
                            ? `${withdrawal.requested_by_user.first_name} ${withdrawal.requested_by_user.last_name}`
                            : 'Unknown'}
                        </TableCell>
                        <TableCell className="text-white/80 text-sm">
                          {formatDate(withdrawal.requested_at)}
                        </TableCell>
                        <TableCell className="text-white/80 text-sm">
                          {withdrawal.processed_at ? formatDate(withdrawal.processed_at) : '—'}
                        </TableCell>
                        <TableCell className="text-white/80 text-sm max-w-xs truncate">
                          {withdrawal.notes || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {withdrawal.status === 'pending' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusUpdate(withdrawal.id, 'processing')}
                                  >
                                    Mark as Processing
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusUpdate(withdrawal.id, 'cancelled')}
                                  >
                                    Cancel
                                  </DropdownMenuItem>
                                </>
                              )}
                              {withdrawal.status === 'processing' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusUpdate(withdrawal.id, 'completed')}
                                  >
                                    Mark as Completed
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleStatusUpdate(withdrawal.id, 'failed')}
                                    className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                  >
                                    Mark as Failed
                                  </DropdownMenuItem>
                                </>
                              )}
                              {(withdrawal.status === 'pending' || withdrawal.status === 'processing') && (
                                <DropdownMenuItem
                                  onClick={() => handleStatusUpdate(withdrawal.id, 'cancelled')}
                                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                >
                                  Cancel
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      {withdrawal.status === 'pending' && (
                        <>
                          <ContextMenuItem
                            onClick={() => handleStatusUpdate(withdrawal.id, 'processing')}
                          >
                            Mark as Processing
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleStatusUpdate(withdrawal.id, 'cancelled')}
                          >
                            Cancel
                          </ContextMenuItem>
                        </>
                      )}
                      {withdrawal.status === 'processing' && (
                        <>
                          <ContextMenuItem
                            onClick={() => handleStatusUpdate(withdrawal.id, 'completed')}
                          >
                            Mark as Completed
                          </ContextMenuItem>
                          <ContextMenuItem
                            onClick={() => handleStatusUpdate(withdrawal.id, 'failed')}
                            className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                          >
                            Mark as Failed
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

