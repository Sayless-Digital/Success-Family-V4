import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { TopUpBonusCheckbox } from '@/components/topup-bonus-checkbox'
import { DateTimeInput } from '@/components/datetime-input'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import React from 'react'

async function getSettings() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('platform_settings').select('*').eq('id', 1).single()
  return data ?? { 
    id: 1, 
    buy_price_per_point: 1.0, 
    user_value_per_point: 1.0,
    stream_start_cost: 1,
    stream_join_cost: 1,
    storage_purchase_price_per_gb: 10,
    storage_monthly_cost_per_gb: 4,
    payout_minimum_ttd: 100,
    mandatory_topup_ttd: 50,
    referral_bonus_points: 20,
    referral_max_topups: 3,
    topup_bonus_enabled: false,
    topup_bonus_points: 0,
    topup_bonus_end_time: null,
  }
}

export default async function AdminSettingsPage() {
  const settings = await getSettings()
  const buy = Number(settings.buy_price_per_point || 0)
  const userValue = Number(settings.user_value_per_point || 0)
  const profitPerPoint = buy - userValue
  const marginPct = buy > 0 ? (profitPerPoint / buy) * 100 : 0

  async function updateSettings(formData: FormData) {
    'use server'
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') {
      throw new Error('Unauthorized')
    }

    const buyPrice = Number(formData.get('buy_price_per_point'))
    const userValue = Number(formData.get('user_value_per_point'))
    const streamStartCost = Number(formData.get('stream_start_cost'))
    const streamJoinCost = Number(formData.get('stream_join_cost'))
    const storagePurchasePrice = Number(formData.get('storage_purchase_price_per_gb'))
    const storageMonthlyCost = Number(formData.get('storage_monthly_cost_per_gb'))
    const payoutMinimum = Number(formData.get('payout_minimum_ttd'))
    const mandatoryTopup = Number(formData.get('mandatory_topup_ttd'))
    const referralBonusPoints = Number(formData.get('referral_bonus_points'))
    const referralMaxTopups = Number(formData.get('referral_max_topups'))
    // Checkbox returns 'on' when checked, null when unchecked
    const topupBonusEnabled = formData.get('topup_bonus_enabled') === 'on'
    const topupBonusPoints = Number(formData.get('topup_bonus_points'))
    const topupBonusEndTimeStr = formData.get('topup_bonus_end_time') as string | null
    // Convert datetime-local (local time) to ISO string (UTC)
    const topupBonusEndTime = topupBonusEndTimeStr && topupBonusEndTimeStr.trim() 
      ? new Date(topupBonusEndTimeStr).toISOString() 
      : null

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      throw new Error('Invalid buy price per point')
    }
    if (!Number.isFinite(userValue) || userValue <= 0) {
      throw new Error('Invalid user value per point')
    }
    if (!Number.isFinite(streamStartCost) || streamStartCost < 0) {
      throw new Error('Invalid stream start cost')
    }
    if (!Number.isFinite(streamJoinCost) || streamJoinCost < 0) {
      throw new Error('Invalid stream join cost')
    }
    if (!Number.isFinite(storagePurchasePrice) || storagePurchasePrice < 0) {
      throw new Error('Invalid storage purchase price')
    }
    if (!Number.isFinite(storageMonthlyCost) || storageMonthlyCost < 0) {
      throw new Error('Invalid storage monthly cost')
    }
    if (!Number.isFinite(payoutMinimum) || payoutMinimum <= 0) {
      throw new Error('Invalid payout minimum')
    }
    if (!Number.isFinite(mandatoryTopup) || mandatoryTopup <= 0) {
      throw new Error('Invalid mandatory top-up')
    }
    if (!Number.isFinite(referralBonusPoints) || referralBonusPoints < 0) {
      throw new Error('Invalid referral bonus points')
    }
    if (!Number.isFinite(referralMaxTopups) || referralMaxTopups < 1) {
      throw new Error('Invalid referral max top-ups')
    }
    if (!Number.isFinite(topupBonusPoints) || topupBonusPoints < 0) {
      throw new Error('Invalid top-up bonus points')
    }

    const { error } = await supabase
      .from('platform_settings')
      .upsert({ 
        id: 1, 
        buy_price_per_point: buyPrice, 
        user_value_per_point: userValue,
        stream_start_cost: Math.floor(streamStartCost),
        stream_join_cost: Math.floor(streamJoinCost),
        storage_purchase_price_per_gb: Math.floor(storagePurchasePrice),
        storage_monthly_cost_per_gb: Math.floor(storageMonthlyCost),
        payout_minimum_ttd: payoutMinimum,
        mandatory_topup_ttd: mandatoryTopup,
        referral_bonus_points: Math.floor(referralBonusPoints),
        referral_max_topups: Math.floor(referralMaxTopups),
        topup_bonus_enabled: topupBonusEnabled,
        topup_bonus_points: Math.floor(topupBonusPoints),
        topup_bonus_end_time: topupBonusEndTime,
      })

    if (error) {
      throw new Error(`Failed to save settings: ${error.message}`)
    }

    // Revalidate the page to show updated settings
    revalidatePath('/admin/settings')
    redirect('/admin/settings?success=1')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Settings" subtitle="Configure point pricing, payouts, and stream costs." />
      <form action={updateSettings} className="space-y-6 max-w-xl">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white/90">Point Pricing</h3>
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

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white/90">Stream Pricing</h3>
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

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white/90">Storage Pricing</h3>
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

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white/90">Payouts & Wallet</h3>
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
              defaultValue={settings.mandatory_topup_ttd ?? 50}
            />
            <p className="text-white/60 text-xs">
              Users must top up at least this amount every month. Reminders are scheduled automatically.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white/90">Referral Program</h3>
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

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white/90">Top-Up Bonus</h3>
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

        <Button type="submit" className="bg-white/10 text-white/80 hover:bg-white/20">Save Settings</Button>
      </form>
    </div>
  )
}


