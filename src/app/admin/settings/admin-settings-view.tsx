"use client"

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TopUpBonusCheckbox } from '@/components/topup-bonus-checkbox'
import { DateTimeInput } from '@/components/datetime-input'
import { DollarSign, Video, HardDrive, Wallet, Users, Gift, UserPlus, Loader2, Snowflake, GraduationCap, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import type { HolidayMode } from '@/types/holiday'

interface AdminSettingsViewProps {
  settings: {
    id: number
    buy_price_per_point: number
    user_value_per_point: number
    stream_start_cost: number
    stream_join_cost: number
    storage_purchase_price_per_gb: number
    storage_monthly_cost_per_gb: number
    payout_minimum_ttd: number
    mandatory_topup_ttd: number
    referral_bonus_points: number
    referral_max_topups: number
    topup_bonus_enabled: boolean
    topup_bonus_points: number
    topup_bonus_end_time: string | null
    auto_join_community_id: string | null | 'none'
    holiday_mode: HolidayMode | null
    learn_page_video_id?: string | null
    learn_page_redirect_link?: string | null
  }
  communities: Array<{
    id: string
    name: string
    slug: string
  }>
  uploadedVideos: Array<{
    id: string
    title: string | null
    storage_url: string | null
    created_at: string
  }>
  updateSettings: (formData: FormData) => Promise<{ success: boolean }>
}

export default function AdminSettingsView({ settings, communities, uploadedVideos, updateSettings }: AdminSettingsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [autoJoinCommunityId, setAutoJoinCommunityId] = React.useState(settings.auto_join_community_id || 'none')
  const [holidayMode, setHolidayMode] = React.useState<HolidayMode>(settings.holiday_mode || 'none')
  const [learnPageVideoId, setLearnPageVideoId] = React.useState(settings.learn_page_video_id || 'none')
  const [isSaving, setIsSaving] = React.useState(false)
  const [uploadFile, setUploadFile] = React.useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = React.useState("")
  const [isUploading, setIsUploading] = React.useState(false)
  const [learnPageVideos, setLearnPageVideos] = React.useState(uploadedVideos)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const tabsListRef = React.useRef<HTMLDivElement>(null)
  const isDraggingRef = React.useRef(false)
  const startXRef = React.useRef<number | null>(null)
  const scrollLeftRef = React.useRef(0)
  const dragThreshold = 5 // Pixels to move before considering it a drag
  
  // Get active tab from URL params, default to 'point-pricing'
  const activeTab = searchParams.get('tab') || 'point-pricing'
  
  // Handle tab change
  const handleTabChange = (value: string) => {
    router.push(`/admin/settings?tab=${value}`)
  }

  // Sync form values from visible inputs to hidden inputs when inputs change
  // This ensures that when tabs are inactive, their values are preserved in hidden inputs
  React.useEffect(() => {
    if (!formRef.current) return
    
    const form = formRef.current
    
    // Sync function that reads from visible inputs and updates hidden inputs
    const syncHiddenInputs = () => {
      const fieldNames = [
        'buy_price_per_point',
        'user_value_per_point',
        'stream_start_cost',
        'stream_join_cost',
        'storage_purchase_price_per_gb',
        'storage_monthly_cost_per_gb',
        'payout_minimum_ttd',
        'mandatory_topup_ttd',
        'referral_bonus_points',
        'referral_max_topups',
        'topup_bonus_points',
        'topup_bonus_end_time',
      ]
      
      fieldNames.forEach((name) => {
        const visibleInput = form.querySelector(`input[name="${name}"]:not([type="hidden"])`) as HTMLInputElement | null
        const hiddenInput = form.querySelector(`input[name="${name}"][type="hidden"]`) as HTMLInputElement | null
        
        if (visibleInput && hiddenInput) {
          // Sync visible input value to hidden input
          hiddenInput.value = visibleInput.value || ''
        }
      })
      
      // Note: topup_bonus_enabled is handled by TopUpBonusCheckbox component itself
      // auto_join_community_id is handled via state and set directly in form submission
    }
    
    // Listen to input events to sync values in real-time
    const handleInput = () => {
      syncHiddenInputs()
    }
    
    // Also sync on blur to catch any values that might have been missed
    const handleBlur = (e: Event) => {
      if (e.target instanceof HTMLInputElement) {
        syncHiddenInputs()
      }
    }
    
    form.addEventListener('input', handleInput)
    form.addEventListener('change', handleInput)
    form.addEventListener('blur', handleBlur, true) // Use capture phase to catch all blur events
    
    // Initial sync
    syncHiddenInputs()
    
    return () => {
      form.removeEventListener('input', handleInput)
      form.removeEventListener('change', handleInput)
      form.removeEventListener('blur', handleBlur, true)
    }
  }, [activeTab]) // Re-sync when tab changes to ensure hidden inputs are up to date

  // Handle form submission - collect values from all inputs
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!formRef.current || isSaving) return

    setIsSaving(true)

    try {
      const form = formRef.current
      
      // Final sync - ensure all visible inputs are synced to hidden inputs before reading
      const fieldNames = [
        'buy_price_per_point',
        'user_value_per_point',
        'stream_start_cost',
        'stream_join_cost',
        'storage_purchase_price_per_gb',
        'storage_monthly_cost_per_gb',
        'payout_minimum_ttd',
        'mandatory_topup_ttd',
        'referral_bonus_points',
        'referral_max_topups',
        'topup_bonus_points',
        'topup_bonus_end_time',
      ]
      
      fieldNames.forEach((name) => {
        const visibleInput = form.querySelector(`input[name="${name}"]:not([type="hidden"])`) as HTMLInputElement | null
        const hiddenInput = form.querySelector(`input[name="${name}"][type="hidden"]`) as HTMLInputElement | null
        
        if (visibleInput && hiddenInput) {
          hiddenInput.value = visibleInput.value || ''
        }
      })
      
      const formData = new FormData()
      
      // Helper to get value - prefer visible input, fallback to hidden input
      const getValue = (name: string): string => {
        // First, try to find a visible input (text, number, etc.)
        const visibleInput = form.querySelector(`input[name="${name}"]:not([type="hidden"])`) as HTMLInputElement | null
        if (visibleInput) {
          if (visibleInput.type === 'checkbox') {
            return visibleInput.checked ? 'on' : ''
          }
          return visibleInput.value || ''
        }
        
        // If no visible input, check for hidden inputs (fallback for inactive tabs)
        const hiddenInput = form.querySelector(`input[name="${name}"][type="hidden"]`) as HTMLInputElement | null
        if (hiddenInput) {
          return hiddenInput.value || ''
        }
        
        return ''
      }

      // Collect all field values
      formData.set('buy_price_per_point', getValue('buy_price_per_point'))
      formData.set('user_value_per_point', getValue('user_value_per_point'))
      formData.set('stream_start_cost', getValue('stream_start_cost'))
      formData.set('stream_join_cost', getValue('stream_join_cost'))
      formData.set('storage_purchase_price_per_gb', getValue('storage_purchase_price_per_gb'))
      formData.set('storage_monthly_cost_per_gb', getValue('storage_monthly_cost_per_gb'))
      formData.set('payout_minimum_ttd', getValue('payout_minimum_ttd'))
      formData.set('mandatory_topup_ttd', getValue('mandatory_topup_ttd'))
      formData.set('referral_bonus_points', getValue('referral_bonus_points'))
      formData.set('referral_max_topups', getValue('referral_max_topups'))
      formData.set('topup_bonus_enabled', getValue('topup_bonus_enabled'))
      formData.set('topup_bonus_points', getValue('topup_bonus_points'))
      formData.set('topup_bonus_end_time', getValue('topup_bonus_end_time'))
      formData.set('auto_join_community_id', autoJoinCommunityId === 'none' ? '' : autoJoinCommunityId)
      formData.set('holiday_mode', holidayMode)
      formData.set('learn_page_video_id', learnPageVideoId === 'none' ? '' : learnPageVideoId)
      formData.set('learn_page_redirect_link', getValue('learn_page_redirect_link'))

      await updateSettings(formData)
      toast.success('Settings saved successfully!')
    } catch (error) {
      console.error('Error saving settings:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings'
      toast.error(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }


  const buy = Number(settings.buy_price_per_point || 0)
  const userValue = Number(settings.user_value_per_point || 0)
  const profitPerPoint = buy - userValue
  const marginPct = buy > 0 ? (profitPerPoint / buy) * 100 : 0

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Hidden inputs to ensure all fields are submitted even when tabs are not active */}
      {/* These serve as defaults - visible inputs will override them if they exist */}
      <div className="hidden">
        <input type="hidden" name="buy_price_per_point" defaultValue={settings.buy_price_per_point} />
        <input type="hidden" name="user_value_per_point" defaultValue={settings.user_value_per_point} />
        <input type="hidden" name="stream_start_cost" defaultValue={settings.stream_start_cost || 1} />
        <input type="hidden" name="stream_join_cost" defaultValue={settings.stream_join_cost || 1} />
        <input type="hidden" name="storage_purchase_price_per_gb" defaultValue={settings.storage_purchase_price_per_gb ?? 10} />
        <input type="hidden" name="storage_monthly_cost_per_gb" defaultValue={settings.storage_monthly_cost_per_gb ?? 4} />
        <input type="hidden" name="payout_minimum_ttd" defaultValue={settings.payout_minimum_ttd ?? 100} />
        <input type="hidden" name="mandatory_topup_ttd" defaultValue={settings.mandatory_topup_ttd ?? 150} />
        <input type="hidden" name="referral_bonus_points" defaultValue={settings.referral_bonus_points ?? 20} />
        <input type="hidden" name="referral_max_topups" defaultValue={settings.referral_max_topups ?? 3} />
        <input type="hidden" name="topup_bonus_enabled" defaultValue={settings.topup_bonus_enabled ? 'on' : ''} />
        <input type="hidden" name="topup_bonus_points" defaultValue={settings.topup_bonus_points ?? 0} />
        <input type="hidden" name="topup_bonus_end_time" defaultValue={settings.topup_bonus_end_time ? (() => {
          const date = new Date(settings.topup_bonus_end_time)
          const year = date.getFullYear()
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          return `${year}-${month}-${day}T${hours}:${minutes}`
        })() : ''} />
        <input type="hidden" name="auto_join_community_id" defaultValue={autoJoinCommunityId === 'none' ? '' : autoJoinCommunityId} />
        <input type="hidden" name="holiday_mode" defaultValue={settings.holiday_mode || 'none'} />
        <input type="hidden" name="learn_page_video_id" defaultValue={learnPageVideoId === 'none' ? '' : learnPageVideoId} />
        <input type="hidden" name="learn_page_redirect_link" defaultValue={settings.learn_page_redirect_link || ''} />
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6 w-full">
        {/* Vertical Sidebar Menu */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white/10 border border-white/20 rounded-lg backdrop-blur-md p-2 space-y-1">
            {/* Save Button */}
            <Button 
              type="submit" 
              disabled={isSaving}
              className="w-full bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-50 mb-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
            <button
              onClick={() => handleTabChange("point-pricing")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "point-pricing"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <DollarSign className="h-4 w-4 flex-shrink-0" />
              <span>Point Pricing</span>
            </button>
            <button
              onClick={() => handleTabChange("stream-pricing")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "stream-pricing"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Video className="h-4 w-4 flex-shrink-0" />
              <span>Stream Pricing</span>
            </button>
            <button
              onClick={() => handleTabChange("storage-pricing")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "storage-pricing"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <HardDrive className="h-4 w-4 flex-shrink-0" />
              <span>Storage Pricing</span>
            </button>
            <button
              onClick={() => handleTabChange("payouts-wallet")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "payouts-wallet"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Wallet className="h-4 w-4 flex-shrink-0" />
              <span>Payouts & Wallet</span>
            </button>
            <button
              onClick={() => handleTabChange("referral")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "referral"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Users className="h-4 w-4 flex-shrink-0" />
              <span>Referral Program</span>
            </button>
            <button
              onClick={() => handleTabChange("topup-bonus")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "topup-bonus"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Gift className="h-4 w-4 flex-shrink-0" />
              <span>Top-Up Bonus</span>
            </button>
            <button
              onClick={() => handleTabChange("user-onboarding")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "user-onboarding"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <UserPlus className="h-4 w-4 flex-shrink-0" />
              <span>User Onboarding</span>
            </button>
            <button
              onClick={() => handleTabChange("holiday-mode")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "holiday-mode"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <Snowflake className="h-4 w-4 flex-shrink-0" />
              <span>Holiday Mode</span>
            </button>
            <button
              onClick={() => handleTabChange("learn-page")}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors text-left",
                activeTab === "learn-page"
                  ? "bg-white/20 text-white"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              )}
            >
              <GraduationCap className="h-4 w-4 flex-shrink-0" />
              <span>Learn Page</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">

        <TabsContent value="point-pricing" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="buy_price_per_point" className="text-white/80">TTD per Point (Buy Price)</Label>
              <Input id="buy_price_per_point" name="buy_price_per_point" type="number" step="0.01" min="0.01" defaultValue={settings.buy_price_per_point} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user_value_per_point" className="text-white/80">TTD Value per Point (User Value)</Label>
              <Input id="user_value_per_point" name="user_value_per_point" type="number" step="0.01" min="0.01" defaultValue={settings.user_value_per_point} />
            </div>
            <div className="rounded-lg bg-white/10 border border-white/20 p-4 space-y-1">
              <div className="text-white/80 text-sm">Profit per point</div>
              <div className="text-white text-lg font-medium">TTD ${profitPerPoint.toFixed(2)}</div>
              <div className="text-white/80 text-sm">Profit margin</div>
              <div className="text-white text-lg font-medium">{marginPct.toFixed(2)}%</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stream-pricing" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="stream_start_cost" className="text-white/80">Points to Create Stream (goes to platform)</Label>
              <Input id="stream_start_cost" name="stream_start_cost" type="number" step="1" min="0" defaultValue={settings.stream_start_cost || 1} />
              <p className="text-white/60 text-xs">Charged upfront when owner schedules an event. Refunded if event is cancelled.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stream_join_cost" className="text-white/80">Points to Join Stream (goes to event owner)</Label>
              <Input id="stream_join_cost" name="stream_join_cost" type="number" step="1" min="0" defaultValue={settings.stream_join_cost || 1} />
              <p className="text-white/60 text-xs">Charged upfront when users register for an event. Refunded if user cancels or event is cancelled.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="storage-pricing" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storage_purchase_price_per_gb" className="text-white/80">Storage Purchase Price (points per GB)</Label>
              <Input id="storage_purchase_price_per_gb" name="storage_purchase_price_per_gb" type="number" step="1" min="0" defaultValue={settings.storage_purchase_price_per_gb ?? 10} />
              <p className="text-white/60 text-xs">One-time purchase price per GB to increase storage limit.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="storage_monthly_cost_per_gb" className="text-white/80">Storage Monthly Cost (points per GB)</Label>
              <Input id="storage_monthly_cost_per_gb" name="storage_monthly_cost_per_gb" type="number" step="1" min="0" defaultValue={settings.storage_monthly_cost_per_gb ?? 4} />
              <p className="text-white/60 text-xs">Monthly cost per GB for storage used over 1 GB free tier. Charged on the 1st of each month.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payouts-wallet" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payout_minimum_ttd" className="text-white/80">Minimum Payout (TTD)</Label>
              <Input
                id="payout_minimum_ttd"
                name="payout_minimum_ttd"
                type="number"
                step="0.01"
                min="1"
                defaultValue={settings.payout_minimum_ttd ?? 100}
              />
              <p className="text-white/60 text-xs">
                Payouts are generated on the 1st only when a creator&apos;s confirmed earnings exceed this amount.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mandatory_topup_ttd" className="text-white/80">Mandatory Monthly Top-Up (TTD)</Label>
              <Input
                id="mandatory_topup_ttd"
                name="mandatory_topup_ttd"
                type="number"
                step="0.01"
                min="1"
                defaultValue={settings.mandatory_topup_ttd ?? 150}
              />
              <p className="text-white/60 text-xs">
                Users must top up at least this amount every month. Reminders are scheduled automatically.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="referral" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="referral_bonus_points" className="text-white/80">Referral Bonus Points</Label>
              <Input
                id="referral_bonus_points"
                name="referral_bonus_points"
                type="number"
                step="1"
                min="0"
                defaultValue={settings.referral_bonus_points ?? 20}
              />
              <p className="text-white/60 text-xs">
                Points awarded to the referrer when a referred user tops up.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="referral_max_topups" className="text-white/80">Maximum Top-Ups for Bonus</Label>
              <Input
                id="referral_max_topups"
                name="referral_max_topups"
                type="number"
                step="1"
                min="1"
                defaultValue={settings.referral_max_topups ?? 3}
              />
              <p className="text-white/60 text-xs">
                Maximum number of top-ups per referral that generate bonus points for the referrer.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="topup-bonus" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <TopUpBonusCheckbox defaultChecked={settings.topup_bonus_enabled ?? false} />
                <Label htmlFor="topup_bonus_enabled" className="text-white/80 cursor-pointer">
                  Enable Top-Up Bonus
                </Label>
              </div>
              <p className="text-white/60 text-xs">
                When enabled, users will receive bonus points on any top-up within the expiration timeframe. The referral dropdown will be hidden during signup.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topup_bonus_points" className="text-white/80">Bonus Points</Label>
              <Input
                id="topup_bonus_points"
                name="topup_bonus_points"
                type="number"
                step="1"
                min="0"
                defaultValue={settings.topup_bonus_points ?? 0}
              />
              <p className="text-white/60 text-xs">
                Fixed number of bonus points awarded on any top-up within the expiration timeframe. Cost is calculated using user value per point.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topup_bonus_end_time" className="text-white/80">Expiration Time (Optional)</Label>
              <DateTimeInput
                id="topup_bonus_end_time"
                name="topup_bonus_end_time"
                defaultValue={settings.topup_bonus_end_time ? (() => {
                  const date = new Date(settings.topup_bonus_end_time)
                  const year = date.getFullYear()
                  const month = String(date.getMonth() + 1).padStart(2, '0')
                  const day = String(date.getDate()).padStart(2, '0')
                  const hours = String(date.getHours()).padStart(2, '0')
                  const minutes = String(date.getMinutes()).padStart(2, '0')
                  return `${year}-${month}-${day}T${hours}:${minutes}`
                })() : ''}
              />
              <p className="text-white/60 text-xs">
                When the bonus automatically expires. Leave empty for no expiration. If expiration is today, users will see "Today Only" badge and the expiration time.
              </p>
            </div>
            {settings.topup_bonus_enabled && settings.topup_bonus_points > 0 && (
              <div className="rounded-lg bg-white/10 border border-white/20 p-4 space-y-1">
                <div className="text-white/80 text-sm">Bonus Cost per User</div>
                <div className="text-white text-lg font-medium">
                  TTD ${(Number(settings.user_value_per_point || 0) * Number(settings.topup_bonus_points || 0)).toFixed(2)}
                </div>
                <div className="text-white/60 text-xs">
                  Calculated as: {settings.topup_bonus_points} points × ${Number(settings.user_value_per_point || 0).toFixed(2)} per point
                </div>
                {settings.topup_bonus_end_time && (
                  <div className="text-white/60 text-xs pt-2 border-t border-white/20 mt-2">
                    Expires: {new Date(settings.topup_bonus_end_time).toLocaleString(undefined, { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="user-onboarding" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auto_join_community_id" className="text-white/80">Auto-Join Community</Label>
              <Select
                value={autoJoinCommunityId}
                onValueChange={(value) => {
                  setAutoJoinCommunityId(value)
                  // Update the hidden input when value changes
                  const hiddenInput = document.querySelector('input[name="auto_join_community_id"]') as HTMLInputElement
                  if (hiddenInput) {
                    hiddenInput.value = value === 'none' ? '' : value
                  }
                }}
              >
                <SelectTrigger id="auto_join_community_id" className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select a community (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - Don't auto-join</SelectItem>
                  {communities.map((community) => (
                    <SelectItem key={community.id} value={community.id}>
                      {community.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-white/60 text-xs">
                Users who sign up will automatically be joined to this community. Select "None" to disable auto-join.
              </p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="holiday-mode" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="holiday_mode" className="text-white/80">Holiday Theme</Label>
              <Select
                value={holidayMode}
                onValueChange={(value: HolidayMode) => {
                  setHolidayMode(value)
                  const hiddenInput = document.querySelector('input[name="holiday_mode"]') as HTMLInputElement
                  if (hiddenInput) {
                    hiddenInput.value = value
                  }
                }}
              >
                <SelectTrigger id="holiday_mode" className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select a holiday theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Off - No holiday theme</SelectItem>
                  <SelectItem value="christmas">Christmas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-white/60 text-xs">
                Toggle seasonal experiences like snow, lights, and Santa hats across the platform with a single setting.
              </p>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="learn-page" className="space-y-6 max-w-xl">
          <div className="space-y-4">
            {/* Video Upload Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/80">Upload New Video</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && !file.type.startsWith("video/")) {
                      toast.error("Please select a video file")
                      e.target.value = ""
                      return
                    }
                    setUploadFile(file ?? null)
                    if (file && !uploadTitle) {
                      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""))
                    }
                  }}
                  className="hidden"
                  disabled={isUploading}
                />
                
                {uploadFile ? (
                  <div className="rounded-lg border border-white/20 bg-white/10 p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 rounded-md bg-white/10 p-2.5 border border-white/20">
                        <Video className="h-5 w-5 text-white/80" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white/90 truncate">
                            {uploadFile.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadFile(null)
                              setUploadTitle("")
                              if (fileInputRef.current) {
                                fileInputRef.current.value = ""
                              }
                            }}
                            className="flex-shrink-0 p-1 rounded-md hover:bg-white/10 transition-colors"
                            aria-label="Remove file"
                            disabled={isUploading}
                          >
                            <X className="h-4 w-4 text-white/70 hover:text-white/90" />
                          </button>
                        </div>
                        <p className="text-xs text-white/60 mt-1">
                          {(() => {
                            const bytes = uploadFile.size
                            if (bytes === 0) return '0 Bytes'
                            const k = 1024
                            const sizes = ['Bytes', 'KB', 'MB', 'GB']
                            const i = Math.floor(Math.log(bytes) / Math.log(k))
                            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
                          })()} • Video
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-white/20">
                      <Label htmlFor="upload_title" className="text-white/80 text-xs">Video Title (Optional)</Label>
                      <Input
                        id="upload_title"
                        type="text"
                        placeholder="Enter video title"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        disabled={isUploading}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-9"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={async () => {
                        if (!uploadFile) return
                        setIsUploading(true)
                        try {
                          const formData = new FormData()
                          formData.append("file", uploadFile)
                          if (uploadTitle.trim()) {
                            formData.append("title", uploadTitle.trim())
                          }

                          const response = await fetch("/api/videos/upload-learn-page", {
                            method: "POST",
                            body: formData,
                          })

                          const data = await response.json()

                          if (!response.ok) {
                            throw new Error(data.error || "Failed to upload video")
                          }

                          toast.success("Video uploaded successfully!")
                          
                          // Refresh video list
                          const refreshResponse = await fetch("/api/admin/learn-page-videos")
                          if (refreshResponse.ok) {
                            const videos = await refreshResponse.json()
                            setLearnPageVideos(videos)
                          }

                          // Reset form
                          setUploadFile(null)
                          setUploadTitle("")
                          if (fileInputRef.current) {
                            fileInputRef.current.value = ""
                          }

                          // Optionally select the newly uploaded video
                          if (data.video?.id) {
                            setLearnPageVideoId(data.video.id)
                            const hiddenInput = document.querySelector('input[name="learn_page_video_id"]') as HTMLInputElement
                            if (hiddenInput) {
                              hiddenInput.value = data.video.id
                            }
                          }
                        } catch (error) {
                          console.error("Upload error:", error)
                          toast.error(error instanceof Error ? error.message : "Failed to upload video")
                        } finally {
                          setIsUploading(false)
                        }
                      }}
                      disabled={isUploading}
                      className="w-full bg-white/10 text-white hover:bg-white/20 border border-white/20"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin text-white/80" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2 text-white/80" />
                          Upload Video
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={cn(
                      "w-full rounded-lg border-2 border-dashed border-white/30 bg-white/5 p-6 transition-all",
                      "hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0",
                      "flex flex-col items-center justify-center gap-3 cursor-pointer group",
                      isUploading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="rounded-full bg-white/10 p-3 border border-white/20 group-hover:bg-white/20 group-hover:border-white/30 transition-colors">
                      <Upload className="h-6 w-6 text-white/70 group-hover:text-white/90" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white/90 mb-1">
                        Click to upload video
                      </p>
                      <p className="text-xs text-white/60">
                        MP4, WebM, MOV up to 500MB
                      </p>
                    </div>
                  </button>
                )}
                <p className="text-xs text-white/60">
                  Upload a video to display on the learn page.
                </p>
              </div>
            </div>

            {/* Video Selection */}
            <div className="space-y-2">
              <Label htmlFor="learn_page_video_id" className="text-white/80">Selected Learn Page Video</Label>
              <Select
                value={learnPageVideoId}
                onValueChange={(value) => {
                  setLearnPageVideoId(value)
                  const hiddenInput = document.querySelector('input[name="learn_page_video_id"]') as HTMLInputElement
                  if (hiddenInput) {
                    hiddenInput.value = value === 'none' ? '' : value
                  }
                }}
              >
                <SelectTrigger id="learn_page_video_id" className="bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Select a video (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None - No video</SelectItem>
                  {learnPageVideos.map((video) => (
                    <SelectItem key={video.id} value={video.id}>
                      {video.title || `Video ${new Date(video.created_at).toLocaleDateString()}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-white/60 text-xs">
                Select a video to display on the learn page. Upload videos using the form above.
              </p>
            </div>

            {/* Redirect Link */}
            <div className="space-y-2">
              <Label htmlFor="learn_page_redirect_link" className="text-white/80">WhatsApp Community Redirect Link</Label>
              <Input
                id="learn_page_redirect_link"
                name="learn_page_redirect_link"
                type="url"
                placeholder="https://chat.whatsapp.com/..."
                defaultValue={settings.learn_page_redirect_link || ''}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
              <p className="text-white/60 text-xs">
                Link to redirect users to after they sign up for the webinar. This will be used for the "Join WhatsApp Community" button and auto-redirect.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
        </div>
      </div>
    </form>
  )
}
