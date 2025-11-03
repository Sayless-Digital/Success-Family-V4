import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import React from 'react'

async function getSettings() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('platform_settings').select('*').eq('id', 1).single()
  return data ?? { 
    id: 1, 
    buy_price_per_point: 1.0, 
    user_value_per_point: 1.0,
    stream_start_cost: 1,
    stream_join_cost: 1
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
    if (!user) return

    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') return

    const buyPrice = Number(formData.get('buy_price_per_point'))
    const userValue = Number(formData.get('user_value_per_point'))
    const streamStartCost = Number(formData.get('stream_start_cost'))
    const streamJoinCost = Number(formData.get('stream_join_cost'))

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) return
    if (!Number.isFinite(userValue) || userValue <= 0) return
    if (!Number.isFinite(streamStartCost) || streamStartCost < 0) return
    if (!Number.isFinite(streamJoinCost) || streamJoinCost < 0) return

    await supabase
      .from('platform_settings')
      .upsert({ 
        id: 1, 
        buy_price_per_point: buyPrice, 
        user_value_per_point: userValue,
        stream_start_cost: Math.floor(streamStartCost),
        stream_join_cost: Math.floor(streamJoinCost)
      })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Settings" subtitle="Configure point pricing and stream costs." />
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

        <Button type="submit" className="bg-white/10 text-white/80 hover:bg-white/20">Save Settings</Button>
      </form>
    </div>
  )
}


