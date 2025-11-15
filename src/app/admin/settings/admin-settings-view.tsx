"use client"

import React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TopUpBonusCheckbox } from '@/components/topup-bonus-checkbox'
import { DateTimeInput } from '@/components/datetime-input'
import { DollarSign, Video, HardDrive, Wallet, Users, Gift, UserPlus, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

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
  }
  communities: Array<{
    id: string
    name: string
    slug: string
  }>
  updateSettings: (formData: FormData) => Promise<{ success: boolean }>
}

export default function AdminSettingsView({ settings, communities, updateSettings }: AdminSettingsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const formRef = React.useRef<HTMLFormElement>(null)
  const [autoJoinCommunityId, setAutoJoinCommunityId] = React.useState(settings.auto_join_community_id || 'none')
  const [isSaving, setIsSaving] = React.useState(false)
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

  // Draggable scroll handlers
  React.useEffect(() => {
    const element = tabsListRef.current
    if (!element) return

    element.style.cursor = 'grab'

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = false
      startXRef.current = e.pageX - element.offsetLeft
      scrollLeftRef.current = element.scrollLeft
      element.style.userSelect = 'none'
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!element || startXRef.current === null) return
      
      const x = e.pageX - element.offsetLeft
      const walk = x - startXRef.current
      
      // Only start dragging if movement exceeds threshold
      if (Math.abs(walk) > dragThreshold) {
        isDraggingRef.current = true
        element.style.cursor = 'grabbing'
        e.preventDefault()
        element.scrollLeft = scrollLeftRef.current - walk * 2 // Scroll speed multiplier
      }
    }

    const handleMouseUp = () => {
      const wasDragging = isDraggingRef.current
      isDraggingRef.current = false
      startXRef.current = null
      if (!element) return
      element.style.cursor = 'grab'
      element.style.userSelect = ''
      
      // Prevent click if we were dragging
      if (wasDragging) {
        const handleClick = (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          element.removeEventListener('click', handleClick, true)
        }
        element.addEventListener('click', handleClick, true)
        setTimeout(() => {
          element.removeEventListener('click', handleClick, true)
        }, 100)
      }
    }

    const handleMouseLeave = () => {
      if (!element) return
      isDraggingRef.current = false
      startXRef.current = null
      element.style.cursor = 'grab'
      element.style.userSelect = ''
    }

    element.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    element.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      element.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      element.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

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
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 w-full">
        <TabsList
          ref={tabsListRef}
          className="w-full cursor-grab active:cursor-grabbing"
        >
          <TabsTrigger value="point-pricing" className="whitespace-nowrap snap-start">
            <DollarSign className="h-4 w-4 mr-2" />
            Point Pricing
          </TabsTrigger>
          <TabsTrigger value="stream-pricing" className="whitespace-nowrap snap-start">
            <Video className="h-4 w-4 mr-2" />
            Stream Pricing
          </TabsTrigger>
          <TabsTrigger value="storage-pricing" className="whitespace-nowrap snap-start">
            <HardDrive className="h-4 w-4 mr-2" />
            Storage Pricing
          </TabsTrigger>
          <TabsTrigger value="payouts-wallet" className="whitespace-nowrap snap-start">
            <Wallet className="h-4 w-4 mr-2" />
            Payouts & Wallet
          </TabsTrigger>
          <TabsTrigger value="referral" className="whitespace-nowrap snap-start">
            <Users className="h-4 w-4 mr-2" />
            Referral Program
          </TabsTrigger>
          <TabsTrigger value="topup-bonus" className="whitespace-nowrap snap-start">
            <Gift className="h-4 w-4 mr-2" />
            Top-Up Bonus
          </TabsTrigger>
          <TabsTrigger value="user-onboarding" className="whitespace-nowrap snap-start">
            <UserPlus className="h-4 w-4 mr-2" />
            User Onboarding
          </TabsTrigger>
        </TabsList>

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
      </Tabs>

      <div className="pt-4 max-w-xl">
        <Button 
          type="submit" 
          disabled={isSaving}
          className="bg-white/10 text-white/80 hover:bg-white/20 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </form>
  )
}
