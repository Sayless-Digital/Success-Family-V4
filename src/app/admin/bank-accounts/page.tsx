"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Plus, Edit, Trash2, Building2, MoreVertical, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { supabase } from "@/lib/supabase"
import type { BankAccount, AccountType } from "@/types"
import { toast } from "sonner"

export default function BankAccountsPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [filteredAccounts, setFilteredAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Form state
  const [formData, setFormData] = useState({
    account_name: "",
    bank_name: "",
    account_number: "",
    account_type: "savings" as AccountType,
  })

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch bank accounts
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchBankAccounts()
    }
  }, [userProfile])

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setBankAccounts(data || [])
      setFilteredAccounts(data || [])
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter bank accounts based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredAccounts(bankAccounts)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = bankAccounts.filter(account =>
        account.account_name.toLowerCase().includes(query) ||
        account.bank_name.toLowerCase().includes(query) ||
        account.account_number.toLowerCase().includes(query) ||
        account.account_type.toLowerCase().includes(query)
      )
      setFilteredAccounts(filtered)
    }
  }, [searchQuery, bankAccounts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      if (editingAccount) {
        // Update existing account
        const { error } = await supabase
          .from('bank_accounts')
          .update(formData)
          .eq('id', editingAccount.id)

        if (error) throw error
      } else {
        // Create new account
        const { error } = await supabase
          .from('bank_accounts')
          .insert([formData])

        if (error) throw error
      }

      // Reset form and close dialog
      setFormData({
        account_name: "",
        bank_name: "",
        account_number: "",
        account_type: "savings",
      })
      setEditingAccount(null)
      setDialogOpen(false)
      
      // Refresh list
      fetchBankAccounts()
      
      // Show success toast
      toast.success(editingAccount ? 'Account updated' : 'Account created')
    } catch (error) {
      console.error('Error saving bank account:', error)
      toast.error('Failed to save account')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account)
    setFormData({
      account_name: account.account_name,
      bank_name: account.bank_name,
      account_number: account.account_number,
      account_type: account.account_type,
    })
    setDialogOpen(true)
  }

  const handleToggleActive = async (account: BankAccount) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id)

      if (error) throw error
      fetchBankAccounts()
      toast.success(`Account ${!account.is_active ? 'activated' : 'deactivated'}`)
    } catch (error) {
      console.error('Error toggling account status:', error)
      toast.error('Failed to update status')
    }
  }

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return
    
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', accountId)

      if (error) throw error
      fetchBankAccounts()
      toast.success('Account deleted')
    } catch (error) {
      console.error('Error deleting bank account:', error)
      toast.error('Failed to delete account')
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
          <Breadcrumb items={[{ label: "Bank Accounts", icon: Building2 }]} />
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingAccount(null)
                  setFormData({
                    account_name: "",
                    bank_name: "",
                    account_number: "",
                    account_type: "savings",
                  })
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Bank Account</span>
                <span className="sm:hidden">Add Account</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAccount ? 'Edit Bank Account' : 'Add New Bank Account'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="account_name">Account Name</Label>
                  <Input
                    id="account_name"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    placeholder="e.g., Company Main Account"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    placeholder="e.g., Republic Bank"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="e.g., 123456789"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="account_type">Account Type</Label>
                  <Select
                    value={formData.account_type}
                    onValueChange={(value) => setFormData({ ...formData, account_type: value as AccountType })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="savings">Savings</SelectItem>
                      <SelectItem value="checking">Checking</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={isSaving}>
                    {isSaving ? (
                      <span className="flex items-center gap-2 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{editingAccount ? 'Updating...' : 'Creating...'}</span>
                      </span>
                    ) : (
                      editingAccount ? 'Update' : 'Create'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setDialogOpen(false)
                      setEditingAccount(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <InputGroup className="bg-white/10 border-white/20 text-white">
              <InputGroupAddon>
                <Search className="h-4 w-4 text-white/60" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search bank accounts by name, bank, or account number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-white placeholder:text-white/60"
              />
            </InputGroup>
          </div>
        </div>

        {/* Bank Accounts - Cards on Mobile, Table on Desktop */}
        {filteredAccounts.length === 0 ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <Building2 className="h-12 w-12 text-white/60 mx-auto mb-4" />
            <p className="text-white/80">No bank accounts found</p>
            <p className="text-white/60 text-sm mt-1">
              {searchQuery 
                ? "No bank accounts match your search"
                : "Add your first bank account to start accepting payments"
              }
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-4">
              {filteredAccounts.map((account) => (
                <ContextMenu key={account.id}>
                  <ContextMenuTrigger asChild>
                    <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 cursor-context-menu">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-white text-lg">{account.account_name}</h3>
                          <p className="text-white/60 text-sm">{account.bank_name}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(account)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Account
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(account)}>
                              {account.is_active ? 'Deactivate' : 'Activate'} Account
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(account.id)}
                              className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Account
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Account Number:</span>
                          <span className="font-mono text-white text-sm">{account.account_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Type:</span>
                          <span className="text-white text-sm capitalize">{account.account_type}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-sm">Status:</span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              account.is_active
                                ? 'bg-white/20 text-white'
                                : 'bg-muted/20 text-muted-foreground'
                            }`}
                          >
                            {account.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleEdit(account)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Account
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleToggleActive(account)}>
                      {account.is_active ? 'Deactivate' : 'Activate'} Account
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onClick={() => handleDelete(account.id)}
                      className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Bank Name</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <ContextMenu key={account.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="cursor-context-menu">
                          <TableCell className="font-medium">{account.account_name}</TableCell>
                          <TableCell>{account.bank_name}</TableCell>
                          <TableCell className="font-mono text-sm">{account.account_number}</TableCell>
                          <TableCell className="capitalize">{account.account_type}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                account.is_active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-muted/20 text-muted-foreground'
                              }`}
                            >
                              {account.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(account)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Account
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleActive(account)}>
                                  {account.is_active ? 'Deactivate' : 'Activate'} Account
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(account.id)}
                                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Account
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleEdit(account)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Account
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleToggleActive(account)}>
                          {account.is_active ? 'Deactivate' : 'Activate'} Account
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => handleDelete(account.id)}
                          className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Account
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}