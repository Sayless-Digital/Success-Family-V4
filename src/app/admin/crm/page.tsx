"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  List, 
  LayoutGrid, 
  Mail, 
  Phone, 
  MessageSquare, 
  Calendar,
  DollarSign,
  Settings,
  X,
  Save,
  MoreVertical,
  Search,
  FileText,
  MessageCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { CrmLead, CrmStage, CrmLeadSource, CrmConversation, CrmConversationSession, CrmNote, CrmConversationChannel, CrmLeadContact, CrmContactType } from '@/types'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "—"
  return `$${Number(value).toFixed(2)} TTD`
}

const formatDate = (date: string | null | undefined) => {
  if (!date) return "—"
  return new Date(date).toLocaleDateString()
}

const sourceLabels: Record<CrmLeadSource, string> = {
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  email: 'Email',
  referral: 'Referral',
  website: 'Website',
  other: 'Other'
}

const channelLabels: Record<CrmConversationChannel, string> = {
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  email: 'Email',
  phone: 'Phone',
  other: 'Other'
}

const contactTypeLabels: Record<CrmContactType, string> = {
  email: 'Email',
  phone: 'Phone',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  other: 'Other'
}

export default function CrmPage() {
  const { user, userProfile, isLoading } = useAuth()
  const router = useRouter()
  
  const [leads, setLeads] = useState<CrmLead[]>([])
  const [stages, setStages] = useState<CrmStage[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredLeads, setFilteredLeads] = useState<CrmLead[]>([])
  const [crmAverageValue, setCrmAverageValue] = useState<number>(50.00)
  
  // Dialogs
  const [leadDialogOpen, setLeadDialogOpen] = useState(false)
  const [stageManagementOpen, setStageManagementOpen] = useState(false)
  const [stageDialogOpen, setStageDialogOpen] = useState(false)
  const [leadDetailOpen, setLeadDetailOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null)
  const [editingStage, setEditingStage] = useState<CrmStage | null>(null)
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null)
  
  // Form states
  const [leadFormData, setLeadFormData] = useState({
    name: "",
    source: "tiktok" as CrmLeadSource,
    stage_id: "",
    contacted_date: "",
    potential_revenue_ttd: "",
    close_date: "",
    close_revenue_ttd: ""
  })
  
  const [leadContacts, setLeadContacts] = useState<Array<{ type: CrmContactType; value: string; is_primary: boolean }>>([])
  
  const [stageFormData, setStageFormData] = useState({
    name: "",
    description: "",
    sort_order: 0
  })

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && (!user || userProfile?.role !== 'admin')) {
      router.push('/')
    }
  }, [user, userProfile, isLoading, router])

  // Fetch data
  useEffect(() => {
    if (userProfile?.role === 'admin') {
      fetchData()
    }
  }, [userProfile])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Fetch CRM average minimum value from platform_settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('platform_settings')
        .select('crm_average_minimum_value_ttd')
        .eq('id', 1)
        .single()

      if (!settingsError && settingsData) {
        setCrmAverageValue(settingsData.crm_average_minimum_value_ttd || 50.00)
      }
      
      // Fetch stages
      const { data: stagesData, error: stagesError } = await supabase
        .from('crm_stages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (stagesError) throw stagesError

      // Fetch leads with stage info and contacts
      const { data: leadsData, error: leadsError } = await supabase
        .from('crm_leads')
        .select(`
          *,
          stage:crm_stages(*),
          contacts:crm_lead_contacts(*)
        `)
        .order('created_at', { ascending: false })

      if (leadsError) throw leadsError

      setStages(stagesData || [])
      setLeads(leadsData || [])
      setFilteredLeads(leadsData || [])
    } catch (error) {
      console.error('Error fetching CRM data:', error)
      toast.error('Failed to load CRM data')
    } finally {
      setLoading(false)
    }
  }, [])

  // Filter leads
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredLeads(leads)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = leads.filter(lead => {
        const nameMatch = lead.name?.toLowerCase().includes(query)
        const contactMatch = lead.contacts?.some(contact => 
          contact.value.toLowerCase().includes(query)
        )
        return nameMatch || contactMatch
      })
      setFilteredLeads(filtered)
    }
  }, [searchQuery, leads])

  // Set up realtime subscriptions
  useEffect(() => {
    if (userProfile?.role !== 'admin') return

    const leadsChannel = supabase
      .channel('crm-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads' }, () => {
        fetchData()
      })
      .subscribe()

    const stagesChannel = supabase
      .channel('crm-stages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_stages' }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(leadsChannel)
      supabase.removeChannel(stagesChannel)
    }
  }, [userProfile, fetchData])

  const handleCreateLead = () => {
    setEditingLead(null)
    const today = new Date().toISOString().split('T')[0]
    setLeadFormData({
      name: "",
      source: "tiktok",
      stage_id: stages[0]?.id || "",
      contacted_date: today,
      potential_revenue_ttd: crmAverageValue.toString(),
      close_date: "",
      close_revenue_ttd: crmAverageValue.toString()
    })
    setLeadContacts([])
    setLeadDialogOpen(true)
  }

  const handleEditLead = (lead: CrmLead) => {
    setEditingLead(lead)
    setLeadFormData({
      name: lead.name || "",
      source: lead.source,
      stage_id: lead.stage_id,
      contacted_date: lead.contacted_date || "",
      potential_revenue_ttd: lead.potential_revenue_ttd?.toString() || crmAverageValue.toString(),
      close_date: lead.close_date || "",
      close_revenue_ttd: lead.close_revenue_ttd?.toString() || crmAverageValue.toString()
    })
    // Convert contacts to form format
    const contacts = lead.contacts?.map(c => ({
      type: c.contact_type,
      value: c.value,
      is_primary: c.is_primary
    })) || []
    setLeadContacts(contacts)
    setLeadDialogOpen(true)
  }

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const leadData: any = {
        name: leadFormData.name,
        source: leadFormData.source,
        stage_id: leadFormData.stage_id,
        contacted_date: leadFormData.contacted_date || null,
        potential_revenue_ttd: leadFormData.potential_revenue_ttd ? parseFloat(leadFormData.potential_revenue_ttd) : null,
        close_date: leadFormData.close_date || null,
        close_revenue_ttd: leadFormData.close_revenue_ttd ? parseFloat(leadFormData.close_revenue_ttd) : null,
        created_by: user.id
      }

      let leadId: string

      if (editingLead) {
        const { data, error } = await supabase
          .from('crm_leads')
          .update(leadData)
          .eq('id', editingLead.id)
          .select()
          .single()
        if (error) throw error
        leadId = editingLead.id
        toast.success('Lead updated successfully')
      } else {
        const { data, error } = await supabase
          .from('crm_leads')
          .insert(leadData)
          .select()
          .single()
        if (error) throw error
        leadId = data.id
        toast.success('Lead created successfully')
      }

      // Save contacts
      if (leadContacts.length > 0) {
        // Delete existing contacts if editing
        if (editingLead) {
          await supabase
            .from('crm_lead_contacts')
            .delete()
            .eq('lead_id', leadId)
        }

        // Insert new contacts
        const contactsToInsert = leadContacts.map(contact => ({
          lead_id: leadId,
          contact_type: contact.type,
          value: contact.value,
          is_primary: contact.is_primary
        }))

        const { error: contactsError } = await supabase
          .from('crm_lead_contacts')
          .insert(contactsToInsert)

        if (contactsError) throw contactsError
      }

      setLeadDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving lead:', error)
      toast.error('Failed to save lead')
    }
  }

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return

    try {
      const { error } = await supabase
        .from('crm_leads')
        .delete()
        .eq('id', leadId)
      if (error) throw error
      toast.success('Lead deleted successfully')
      fetchData()
    } catch (error) {
      console.error('Error deleting lead:', error)
      toast.error('Failed to delete lead')
    }
  }

  const handleOpenStageManagement = () => {
    setStageManagementOpen(true)
  }

  const handleCreateStage = () => {
    setEditingStage(null)
    setStageFormData({
      name: "",
      description: "",
      sort_order: stages.length + 1
    })
    setStageDialogOpen(true)
  }

  const handleEditStage = (stage: CrmStage) => {
    setEditingStage(stage)
    setStageFormData({
      name: stage.name,
      description: stage.description || "",
      sort_order: stage.sort_order
    })
    setStageDialogOpen(true)
  }

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const stageData: any = {
        name: stageFormData.name,
        description: stageFormData.description || null,
        sort_order: stageFormData.sort_order
      }

      if (editingStage) {
        const { error } = await supabase
          .from('crm_stages')
          .update(stageData)
          .eq('id', editingStage.id)
        if (error) throw error
        toast.success('Stage updated successfully')
      } else {
        const { error } = await supabase
          .from('crm_stages')
          .insert(stageData)
        if (error) throw error
        toast.success('Stage created successfully')
      }

      setStageDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Error saving stage:', error)
      toast.error('Failed to save stage')
    }
  }

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm('Are you sure you want to delete this stage? Leads in this stage will need to be moved first.')) return

    try {
      // Check if any leads are in this stage
      const { data: leadsInStage } = await supabase
        .from('crm_leads')
        .select('id')
        .eq('stage_id', stageId)
        .limit(1)

      if (leadsInStage && leadsInStage.length > 0) {
        toast.error('Cannot delete stage with leads. Please move leads first.')
        return
      }

      const { error } = await supabase
        .from('crm_stages')
        .update({ is_active: false })
        .eq('id', stageId)
      if (error) throw error
      toast.success('Stage deleted successfully')
      fetchData()
    } catch (error) {
      console.error('Error deleting stage:', error)
      toast.error('Failed to delete stage')
    }
  }

  const handleMoveLead = async (leadId: string, newStageId: string) => {
    try {
      const { error } = await supabase
        .from('crm_leads')
        .update({ stage_id: newStageId })
        .eq('id', leadId)
      if (error) throw error
      fetchData()
    } catch (error) {
      console.error('Error moving lead:', error)
      toast.error('Failed to move lead')
    }
  }

  const handleViewLead = async (lead: CrmLead) => {
    setSelectedLead(lead)
    setLeadDetailOpen(true)
  }

  // Group leads by stage for Kanban
  const leadsByStage = stages.reduce((acc, stage) => {
    acc[stage.id] = filteredLeads.filter(lead => lead.stage_id === stage.id)
    return acc
  }, {} as Record<string, CrmLead[]>)

  if (!user || userProfile?.role !== 'admin') {
    return null
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="relative z-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenStageManagement}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <Settings className="h-4 w-4 mr-2 text-white/70" />
              Manage Stages
            </Button>
            <Button
              onClick={handleCreateLead}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <Plus className="h-4 w-4 mr-2 text-white/70" />
              New Lead
            </Button>
          </div>
        </div>

        {/* Search and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={view === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('list')}
              className={cn(
                view === 'list' 
                  ? "bg-white/20 border-white/30 text-white" 
                  : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
              )}
            >
              <List className="h-4 w-4 mr-2 text-white/70" />
              List
            </Button>
            <Button
              variant={view === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('kanban')}
              className={cn(
                view === 'kanban' 
                  ? "bg-white/20 border-white/30 text-white" 
                  : "bg-white/10 border-white/20 text-white/70 hover:bg-white/20"
              )}
            >
              <LayoutGrid className="h-4 w-4 mr-2 text-white/70" />
              Kanban
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
            <p className="text-white/80">Loading CRM data…</p>
          </div>
        ) : view === 'list' ? (
          <ListView 
            leads={filteredLeads}
            stages={stages}
            onEdit={handleEditLead}
            onDelete={handleDeleteLead}
            onView={handleViewLead}
            onMove={handleMoveLead}
          />
        ) : (
          <KanbanView
            leadsByStage={leadsByStage}
            stages={stages}
            onEdit={handleEditLead}
            onDelete={handleDeleteLead}
            onView={handleViewLead}
            onMove={handleMoveLead}
          />
        )}
      </div>

      {/* Lead Dialog */}
      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
          <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white sm:max-w-4xl max-h-[95vh] p-0 [&>div]:!flex [&>div]:!flex-col [&>div]:!h-full">
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-white/20">
              <DialogHeader>
                <DialogTitle className="text-white text-2xl font-semibold">
                  {editingLead ? 'Edit Lead' : 'Create New Lead'}
                </DialogTitle>
                <DialogDescription className="text-white/70 mt-1">
                  {editingLead ? 'Update lead information and track progress' : 'Add a new lead to your sales pipeline'}
                </DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleSaveLead} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Basic Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-white/90 font-medium">Full Name *</Label>
                      <Input
                        id="name"
                        value={leadFormData.name}
                        onChange={(e) => setLeadFormData({ ...leadFormData, name: e.target.value })}
                        required
                        placeholder="Enter lead's full name"
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="source" className="text-white/90 font-medium">Lead Source *</Label>
                      <Select
                        value={leadFormData.source}
                        onValueChange={(value) => setLeadFormData({ ...leadFormData, source: value as CrmLeadSource })}
                      >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white h-10">
                          <SelectValue placeholder="Select source" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/10 border-white/20 backdrop-blur-md">
                          {Object.entries(sourceLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value} className="text-white focus:bg-white/20">
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stage_id" className="text-white/90 font-medium">Pipeline Stage *</Label>
                      <Select
                        value={leadFormData.stage_id}
                        onValueChange={(value) => setLeadFormData({ ...leadFormData, stage_id: value })}
                      >
                        <SelectTrigger className="bg-white/10 border-white/20 text-white h-10">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent className="bg-white/10 border-white/20 backdrop-blur-md">
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.id} className="text-white focus:bg-white/20">
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contacted_date" className="text-white/90 font-medium">Contacted Date *</Label>
                      <Input
                        id="contacted_date"
                        type="date"
                        value={leadFormData.contacted_date}
                        onChange={(e) => setLeadFormData({ ...leadFormData, contacted_date: e.target.value })}
                        required
                        className="bg-white/10 border-white/20 text-white h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Contact Information</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLeadContacts([...leadContacts, { type: 'email', value: '', is_primary: leadContacts.length === 0 }])
                      }}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-8"
                    >
                      <Plus className="h-3 w-3 mr-1.5 text-white/70" />
                      Add Contact
                    </Button>
                  </div>
                  {leadContacts.length > 0 ? (
                    <div className="space-y-3">
                      {leadContacts.map((contact, index) => (
                        <div key={index} className="flex gap-3 items-end p-3 rounded-lg border border-white/20 bg-white/5">
                          <div className="flex-1 min-w-[140px]">
                            <Label className="text-xs text-white/70 mb-1.5 block">Contact Type</Label>
                            <Select
                              value={contact.type}
                              onValueChange={(value) => {
                                const updated = [...leadContacts]
                                updated[index].type = value as CrmContactType
                                setLeadContacts(updated)
                              }}
                            >
                              <SelectTrigger className="bg-white/10 border-white/20 text-white h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white/10 border-white/20 backdrop-blur-md">
                                {Object.entries(contactTypeLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value} className="text-white focus:bg-white/20">
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs text-white/70 mb-1.5 block">
                              {contact.type === 'tiktok' ? 'Handle (without @)' : contact.type === 'email' ? 'Email Address' : contact.type === 'phone' ? 'Phone Number' : 'Value'}
                            </Label>
                            <Input
                              placeholder={
                                contact.type === 'tiktok' ? 'username' : 
                                contact.type === 'email' ? 'email@example.com' : 
                                contact.type === 'phone' ? '+1 (555) 123-4567' : 
                                'Enter value'
                              }
                              value={contact.value}
                              onChange={(e) => {
                                const updated = [...leadContacts]
                                updated[index].value = e.target.value
                                setLeadContacts(updated)
                              }}
                              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-9"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updated = leadContacts.filter((_, i) => i !== index)
                              setLeadContacts(updated)
                            }}
                            className="text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 rounded-lg border border-dashed border-white/20 bg-white/5 text-center">
                      <MessageSquare className="h-8 w-8 text-white/40 mx-auto mb-2" />
                      <p className="text-sm text-white/60">No contacts added yet</p>
                      <p className="text-xs text-white/50 mt-1">Click "Add Contact" to add email, phone, or social media handles</p>
                    </div>
                  )}
                </div>

                {/* Revenue Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                    <DollarSign className="h-4 w-4 text-white/70" />
                    <h3 className="text-lg font-semibold text-white">Revenue Information</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="potential_revenue_ttd" className="text-white/90 font-medium">Potential Revenue</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm">$</span>
                        <Input
                          id="potential_revenue_ttd"
                          type="number"
                          step="0.01"
                          value={leadFormData.potential_revenue_ttd}
                          onChange={(e) => setLeadFormData({ ...leadFormData, potential_revenue_ttd: e.target.value })}
                          placeholder="0.00"
                          className="bg-white/10 border-white/20 text-white pl-7 h-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 text-xs">TTD</span>
                      </div>
                      <p className="text-xs text-white/50">Expected revenue if deal closes</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="close_date" className="text-white/90 font-medium">Close Date</Label>
                      <Input
                        id="close_date"
                        type="date"
                        value={leadFormData.close_date}
                        onChange={(e) => setLeadFormData({ ...leadFormData, close_date: e.target.value })}
                        className="bg-white/10 border-white/20 text-white h-10"
                      />
                      <p className="text-xs text-white/50">Expected or actual close date</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="close_revenue_ttd" className="text-white/90 font-medium">Close Revenue</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 text-sm">$</span>
                        <Input
                          id="close_revenue_ttd"
                          type="number"
                          step="0.01"
                          value={leadFormData.close_revenue_ttd}
                          onChange={(e) => setLeadFormData({ ...leadFormData, close_revenue_ttd: e.target.value })}
                          placeholder="0.00"
                          className="bg-white/10 border-white/20 text-white pl-7 h-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 text-xs">TTD</span>
                      </div>
                      <p className="text-xs text-white/50">Actual revenue when deal closes</p>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="flex-shrink-0 gap-3 px-6 py-4 border-t border-white/20 bg-white/5 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLeadDialogOpen(false)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-9 px-6"
                >
                  <Save className="h-4 w-4 mr-2 text-white/70" />
                  {editingLead ? 'Update Lead' : 'Create Lead'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Stage Management Dialog */}
        <Dialog open={stageManagementOpen} onOpenChange={setStageManagementOpen}>
          <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white sm:max-w-4xl max-h-[90vh] p-0 [&>div]:!flex [&>div]:!flex-col [&>div]:!h-full">
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-white/20">
              <DialogHeader>
                <DialogTitle className="text-white text-2xl font-semibold">Manage Pipeline Stages</DialogTitle>
                <DialogDescription className="text-white/70 mt-1">
                  Organize your sales pipeline by creating, editing, and managing stages
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">Pipeline Stages</h3>
                  <p className="text-sm text-white/60 mt-1">Configure the stages that leads move through</p>
                </div>
                <Button
                  onClick={handleCreateStage}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-9"
                >
                  <Plus className="h-4 w-4 mr-2 text-white/70" />
                  Add Stage
                </Button>
              </div>
              {stages.length > 0 ? (
                <div className="space-y-3">
                  {stages.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start gap-4 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/20 text-white/80 font-semibold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-semibold text-white text-base">{stage.name}</span>
                            <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs font-normal">
                              Sort Order: {stage.sort_order}
                            </Badge>
                          </div>
                          {stage.description ? (
                            <p className="text-sm text-white/70 mt-1">{stage.description}</p>
                          ) : (
                            <p className="text-xs text-white/50 italic mt-1">No description</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditStage(stage)}
                          className="text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 p-0"
                          title="Edit stage"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStage(stage.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 p-0"
                          title="Delete stage"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-white/20 rounded-lg bg-white/5">
                  <Settings className="h-12 w-12 text-white/40 mx-auto mb-4" />
                  <p className="text-white/80 font-medium mb-1">No stages configured</p>
                  <p className="text-sm text-white/60 mb-4">Create your first pipeline stage to organize your leads</p>
                  <Button
                    onClick={handleCreateStage}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <Plus className="h-4 w-4 mr-2 text-white/70" />
                    Create First Stage
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Stage Dialog */}
        <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
          <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white sm:max-w-2xl p-0 [&>div]:!flex [&>div]:!flex-col [&>div]:!h-full">
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-white/20">
              <DialogHeader>
                <DialogTitle className="text-white text-2xl font-semibold">
                  {editingStage ? 'Edit Pipeline Stage' : 'Create New Stage'}
                </DialogTitle>
                <DialogDescription className="text-white/70 mt-1">
                  {editingStage ? 'Update stage details and configuration' : 'Define a new stage in your sales pipeline'}
                </DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleSaveStage} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stage_name" className="text-white/90 font-medium">Stage Name *</Label>
                  <Input
                    id="stage_name"
                    value={stageFormData.name}
                    onChange={(e) => setStageFormData({ ...stageFormData, name: e.target.value })}
                    required
                    placeholder="e.g., Qualified, Proposal, Negotiation"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10"
                  />
                  <p className="text-xs text-white/50">A clear name that describes this stage in your pipeline</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage_description" className="text-white/90 font-medium">Description</Label>
                  <Textarea
                    id="stage_description"
                    value={stageFormData.description}
                    onChange={(e) => setStageFormData({ ...stageFormData, description: e.target.value })}
                    placeholder="Describe what happens in this stage..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                  />
                  <p className="text-xs text-white/50">Optional description to help your team understand this stage</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort_order" className="text-white/90 font-medium">Sort Order *</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={stageFormData.sort_order}
                    onChange={(e) => setStageFormData({ ...stageFormData, sort_order: parseInt(e.target.value) || 0 })}
                    required
                    min="1"
                    className="bg-white/10 border-white/20 text-white h-10"
                  />
                  <p className="text-xs text-white/50">Lower numbers appear first in the pipeline (1, 2, 3...)</p>
                </div>
              </div>
              </div>
              <DialogFooter className="flex-shrink-0 gap-3 px-6 py-4 border-t border-white/20 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStageDialogOpen(false)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-9 px-6"
                >
                  <Save className="h-4 w-4 mr-2 text-white/70" />
                  {editingStage ? 'Update Stage' : 'Create Stage'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Lead Detail Dialog */}
        {selectedLead && (
          <LeadDetailDialog
            lead={selectedLead}
            open={leadDetailOpen}
            onOpenChange={setLeadDetailOpen}
            onRefresh={fetchData}
          />
        )}

// List View Component
function ListView({
  leads,
  stages,
  onEdit,
  onDelete,
  onView,
  onMove
}: {
  leads: CrmLead[]
  stages: CrmStage[]
  onEdit: (lead: CrmLead) => void
  onDelete: (leadId: string) => void
  onView: (lead: CrmLead) => void
  onMove: (leadId: string, newStageId: string) => void
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-12 text-center">
        <FileText className="h-12 w-12 text-white/60 mx-auto mb-4" />
        <p className="text-white/80">No leads found</p>
        <p className="text-white/60 text-sm mt-1">Create your first lead to get started</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/20">
              <TableHead className="text-white/80">Name</TableHead>
              <TableHead className="text-white/80">Contact</TableHead>
              <TableHead className="text-white/80">Source</TableHead>
              <TableHead className="text-white/80">Stage</TableHead>
              <TableHead className="text-white/80">Potential Revenue</TableHead>
              <TableHead className="text-white/80">Close Revenue</TableHead>
              <TableHead className="text-white/80">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} className="border-white/20">
                <TableCell className="text-white/90 font-medium">{lead.name}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {lead.contacts && lead.contacts.length > 0 ? (
                      lead.contacts.map((contact) => (
                        <div key={contact.id} className="flex items-center gap-1 text-sm text-white/70">
                          {contact.contact_type === 'email' && <Mail className="h-3 w-3 text-white/70" />}
                          {contact.contact_type === 'phone' && <Phone className="h-3 w-3 text-white/70" />}
                          {(contact.contact_type === 'tiktok' || contact.contact_type === 'whatsapp' || contact.contact_type === 'instagram') && (
                            <MessageSquare className="h-3 w-3 text-white/70" />
                          )}
                          <span>
                            {contact.contact_type === 'tiktok' ? `@${contact.value}` : contact.value}
                          </span>
                          <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs ml-1">
                            {contactTypeLabels[contact.contact_type]}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <span className="text-white/60 text-sm">No contacts</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-white/10 text-white border-white/20 capitalize">
                    {sourceLabels[lead.source]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={lead.stage_id}
                    onValueChange={(value) => onMove(lead.id, value)}
                  >
                    <SelectTrigger className="w-[180px] bg-white/10 border-white/20 text-white h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white/10 border-white/20 backdrop-blur-md">
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id} className="text-white focus:bg-white/20">
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-white/80">
                  {formatCurrency(lead.potential_revenue_ttd)}
                </TableCell>
                <TableCell className="text-white/80">
                  {formatCurrency(lead.close_revenue_ttd)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4 text-white/70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white/10 border-white/20 backdrop-blur-md">
                      <DropdownMenuItem onClick={() => onView(lead)} className="text-white focus:bg-white/20">
                        <Eye className="h-4 w-4 mr-2 text-white/70" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(lead)} className="text-white focus:bg-white/20">
                        <Edit className="h-4 w-4 mr-2 text-white/70" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(lead.id)} 
                        className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// Kanban View Component
function KanbanView({
  leadsByStage,
  stages,
  onEdit,
  onDelete,
  onView,
  onMove
}: {
  leadsByStage: Record<string, CrmLead[]>
  stages: CrmStage[]
  onEdit: (lead: CrmLead) => void
  onDelete: (leadId: string) => void
  onView: (lead: CrmLead) => void
  onMove: (leadId: string, newStageId: string) => void
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
      {stages.map((stage) => {
        const stageLeads = leadsByStage[stage.id] || []
        const totalRevenue = stageLeads.reduce((sum, lead) => sum + (lead.potential_revenue_ttd || 0), 0)
        
        return (
          <div
            key={stage.id}
            className="flex-shrink-0 w-80 rounded-lg border border-white/20 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md p-4"
          >
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">{stage.name}</h3>
                <Badge variant="outline" className="bg-white/10 text-white border-white/20">
                  {stageLeads.length}
                </Badge>
              </div>
              {stage.description && (
                <p className="text-sm text-white/60 mb-2">{stage.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-white/70">
                <DollarSign className="h-3 w-3 text-white/70" />
                <span>Total: {formatCurrency(totalRevenue)}</span>
              </div>
            </div>
            
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="space-y-2">
                {stageLeads.map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onView={onView}
                    stages={stages}
                    onMove={onMove}
                  />
                ))}
                {stageLeads.length === 0 && (
                  <div className="text-center py-8 text-white/50 text-sm">
                    No leads in this stage
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )
      })}
    </div>
  )
}

// Kanban Card Component
function KanbanCard({
  lead,
  onEdit,
  onDelete,
  onView,
  stages,
  onMove
}: {
  lead: CrmLead
  onEdit: (lead: CrmLead) => void
  onDelete: (leadId: string) => void
  onView: (lead: CrmLead) => void
  stages: CrmStage[]
  onMove: (leadId: string, newStageId: string) => void
}) {
  return (
    <div
      className="rounded-lg border border-white/20 bg-white/5 p-3 cursor-pointer hover:bg-white/10 transition-colors"
      onClick={() => onView(lead)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-white text-sm">{lead.name}</h4>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-3 w-3 text-white/70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white/10 border-white/20 backdrop-blur-md">
            <DropdownMenuItem onClick={() => onView(lead)} className="text-white focus:bg-white/20">
              <Eye className="h-4 w-4 mr-2 text-white/70" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(lead)} className="text-white focus:bg-white/20">
              <Edit className="h-4 w-4 mr-2 text-white/70" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(lead.id)} 
              className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="space-y-1 mb-2">
        {lead.contacts && lead.contacts.length > 0 ? (
          lead.contacts.slice(0, 2).map((contact) => (
            <div key={contact.id} className="flex items-center gap-1 text-xs text-white/70">
              {contact.contact_type === 'email' && <Mail className="h-3 w-3 text-white/70" />}
              {contact.contact_type === 'phone' && <Phone className="h-3 w-3 text-white/70" />}
              {(contact.contact_type === 'tiktok' || contact.contact_type === 'whatsapp' || contact.contact_type === 'instagram') && (
                <MessageSquare className="h-3 w-3 text-white/70" />
              )}
              <span>
                {contact.contact_type === 'tiktok' ? `@${contact.value}` : contact.value}
              </span>
            </div>
          ))
        ) : (
          <span className="text-white/60 text-xs">No contacts</span>
        )}
      </div>
      
      <div className="flex items-center justify-between mb-2">
        <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs capitalize">
          {sourceLabels[lead.source]}
        </Badge>
        {lead.potential_revenue_ttd && (
          <span className="text-xs text-white/80 font-medium">
            {formatCurrency(lead.potential_revenue_ttd)}
          </span>
        )}
      </div>
      
      <Select
        value={lead.stage_id}
        onValueChange={(value) => {
          onMove(lead.id, value)
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectTrigger className="w-full h-7 bg-white/10 border-white/20 text-white text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white/10 border-white/20 backdrop-blur-md">
          {stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id} className="text-white focus:bg-white/20">
              {stage.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// Lead Detail Dialog Component
function LeadDetailDialog({
  lead,
  open,
  onOpenChange,
  onRefresh
}: {
  lead: CrmLead
  open: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
}) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<CrmConversation[]>([])
  const [notes, setNotes] = useState<CrmNote[]>([])
  const [loading, setLoading] = useState(true)
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [sessionFormData, setSessionFormData] = useState({
    channel: "tiktok" as CrmConversationChannel,
    notes: ""
  })
  const [noteFormData, setNoteFormData] = useState({
    content: ""
  })

  useEffect(() => {
    if (open && lead) {
      fetchLeadDetails()
    }
  }, [open, lead])

  const fetchLeadDetails = async () => {
    try {
      setLoading(true)
      
      // Fetch or create conversation
      let { data: conversationsData, error: convError } = await supabase
        .from('crm_conversations')
        .select(`
          *,
          sessions:crm_conversation_sessions(
            *,
            created_by_user:users(id, username, first_name, last_name)
          )
        `)
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })

      if (convError) throw convError

      // Create conversation if it doesn't exist
      if (!conversationsData || conversationsData.length === 0) {
        const { data: newConv, error: createError } = await supabase
          .from('crm_conversations')
          .insert({ lead_id: lead.id })
          .select()
          .single()

        if (createError) throw createError
        conversationsData = [newConv]
      }

      // Fetch notes
      const { data: notesData, error: notesError } = await supabase
        .from('crm_notes')
        .select(`
          *,
          created_by_user:users(id, username, first_name, last_name)
        `)
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })

      if (notesError) throw notesError

      setConversations(conversationsData || [])
      setNotes(notesData || [])
    } catch (error) {
      console.error('Error fetching lead details:', error)
      toast.error('Failed to load lead details')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const conversation = conversations[0]
      if (!conversation) {
        toast.error('Conversation not found')
        return
      }

      const { error } = await supabase
        .from('crm_conversation_sessions')
        .insert({
          conversation_id: conversation.id,
          channel: sessionFormData.channel,
          notes: sessionFormData.notes || null,
          created_by: user.id
        })

      if (error) throw error

      toast.success('Session added successfully')
      setSessionDialogOpen(false)
      setSessionFormData({ channel: "tiktok", notes: "" })
      fetchLeadDetails()
      onRefresh()
    } catch (error) {
      console.error('Error saving session:', error)
      toast.error('Failed to save session')
    }
  }

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      const { error } = await supabase
        .from('crm_notes')
        .insert({
          lead_id: lead.id,
          content: noteFormData.content,
          created_by: user.id
        })

      if (error) throw error

      toast.success('Note added successfully')
      setNoteDialogOpen(false)
      setNoteFormData({ content: "" })
      fetchLeadDetails()
      onRefresh()
    } catch (error) {
      console.error('Error saving note:', error)
      toast.error('Failed to save note')
    }
  }

  const conversation = conversations[0]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white sm:max-w-5xl max-h-[95vh] p-0 [&>div]:!flex [&>div]:!flex-col [&>div]:!h-full">
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-white/20">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-white text-2xl font-semibold mb-1">{lead.name}</DialogTitle>
                <DialogDescription className="text-white/70">
                  View and manage all interactions, conversations, and notes for this lead
                </DialogDescription>
              </div>
              {lead.stage && (
                <Badge variant="outline" className="bg-white/10 text-white border-white/20 capitalize text-sm font-medium">
                  {lead.stage.name}
                </Badge>
              )}
            </div>
          </DialogHeader>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <p className="text-white/80">Loading...</p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col">
            <div className="flex-shrink-0 px-6 pt-4">
              <TabsList className="bg-white/10 border-white/20">
                <TabsTrigger value="overview" className="text-white data-[state=active]:bg-white/20">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="conversations" className="text-white data-[state=active]:bg-white/20">
                  Conversations
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-white data-[state=active]:bg-white/20">
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <MessageSquare className="h-4 w-4 text-white/70" />
                  <h3 className="text-lg font-semibold text-white">Contact Information</h3>
                </div>
                {lead.contacts && lead.contacts.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {lead.contacts.map((contact) => (
                      <div key={contact.id} className="flex items-center gap-3 p-3 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 transition-colors">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 border border-white/20">
                          {contact.contact_type === 'email' && <Mail className="h-5 w-5 text-white/70" />}
                          {contact.contact_type === 'phone' && <Phone className="h-5 w-5 text-white/70" />}
                          {(contact.contact_type === 'tiktok' || contact.contact_type === 'whatsapp' || contact.contact_type === 'instagram') && (
                            <MessageSquare className="h-5 w-5 text-white/70" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-white/10 text-white border-white/20 capitalize text-xs">
                              {contactTypeLabels[contact.contact_type]}
                            </Badge>
                            {contact.is_primary && (
                              <Badge variant="outline" className="bg-white/10 text-white border-white/20 text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          <p className="text-white font-medium truncate">
                            {contact.contact_type === 'tiktok' ? `@${contact.value}` : contact.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-lg border border-dashed border-white/20 bg-white/5 text-center">
                    <MessageSquare className="h-8 w-8 text-white/40 mx-auto mb-2" />
                    <p className="text-sm text-white/60">No contact information available</p>
                  </div>
                )}
              </div>

              {/* Lead Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <FileText className="h-4 w-4 text-white/70" />
                  <h3 className="text-lg font-semibold text-white">Lead Details</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60 uppercase tracking-wide">Source</Label>
                    <div>
                      <Badge variant="outline" className="bg-white/10 text-white border-white/20 capitalize">
                        {sourceLabels[lead.source]}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-white/60 uppercase tracking-wide">Contacted Date</Label>
                    <p className="text-white font-medium">{formatDate(lead.contacted_date)}</p>
                  </div>
                  {lead.close_date && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-white/60 uppercase tracking-wide">Close Date</Label>
                      <p className="text-white font-medium">{formatDate(lead.close_date)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <DollarSign className="h-4 w-4 text-white/70" />
                  <h3 className="text-lg font-semibold text-white">Revenue Information</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border border-white/20 bg-white/5">
                    <Label className="text-xs text-white/60 uppercase tracking-wide mb-2 block">Potential Revenue</Label>
                    <p className="text-2xl font-semibold text-white">{formatCurrency(lead.potential_revenue_ttd)}</p>
                    <p className="text-xs text-white/50 mt-1">Expected revenue if deal closes</p>
                  </div>
                  <div className="p-4 rounded-lg border border-white/20 bg-white/5">
                    <Label className="text-xs text-white/60 uppercase tracking-wide mb-2 block">Close Revenue</Label>
                    <p className="text-2xl font-semibold text-white">{formatCurrency(lead.close_revenue_ttd)}</p>
                    <p className="text-xs text-white/50 mt-1">Actual revenue when deal closes</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="conversations" className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Conversation Sessions</h3>
                  <p className="text-sm text-white/60 mt-1">Track all interactions across different channels</p>
                </div>
                <Button
                  onClick={() => setSessionDialogOpen(true)}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-9"
                >
                  <Plus className="h-4 w-4 mr-2 text-white/70" />
                  Add Session
                </Button>
              </div>

              {conversation?.sessions && conversation.sessions.length > 0 ? (
                <div className="space-y-3">
                  {conversation.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-lg border border-white/20 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 border border-white/20">
                            <MessageCircle className="h-5 w-5 text-white/70" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="bg-white/10 text-white border-white/20 capitalize">
                                {channelLabels[session.channel]}
                              </Badge>
                              <span className="text-xs text-white/60">
                                {new Date(session.created_at).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            {session.created_by_user && (
                              <p className="text-xs text-white/50">
                                by {session.created_by_user.first_name} {session.created_by_user.last_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {session.notes && (
                        <div className="pl-13">
                          <p className="text-white/80 whitespace-pre-wrap text-sm leading-relaxed">{session.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-white/20 rounded-lg bg-white/5">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-white/40" />
                  <p className="text-white/80 font-medium mb-1">No conversation sessions</p>
                  <p className="text-sm text-white/60 mb-4">Start tracking interactions by adding your first session</p>
                  <Button
                    onClick={() => setSessionDialogOpen(true)}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <Plus className="h-4 w-4 mr-2 text-white/70" />
                    Add First Session
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Notes</h3>
                  <p className="text-sm text-white/60 mt-1">Keep track of important information and updates</p>
                </div>
                <Button
                  onClick={() => setNoteDialogOpen(true)}
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-9"
                >
                  <Plus className="h-4 w-4 mr-2 text-white/70" />
                  Add Note
                </Button>
              </div>

              {notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border border-white/20 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/10 border border-white/20">
                          <FileText className="h-5 w-5 text-white/70" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {note.created_by_user && (
                              <span className="text-sm font-medium text-white/90">
                                {note.created_by_user.first_name} {note.created_by_user.last_name}
                              </span>
                            )}
                            <span className="text-xs text-white/50">•</span>
                            <span className="text-xs text-white/60">
                              {new Date(note.created_at).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <p className="text-white/80 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-white/20 rounded-lg bg-white/5">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-white/40" />
                  <p className="text-white/80 font-medium mb-1">No notes yet</p>
                  <p className="text-sm text-white/60 mb-4">Add your first note to track important information</p>
                  <Button
                    onClick={() => setNoteDialogOpen(true)}
                    className="bg-white/20 border-white/30 text-white hover:bg-white/30"
                  >
                    <Plus className="h-4 w-4 mr-2 text-white/70" />
                    Add First Note
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Session Dialog */}
        <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
          <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white sm:max-w-2xl p-0 [&>div]:!flex [&>div]:!flex-col [&>div]:!h-full">
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-white/20">
              <DialogHeader>
                <DialogTitle className="text-white text-2xl font-semibold">Add Conversation Session</DialogTitle>
                <DialogDescription className="text-white/70 mt-1">
                  Record a new conversation session to track interactions with this lead
                </DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleSaveSession} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="session_channel" className="text-white/90 font-medium">Communication Channel *</Label>
                  <Select
                    value={sessionFormData.channel}
                    onValueChange={(value) => setSessionFormData({ ...sessionFormData, channel: value as CrmConversationChannel })}
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white h-10">
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent className="bg-white/10 border-white/20 backdrop-blur-md">
                      {Object.entries(channelLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="text-white focus:bg-white/20">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-white/50">Select the platform or method used for this conversation</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session_notes" className="text-white/90 font-medium">Session Notes</Label>
                  <Textarea
                    id="session_notes"
                    value={sessionFormData.notes}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, notes: e.target.value })}
                    placeholder="Record key points, outcomes, or next steps from this conversation..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[120px]"
                    rows={6}
                  />
                  <p className="text-xs text-white/50">Capture important details, agreements, or action items from this conversation</p>
                </div>
              </div>
              </div>
              <DialogFooter className="flex-shrink-0 gap-3 px-6 py-4 border-t border-white/20 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSessionDialogOpen(false)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-9 px-6"
                >
                  <Save className="h-4 w-4 mr-2 text-white/70" />
                  Save Session
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Note Dialog */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent className="bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border-white/20 text-white sm:max-w-2xl p-0 [&>div]:!flex [&>div]:!flex-col [&>div]:!h-full">
            <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-white/20">
              <DialogHeader>
                <DialogTitle className="text-white text-2xl font-semibold">Add Note</DialogTitle>
                <DialogDescription className="text-white/70 mt-1">
                  Record important information, updates, or observations about this lead
                </DialogDescription>
              </DialogHeader>
            </div>
            <form onSubmit={handleSaveNote} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="note_content" className="text-white/90 font-medium">Note Content *</Label>
                <Textarea
                  id="note_content"
                  value={noteFormData.content}
                  onChange={(e) => setNoteFormData({ ...noteFormData, content: e.target.value })}
                  placeholder="Enter your note here... Be specific and include relevant details, dates, or action items."
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[150px]"
                  rows={8}
                  required
                />
                <p className="text-xs text-white/50">Notes are timestamped and linked to your account for tracking</p>
              </div>
              </div>
              <DialogFooter className="flex-shrink-0 gap-3 px-6 py-4 border-t border-white/20 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNoteDialogOpen(false)}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-white/20 border-white/30 text-white hover:bg-white/30 h-9 px-6"
                >
                  <Save className="h-4 w-4 mr-2 text-white/70" />
                  Save Note
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
