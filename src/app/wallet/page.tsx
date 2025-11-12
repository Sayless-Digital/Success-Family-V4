import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PageHeader } from '@/components/ui/page-header'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import { WalletView } from './wallet-view'

const TRANSACTION_PAGE_SIZE = 20

async function getWalletData(userId: string) {
  const supabase = await createServerSupabaseClient()

  // Ensure wallet exists for user (creates if missing)
  await supabase.rpc('ensure_wallet_exists', {
    p_user_id: userId,
  })

  // Release any matured earnings before loading balances
  await supabase.rpc('process_matured_earnings', {
    p_user_id: userId,
    p_limit: 200,
  })

  const [
    { data: wallet },
    { data: banks },
    { data: transactions, error: txError },
    { data: settings },
    { data: earningsLedger },
    { data: payouts },
  ] = await Promise.all([
    supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('bank_accounts').select('id, account_name, bank_name, account_number, account_type').eq('is_active', true),
    supabase
      .from('transactions')
      .select('id, type, amount_ttd, points_delta, earnings_points_delta, receipt_url, status, created_at, recipient_user_id, sender_user_id, sender_name, recipient_name, context')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(TRANSACTION_PAGE_SIZE + 1),
    supabase
      .from('platform_settings')
      .select('buy_price_per_point, user_value_per_point, payout_minimum_ttd, mandatory_topup_ttd, topup_bonus_enabled, topup_bonus_points, topup_bonus_end_time')
      .eq('id', 1)
      .maybeSingle(),
    supabase
      .from('wallet_earnings_ledger')
      .select('id, source_type, source_id, community_id, points, amount_ttd, status, available_at, created_at, metadata')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('payouts')
      .select('id, points, amount_ttd, status, scheduled_for, created_at, processed_at, processed_by, transaction_id, notes, locked_points')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])
  const txs = txError ? [] : (transactions ?? [])

  const hasMoreTransactions = txs.length > TRANSACTION_PAGE_SIZE
  const trimmedTransactions = hasMoreTransactions ? txs.slice(0, TRANSACTION_PAGE_SIZE) : txs
  
  // Names are now stored directly in the transaction table, so we don't need to fetch them separately
  // Only need to create signed URLs for receipts
  const signed = await Promise.all(
    trimmedTransactions.map(async (t: any) => {
      if (!t.receipt_url) return { ...t, signed_url: null }
      const { data: signedUrl } = await supabase.storage.from('receipts').createSignedUrl(t.receipt_url, 600)
      return { ...t, signed_url: signedUrl?.signedUrl || null }
    })
  )

  return {
    wallet,
    banks: banks ?? [],
    transactions: signed,
    transactionsHasMore: hasMoreTransactions,
    settings,
    earningsLedger: earningsLedger ?? [],
    payouts: payouts ?? [],
    hasCompletedFirstTopup: wallet?.has_completed_first_topup ?? false,
  }
}

async function submitReceiptAction(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const amount = Number(formData.get('amount_ttd'))
  const bankAccountId = String(formData.get('bank_account_id') || '')
  const file = formData.get('file') as File | null

  const { data: settings } = await supabase
    .from('platform_settings')
    .select('buy_price_per_point, mandatory_topup_ttd')
    .eq('id', 1)
    .maybeSingle()

  const minimumTopup = Number(settings?.mandatory_topup_ttd ?? 50)

  if (!Number.isFinite(amount) || amount < minimumTopup) {
    throw new Error(`Minimum top up is ${minimumTopup.toFixed(2)} TTD`)
  }
  if (!bankAccountId) {
    throw new Error('Bank account is required')
  }
  if (!file) {
    throw new Error('Receipt file is required')
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = (file.name?.split('.').pop() || 'bin').toLowerCase()
  const filePath = `${user.id}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`)
  }

  // Pre-compute projected points for display while pending
  const buyPrice = Number(settings?.buy_price_per_point ?? 1)
  const projectedPoints = buyPrice > 0 ? Math.floor(amount / buyPrice) : 0

  const { error } = await supabase.from('transactions').insert({
    user_id: user.id,
    type: 'top_up',
    amount_ttd: amount,
    points_delta: projectedPoints, // Final wallet credit happens on verification
    status: 'pending',
    bank_account_id: bankAccountId,
    receipt_url: filePath,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/wallet')
  redirect('/wallet?success=receipt-submitted')
}

export default async function WalletPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/')
  }
  const { wallet, banks, transactions, transactionsHasMore, settings, earningsLedger, payouts, hasCompletedFirstTopup } = await getWalletData(user.id)
  
  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" subtitle="Manage your balance and top up via bank transfer." />
      <WalletView 
        initialWallet={wallet}
        initialBanks={banks}
        initialTransactions={transactions as any}
        initialTransactionsHasMore={transactionsHasMore}
        initialEarnings={earningsLedger as any}
        initialPayouts={payouts as any}
        buyPricePerPoint={Number(settings?.buy_price_per_point ?? 1)}
        userValuePerPoint={Number(settings?.user_value_per_point ?? 1)}
        payoutMinimumTtd={Number(settings?.payout_minimum_ttd ?? 100)}
        mandatoryTopupTtd={Number(settings?.mandatory_topup_ttd ?? 50)}
        topupBonusEnabled={settings?.topup_bonus_enabled ?? false}
        topupBonusPoints={Number(settings?.topup_bonus_points ?? 0)}
        topupBonusEndTime={settings?.topup_bonus_end_time ?? null}
        hasCompletedFirstTopup={hasCompletedFirstTopup}
        onSubmitAction={submitReceiptAction}
      />
    </div>
  )
}


