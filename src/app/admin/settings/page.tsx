import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PageHeader } from '@/components/ui/page-header'
import AdminSettingsView from './admin-settings-view'
import { revalidatePath } from 'next/cache'
import { HOLIDAY_MODES, type HolidayMode } from '@/types/holiday'

async function getSettings() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.from('platform_settings').select('*').eq('id', 1).single()
  const settings = data ?? { 
    id: 1, 
    buy_price_per_point: 1.0, 
    user_value_per_point: 1.0,
    stream_start_cost: 1,
    stream_join_cost: 1,
    storage_purchase_price_per_gb: 10,
    storage_monthly_cost_per_gb: 4,
    payout_minimum_ttd: 100,
    mandatory_topup_ttd: 150,
    referral_bonus_points: 20,
    referral_max_topups: 3,
    topup_bonus_enabled: false,
    topup_bonus_points: 0,
    topup_bonus_end_time: null,
    auto_join_community_id: null,
    holiday_mode: 'none',
  }
  
  // Convert null to 'none' for Select component (Select doesn't allow empty string values)
  return {
    ...settings,
    auto_join_community_id: settings.auto_join_community_id || 'none',
    holiday_mode: settings.holiday_mode || 'none',
  }
}

async function getCommunities() {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('communities')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('name', { ascending: true })
  return data || []
}

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
  const autoJoinCommunityIdStr = formData.get('auto_join_community_id') as string | null
  const autoJoinCommunityId = autoJoinCommunityIdStr && autoJoinCommunityIdStr.trim() 
    ? autoJoinCommunityIdStr 
    : null
  const holidayModeStr = (formData.get('holiday_mode') as string | null)?.trim().toLowerCase() || 'none'
  const holidayMode = HOLIDAY_MODES.includes(holidayModeStr as HolidayMode) ? (holidayModeStr as HolidayMode) : 'none'

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
      auto_join_community_id: autoJoinCommunityId,
      holiday_mode: holidayMode,
    })

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`)
  }

  // Revalidate the page to show updated settings
  revalidatePath('/admin/settings')
  
  return { success: true }
}

export default async function AdminSettingsPage() {
  const settings = await getSettings()
  const communities = await getCommunities()

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Settings" subtitle="Configure point pricing, payouts, and stream costs." />
      <AdminSettingsView settings={settings} communities={communities} updateSettings={updateSettings} />
    </div>
  )
}


