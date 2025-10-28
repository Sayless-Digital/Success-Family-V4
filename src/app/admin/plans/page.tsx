"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Plus, Edit, Trash2, Package, MoreVertical, Loader2, Search } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import type { SubscriptionPlan } from "@/types"

export default function PlansPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  const colorStops = useAuroraColors()
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [filteredPlans, setFilteredPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    monthly_price: 0,
    annual_price: 0,
    tags: [] as string[],
    sort_order: 0,
  })
  const [tagInput, setTagInput] = useState("")

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch plans
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchPlans()
    }
  }, [userProfile])

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      setPlans(data || [])
      setFilteredPlans(data || [])
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter plans based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPlans(plans)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = plans.filter(plan =>
        plan.name.toLowerCase().includes(query) ||
        plan.description?.toLowerCase().includes(query) ||
        plan.tags?.some(tag => tag.toLowerCase().includes(query))
      )
      setFilteredPlans(filtered)
    }
  }, [searchQuery, plans])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      if (editingPlan) {
        // Update existing plan
        const { error } = await supabase
          .from('subscription_plans')
          .update(formData)
          .eq('id', editingPlan.id)

        if (error) throw error
        toast.success("Plan updated successfully!")
      } else {
        // Create new plan
        const { error } = await supabase
          .from('subscription_plans')
          .insert([formData])

        if (error) throw error
        toast.success("Plan created successfully!")
      }

      // Reset form and close dialog
      setFormData({
        name: "",
        description: "",
        monthly_price: 0,
        annual_price: 0,
        tags: [],
        sort_order: 0,
      })
      setTagInput("")
      setEditingPlan(null)
      setDialogOpen(false)
      
      // Refresh list
      fetchPlans()
    } catch (error) {
      console.error('Error saving plan:', error)
      toast.error("Failed to save plan")
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description || "",
      monthly_price: plan.monthly_price,
      annual_price: plan.annual_price,
      tags: plan.tags || [],
      sort_order: plan.sort_order || 0,
    })
    setTagInput("")
    setDialogOpen(true)
  }

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id)

      if (error) throw error
      toast.success(`Plan ${!plan.is_active ? 'activated' : 'deactivated'} successfully!`)
      fetchPlans()
    } catch (error) {
      console.error('Error toggling plan status:', error)
      toast.error("Failed to update plan status")
    }
  }

  const handleDelete = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This may affect existing communities.')) return
    
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planId)

      if (error) throw error
      toast.success("Plan deleted successfully!")
      fetchPlans()
    } catch (error) {
      console.error('Error deleting plan:', error)
      toast.error("Failed to delete plan")
    }
  }


  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.3} />
      </div>
      
      <div className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Breadcrumb items={[{ label: "Subscription Plans", icon: Package }]} />
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingPlan(null)
                  setFormData({
                    name: "",
                    description: "",
                    monthly_price: 0,
                    annual_price: 0,
                    tags: [],
                    sort_order: 0,
                  })
                  setTagInput("")
                }}
                className="w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPlan ? 'Edit Subscription Plan' : 'Add New Subscription Plan'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Plan Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Starter, Professional, Enterprise"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the plan"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="monthly_price">Monthly Price (TTD)</Label>
                    <Input
                      id="monthly_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthly_price}
                      onChange={(e) => setFormData({ ...formData, monthly_price: parseFloat(e.target.value) })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="annual_price">Annual Price (TTD)</Label>
                    <Input
                      id="annual_price"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.annual_price}
                      onChange={(e) => setFormData({ ...formData, annual_price: parseFloat(e.target.value) })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="sort_order">Display Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    min="0"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first</p>
                </div>
                
                <div>
                  <Label htmlFor="tags">Tags</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        id="tags"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
                              setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] })
                              setTagInput("")
                            }
                          }
                        }}
                        placeholder="Add a tag (press Enter)"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
                            setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] })
                            setTagInput("")
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/20 text-primary text-sm"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  tags: formData.tags.filter((_, i) => i !== index)
                                })
                              }}
                              className="hover:text-primary/80 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Organize plans with tags (e.g., Featured, Popular)</p>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1" disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {editingPlan ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingPlan ? 'Update' : 'Create'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setDialogOpen(false)
                      setEditingPlan(null)
                    }}
                    disabled={isSaving}
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
                placeholder="Search plans by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-white placeholder:text-white/60"
              />
            </InputGroup>
          </div>
        </div>

        {/* Plans - Cards on Mobile, Table on Desktop */}
        {filteredPlans.length === 0 ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <Package className="h-12 w-12 text-white/60 mx-auto mb-4" />
            <p className="text-white/80">No subscription plans found</p>
            <p className="text-white/60 text-sm mt-1">
              {searchQuery 
                ? "No plans match your search"
                : "Create your first plan to allow community creation"
              }
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="block md:hidden space-y-4">
              {filteredPlans.map((plan) => (
                <ContextMenu key={plan.id}>
                  <ContextMenuTrigger asChild>
                    <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 cursor-context-menu">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-white text-lg">{plan.name}</h3>
                          {plan.description && (
                            <p className="text-white/60 text-sm">{plan.description}</p>
                          )}
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
                            <DropdownMenuItem onClick={() => handleEdit(plan)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(plan)}>
                              {plan.is_active ? 'Deactivate' : 'Activate'} Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(plan.id)}
                              className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Plan
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Monthly Price:</span>
                          <span className="text-white text-sm">TTD ${plan.monthly_price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/60 text-sm">Annual Price:</span>
                          <span className="text-white text-sm">TTD ${plan.annual_price.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-white/60 text-sm">Status:</span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              plan.is_active
                                ? 'bg-white/20 text-white'
                                : 'bg-muted/20 text-muted-foreground'
                            }`}
                          >
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => handleEdit(plan)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Plan
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => handleToggleActive(plan)}>
                      {plan.is_active ? 'Deactivate' : 'Activate'} Plan
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onClick={() => handleDelete(plan.id)}
                      className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Plan
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
                    <TableHead>Plan Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Monthly Price</TableHead>
                    <TableHead>Annual Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <ContextMenu key={plan.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="cursor-context-menu">
                          <TableCell className="font-medium">{plan.name}</TableCell>
                          <TableCell>{plan.description || '-'}</TableCell>
                          <TableCell>TTD ${plan.monthly_price.toFixed(2)}</TableCell>
                          <TableCell>TTD ${plan.annual_price.toFixed(2)}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                plan.is_active
                                  ? 'bg-white/20 text-white'
                                  : 'bg-muted/20 text-muted-foreground'
                              }`}
                            >
                              {plan.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </TableCell>
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
                                <DropdownMenuItem onClick={() => handleEdit(plan)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Plan
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleActive(plan)}>
                                  {plan.is_active ? 'Deactivate' : 'Activate'} Plan
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(plan.id)}
                                  className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Plan
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleEdit(plan)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Plan
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleToggleActive(plan)}>
                          {plan.is_active ? 'Deactivate' : 'Activate'} Plan
                        </ContextMenuItem>
                        <ContextMenuItem 
                          onClick={() => handleDelete(plan.id)}
                          className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Plan
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