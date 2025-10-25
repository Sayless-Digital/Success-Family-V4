"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { useRouter } from "next/navigation"
import { Plus, Edit, Trash2, Package } from "lucide-react"
import Aurora from "@/components/Aurora"
import { useAuroraColors } from "@/lib/use-aurora-colors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { supabase } from "@/lib/supabase"
import type { SubscriptionPlan } from "@/types"

export default function PlansPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  const colorStops = useAuroraColors()
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    max_tree: 1,
    monthly_price: 0,
    annual_price: 0,
  })

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
        .order('monthly_price', { ascending: true })

      if (error) throw error
      setPlans(data || [])
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editingPlan) {
        // Update existing plan
        const { error } = await supabase
          .from('subscription_plans')
          .update(formData)
          .eq('id', editingPlan.id)

        if (error) throw error
      } else {
        // Create new plan
        const { error } = await supabase
          .from('subscription_plans')
          .insert([formData])

        if (error) throw error
      }

      // Reset form and close dialog
      setFormData({
        name: "",
        description: "",
        max_tree: 1,
        monthly_price: 0,
        annual_price: 0,
      })
      setEditingPlan(null)
      setDialogOpen(false)
      
      // Refresh list
      fetchPlans()
    } catch (error) {
      console.error('Error saving plan:', error)
    }
  }

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan)
    setFormData({
      name: plan.name,
      description: plan.description || "",
      max_tree: plan.max_tree,
      monthly_price: plan.monthly_price,
      annual_price: plan.annual_price,
    })
    setDialogOpen(true)
  }

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id)

      if (error) throw error
      fetchPlans()
    } catch (error) {
      console.error('Error toggling plan status:', error)
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
      fetchPlans()
    } catch (error) {
      console.error('Error deleting plan:', error)
    }
  }


  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full overflow-x-hidden pt-4">
      <div className="fixed inset-0 z-0 overflow-hidden">
        <Aurora colorStops={colorStops} amplitude={1.5} blend={0.6} speed={0.8} />
      </div>
      
      <div className="relative z-10 space-y-6 px-4 sm:px-6 lg:px-8">
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
                    max_tree: 1,
                    monthly_price: 0,
                    annual_price: 0,
                  })
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
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
                
                <div>
                  <Label htmlFor="max_tree">Maximum Tree Size</Label>
                  <Input
                    id="max_tree"
                    type="number"
                    min="1"
                    value={formData.max_tree}
                    onChange={(e) => setFormData({ ...formData, max_tree: parseInt(e.target.value) })}
                    placeholder="e.g., 100"
                    required
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Maximum number of members in the community tree
                  </p>
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
                
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingPlan ? 'Update' : 'Create'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setDialogOpen(false)
                      setEditingPlan(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Plans List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {plans.length === 0 ? (
            <div className="col-span-full rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-8 sm:p-12 text-center">
              <Package className="h-10 w-10 sm:h-12 sm:w-12 text-white/60 mx-auto mb-4" />
              <p className="text-white/80 text-sm sm:text-base">No subscription plans yet</p>
              <p className="text-white/60 text-xs sm:text-sm mt-1">
                Create your first plan to allow community creation
              </p>
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4 sm:p-6"
              >
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-white/20 flex items-center justify-center">
                    <Package className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <div className="flex gap-1 sm:gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(plan)}
                      className="text-white hover:bg-white/10 h-7 w-7 sm:h-8 sm:w-8"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(plan.id)}
                      className="text-destructive hover:bg-destructive/10 h-7 w-7 sm:h-8 sm:w-8"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">{plan.name}</h3>
                {plan.description && (
                  <p className="text-white/60 text-xs sm:text-sm mb-3 sm:mb-4">{plan.description}</p>
                )}
                
                <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-xs sm:text-sm">Max Tree</span>
                    <span className="text-white font-semibold text-sm sm:text-base">{plan.max_tree}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-xs sm:text-sm">Monthly</span>
                    <span className="text-white font-semibold text-sm sm:text-base">TTD ${plan.monthly_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-xs sm:text-sm">Annual</span>
                    <span className="text-white font-semibold text-sm sm:text-base">TTD ${plan.annual_price.toFixed(2)}</span>
                  </div>
                  <div className="pt-2 border-t border-white/10">
                    <span className="text-white/60 text-xs">
                      Annual savings: TTD ${(plan.monthly_price * 12 - plan.annual_price).toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(plan)}
                  className={`w-full text-xs sm:text-sm ${
                    plan.is_active
                      ? 'bg-primary/20 text-primary border-primary/30 hover:bg-primary/30'
                      : 'bg-muted/20 text-muted-foreground border-muted/30 hover:bg-muted/30'
                  }`}
                >
                  {plan.is_active ? 'Active' : 'Inactive'}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}