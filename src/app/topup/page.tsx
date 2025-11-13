import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { TopUpPageView } from './topup-view'

export default async function TopUpPage({
  searchParams,
}: {
  searchParams: { returnUrl?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  // Fetch banks and platform settings
  const [
    { data: banks },
    { data: settings }
  ] = await Promise.all([
    supabase
      .from('bank_accounts')
      .select('id, account_name, bank_name, account_number, account_type')
      .eq('is_active', true)
      .is('community_id', null),
    supabase
      .from('platform_settings')
      .select('mandatory_topup_ttd, buy_price_per_point')
      .eq('id', 1)
      .maybeSingle()
  ])

  const returnUrl = searchParams.returnUrl || '/communities'

  return (
    <TopUpPageView
      banks={banks || []}
      mandatoryTopupTtd={settings?.mandatory_topup_ttd || 25}
      buyPricePerPoint={settings?.buy_price_per_point || 0.01}
      returnUrl={returnUrl}
    />
  )
}



