import { createServerSupabaseClient } from '@/lib/supabase-server'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import React from 'react'

async function getSettings() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('platform_settings').select('*').eq('id', 1).single()
  return data ?? { id: 1, buy_price_per_point: 1.0, user_value_per_point: 1.0 }
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

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) return
    if (!Number.isFinite(userValue) || userValue <= 0) return

    await supabase
      .from('platform_settings')
      .upsert({ id: 1, buy_price_per_point: buyPrice, user_value_per_point: userValue })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Settings" description="Configure point pricing and value." />
      <form action={updateSettings} className="space-y-6 max-w-xl">
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
        <Button type="submit" className="bg-white/10 text-white/80 hover:bg-white/20">Save Settings</Button>
      </form>
    </div>
  )
}


