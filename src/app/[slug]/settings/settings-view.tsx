"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Settings, Save, Building2, Plus, Edit, Trash2, MoreVertical, Loader2, Search, DollarSign, Home, Users, MessageSquare, Shield } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { BankAccount, AccountType, CommunityPricingType } from "@/types"

interface CommunitySettingsViewProps {
  community: {
    id: string
    name: string
    slug: string
    description?: string
    owner_id: string
    plan_id: string
    is_active: boolean
    pricing_type?: string
    one_time_price?: number
    monthly_price?: number
    annual_price?: number
  }
  isOwner: boolean
}

export default function CommunitySettingsView({ community, isOwner }: CommunitySettingsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  
  // Get active tab from URL params, default to 'general'
  const activeTab = searchParams.get('tab') || 'general'
  
  // Determine active navigation tab
  const activeNavTab = pathname === `/${community.slug}/settings` ? "settings" : "home"
  
  const [isSaving, setIsSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name: community.name,
    description: community.description || '',
  })

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [filteredAccounts, setFilteredAccounts] = useState<BankAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null)
  const [isSavingAccount, setIsSavingAccount] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  const [bankFormData, setBankFormData] = useState({
    account_name: "",
    bank_name: "",
    account_number: "",
    account_type: "savings" as AccountType,
  })

  // Pricing state
  const [isSavingPricing, setIsSavingPricing] = useState(false)
  const [pricingData, setPricingData] = useState({
    pricing_type: (community.pricing_type || 'free') as CommunityPricingType,
    one_time_price: community.one_time_price || 0,
    monthly_price: community.monthly_price || 0,
    annual_price: community.annual_price || 0,
  })

  // Handle tab change
  const handleTabChange = (value: string) => {
    router.push(`/${community.slug}/settings?tab=${value}`)
  }

  // Security: Monitor auth state changes and redirect if user signs out or loses owner status
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      // If no user or user is not the owner, redirect
      if (!user || user.id !== community.owner_id) {
        router.push(`/${community.slug}`)
      }
    }

    // Check immediately
    checkAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        checkAuth()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [community.owner_id, community.slug, router])

  // Fetch bank accounts only once when mounting or when explicitly needed
  useEffect(() => {
    if (activeTab === 'bank-accounts' && isOwner && bankAccounts.length === 0) {
      fetchBankAccounts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isOwner, community.id])

  const fetchBankAccounts = async () => {
    if (loadingAccounts) return // Prevent duplicate calls
    
    setLoadingAccounts(true)
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('community_id', community.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setBankAccounts(data || [])
      setFilteredAccounts(data || [])
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
      toast.error('Failed to load bank accounts')
    } finally {
      setLoadingAccounts(false)
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
      const { error } = await supabase
        .from('communities')
        .update({
          name: formData.name,
          description: formData.description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', community.id)

      if (error) throw error

      toast.success("Community settings updated successfully!")
      router.refresh()
    } catch (error: any) {
      console.error('Error updating community:', error)
      toast.error(error.message || "Failed to update community settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingAccount(true)
    
    try {
      const dataToSubmit = {
        ...bankFormData,
        community_id: community.id,
      }

      if (editingAccount) {
        // Update existing account
        const { error } = await supabase
          .from('bank_accounts')
          .update(dataToSubmit)
          .eq('id', editingAccount.id)

        if (error) throw error
        toast.success('Bank account updated successfully')
      } else {
        // Create new account
        const { error } = await supabase
          .from('bank_accounts')
          .insert([dataToSubmit])

        if (error) throw error
        toast.success('Bank account added successfully')
      }

      // Reset form and close dialog
      setBankFormData({
        account_name: "",
        bank_name: "",
        account_number: "",
        account_type: "savings",
      })
      setEditingAccount(null)
      setDialogOpen(false)
      
      // Refresh list by calling fetch directly
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('community_id', community.id)
        .order('created_at', { ascending: false })
      
      if (!error) {
        setBankAccounts(data || [])
        setFilteredAccounts(data || [])
      }
    } catch (error: any) {
      console.error('Error saving bank account:', error)
      toast.error(error.message || 'Failed to save bank account')
    } finally {
      setIsSavingAccount(false)
    }
  }

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account)
    setBankFormData({
      account_name: account.account_name,
      bank_name: account.bank_name,
      account_number: account.account_number,
      account_type: account.account_type,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return
    
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', accountId)

      if (error) throw error
      toast.success('Bank account deleted')
      
      // Update local state directly for instant UI update
      const updatedAccounts = bankAccounts.filter(acc => acc.id !== accountId)
      setBankAccounts(updatedAccounts)
      
      // Update filtered accounts if search is active
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const filtered = updatedAccounts.filter(acc =>
          acc.account_name.toLowerCase().includes(query) ||
          acc.bank_name.toLowerCase().includes(query) ||
          acc.account_number.toLowerCase().includes(query) ||
          acc.account_type.toLowerCase().includes(query)
        )
        setFilteredAccounts(filtered)
      } else {
        setFilteredAccounts(updatedAccounts)
      }
    } catch (error: any) {
      console.error('Error deleting bank account:', error)
      toast.error(error.message || 'Failed to delete bank account')
    }
  }

  const handleToggleActive = async (account: BankAccount) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({ is_active: !account.is_active })
        .eq('id', account.id)

      if (error) throw error
      toast.success(`Account ${!account.is_active ? 'activated' : 'deactivated'}`)
      
      // Update local state directly for instant UI update
      const updatedAccounts = bankAccounts.map(acc => 
        acc.id === account.id ? { ...acc, is_active: !acc.is_active } : acc
      )
      setBankAccounts(updatedAccounts)
      
      // Update filtered accounts if search is active
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const filtered = updatedAccounts.filter(acc =>
          acc.account_name.toLowerCase().includes(query) ||
          acc.bank_name.toLowerCase().includes(query) ||
          acc.account_number.toLowerCase().includes(query) ||
          acc.account_type.toLowerCase().includes(query)
        )
        setFilteredAccounts(filtered)
      } else {
        setFilteredAccounts(updatedAccounts)
      }
    } catch (error: any) {
      console.error('Error toggling account status:', error)
      toast.error(error.message || 'Failed to update account status')
    }
  }

  const handlePricingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingPricing(true)

    try {
      const { error } = await supabase
        .from('communities')
        .update({
          ...pricingData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', community.id)

      if (error) throw error

      toast.success("Pricing settings updated successfully!")
      router.refresh()
    } catch (error: any) {
      console.error('Error updating pricing:', error)
      toast.error(error.message || "Failed to update pricing settings")
    } finally {
      setIsSavingPricing(false)
    }
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        {/* Navigation Tabs */}
        <Tabs value={activeNavTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="home" asChild>
              <Link href={`/${community.slug}`} className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </TabsTrigger>
            <TabsTrigger value="feed" asChild>
              <Link href={`/${community.slug}/feed`} className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Feed
              </Link>
            </TabsTrigger>
            <TabsTrigger value="members" asChild>
              <Link href={`/${community.slug}/members`} className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members
              </Link>
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger value="settings" asChild>
                <Link href={`/${community.slug}/settings`} className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Settings
                </Link>
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        <PageHeader
          title="Community Settings"
          subtitle="Manage your community details and configuration"
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="w-full overflow-x-auto">
            <TabsTrigger value="general" className="whitespace-nowrap snap-start">
              <Settings className="h-4 w-4 mr-2" />
              General
            </TabsTrigger>
            <TabsTrigger value="bank-accounts" className="whitespace-nowrap snap-start">
              <Building2 className="h-4 w-4 mr-2" />
              Bank Accounts
            </TabsTrigger>
            <TabsTrigger value="billing" className="whitespace-nowrap snap-start">
              <DollarSign className="h-4 w-4 mr-2" />
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h3 className="text-xl font-semibold text-white">General Information</h3>
                <p className="text-white/60 text-sm mt-1">Update your community's name and description</p>
              </div>

              <form onSubmit={handleSubmit}>
                <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
                  <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white">
                      Community Name
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      placeholder="Enter community name"
                      required
                      maxLength={100}
                      disabled={!isOwner}
                    />
                    <p className="text-white/40 text-xs">
                      {formData.name.length}/100 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-white">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[120px]"
                      placeholder="Describe your community..."
                      maxLength={500}
                      disabled={!isOwner}
                    />
                    <p className="text-white/40 text-xs">
                      {formData.description.length}/500 characters
                    </p>
                  </div>

                  {isOwner ? (
                    <Button
                      type="submit"
                      disabled={isSaving || formData.name === community.name && formData.description === (community.description || '')}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  ) : (
                    <div className="p-4 rounded-lg bg-white/5 border border-white/20">
                      <p className="text-white/60 text-sm">
                        Only community owners can edit these settings.
                      </p>
                    </div>
                  )}
                  </CardContent>
                </Card>
              </form>
            </div>
          </TabsContent>

          <TabsContent value="bank-accounts">
            {!isOwner ? (
              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
                <p className="text-white/60 text-sm">
                  Only community owners can manage bank accounts.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Bank Accounts</h3>
                    <p className="text-white/60 text-sm mt-1">Manage payment accounts for your community</p>
                  </div>
                  
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingAccount(null)
                          setBankFormData({
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
                      <form onSubmit={handleBankSubmit} className="space-y-4">
                        <div>
                          <Label htmlFor="account_name">Account Name</Label>
                          <Input
                            id="account_name"
                            value={bankFormData.account_name}
                            onChange={(e) => setBankFormData({ ...bankFormData, account_name: e.target.value })}
                            placeholder="e.g., Company Main Account"
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="bank_name">Bank Name</Label>
                          <Input
                            id="bank_name"
                            value={bankFormData.bank_name}
                            onChange={(e) => setBankFormData({ ...bankFormData, bank_name: e.target.value })}
                            placeholder="e.g., Republic Bank"
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="account_number">Account Number</Label>
                          <Input
                            id="account_number"
                            value={bankFormData.account_number}
                            onChange={(e) => setBankFormData({ ...bankFormData, account_number: e.target.value })}
                            placeholder="e.g., 123456789"
                            required
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="account_type">Account Type</Label>
                          <Select
                            value={bankFormData.account_type}
                            onValueChange={(value) => setBankFormData({ ...bankFormData, account_type: value as AccountType })}
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
                          <Button type="submit" className="flex-1" disabled={isSavingAccount}>
                            {isSavingAccount ? (
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
                {loadingAccounts ? (
                  <div className="text-center py-8">
                    <p className="text-white/60">Loading bank accounts...</p>
                  </div>
                ) : filteredAccounts.length === 0 ? (
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
            )}
          </TabsContent>

          <TabsContent value="billing">
            {!isOwner ? (
              <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
                <p className="text-white/60 text-sm">
                  Only community owners can manage billing settings.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h3 className="text-xl font-semibold text-white">Billing & Pricing</h3>
                  <p className="text-white/60 text-sm mt-1">Set up pricing for users to access your community</p>
                </div>

                <form onSubmit={handlePricingSubmit}>
                  <Card className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-0">
                    <CardContent className="pt-6 space-y-6">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <Label htmlFor="pricing_type" className="text-white">
                            Pricing Model
                          </Label>
                          <Select
                            value={pricingData.pricing_type}
                            onValueChange={(value) => setPricingData({ ...pricingData, pricing_type: value as CommunityPricingType })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select pricing type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="one_time">One-Time Payment</SelectItem>
                              <SelectItem value="recurring">Recurring Subscription</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {pricingData.pricing_type === 'one_time' && (
                          <div className="space-y-2">
                            <Label htmlFor="one_time_price" className="text-white">
                              One-Time Price ($)
                            </Label>
                            <Input
                              id="one_time_price"
                              type="number"
                              step="0.01"
                              min="0"
                              value={pricingData.one_time_price}
                              onChange={(e) => setPricingData({ ...pricingData, one_time_price: parseFloat(e.target.value) || 0 })}
                              placeholder="0.00"
                              required
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                            />
                          </div>
                        )}

                        {pricingData.pricing_type === 'recurring' && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="monthly_price" className="text-white">
                                Monthly Price ($)
                              </Label>
                              <Input
                                id="monthly_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={pricingData.monthly_price}
                                onChange={(e) => setPricingData({ ...pricingData, monthly_price: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="annual_price" className="text-white">
                                Annual Price ($)
                              </Label>
                              <Input
                                id="annual_price"
                                type="number"
                                step="0.01"
                                min="0"
                                value={pricingData.annual_price}
                                onChange={(e) => setPricingData({ ...pricingData, annual_price: parseFloat(e.target.value) || 0 })}
                                placeholder="0.00"
                                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <Button
                        type="submit"
                        disabled={isSavingPricing}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {isSavingPricing ? 'Saving...' : 'Save Pricing Settings'}
                      </Button>
                    </CardContent>
                  </Card>
                </form>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
