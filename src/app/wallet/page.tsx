import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PageHeader } from '@/components/ui/page-header'
// Removed Card container for transactions section per request
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CopyField } from '@/components/ui/copy-field'
import { TopUpAmount } from '@/components/ui/topup-amount'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomUUID } from 'crypto'
import { WalletSuccessToast } from '@/components/wallet-success-toast'

async function getWalletData(userId: string) {
  const supabase = await createServerSupabaseClient()
  const [{ data: wallet }, { data: banks }, { data: transactions, error: txError }, { data: settings }] = await Promise.all([
    supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('bank_accounts').select('id, account_name, bank_name, account_number, account_type').eq('is_active', true),
    supabase
      .from('transactions')
      .select('id, type, amount_ttd, points_delta, receipt_url, status, created_at, recipient_user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('platform_settings').select('buy_price_per_point, user_value_per_point').eq('id', 1).maybeSingle(),
  ])
  const txs = txError ? [] : (transactions ?? [])
  
  // Fetch recipient users for transactions that have recipients
  const recipientIds = Array.from(new Set(txs.map((t: any) => t.recipient_user_id).filter(Boolean)))
  let recipientMap: Record<string, { name: string; username?: string }> = {}
  if (recipientIds.length > 0) {
    const { data: recipients } = await supabase
      .from('users')
      .select('id, first_name, last_name, username')
      .in('id', recipientIds)
    
    if (recipients) {
      for (const r of recipients) {
        const fullName = r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : null
        const label = fullName || r.username || r.id
        recipientMap[r.id] = { name: label, username: r.username || undefined }
      }
    }
  }
  
  const signed = await Promise.all(
    txs.map(async (t: any) => {
      if (!t.receipt_url) return { ...t, signed_url: null, recipient_name: t.recipient_user_id ? recipientMap[t.recipient_user_id]?.name : null }
      const { data: signedUrl } = await supabase.storage.from('receipts').createSignedUrl(t.receipt_url, 600)
      return { ...t, signed_url: signedUrl?.signedUrl || null, recipient_name: t.recipient_user_id ? recipientMap[t.recipient_user_id]?.name : null }
    })
  )
  return { wallet, banks: banks ?? [], transactions: signed, settings }
}

async function submitReceiptAction(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const amount = Number(formData.get('amount_ttd'))
  const bankAccountId = String(formData.get('bank_account_id') || '')
  const file = formData.get('file') as File | null

  if (!Number.isFinite(amount) || amount < 50) {
    throw new Error('Minimum top up is 50 TTD')
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
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('buy_price_per_point')
    .eq('id', 1)
    .maybeSingle()

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
  if (!user) return null
  const { wallet, banks, transactions, settings } = await getWalletData(user.id)
  const renderStatus = (status: string) => {
    const s = (status || '').toLowerCase()
    const base = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium'
    const cls = s === 'verified'
      ? 'bg-white/20 text-white'
      : s === 'rejected'
        ? 'bg-white/10 text-white/60'
        : 'bg-white/10 text-white/80'
    const label = s.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
    return <span className={`${base} ${cls}`}>{label}</span>
  }

  const singleBank = banks.length === 1 ? banks[0] : null
  
  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" subtitle="Manage your balance and top up via bank transfer." />
      <WalletSuccessToast />

      {/* Balance row */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20">
        <div>
          <div className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Balance</div>
          <div className="text-3xl font-bold text-white">{Math.trunc(Number(wallet?.points_balance ?? 0))} <span className="text-xl font-medium text-white/60">pts</span></div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-white/10 text-white/80 hover:bg-white/20">Top Up</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Top Up Wallet</DialogTitle>
            </DialogHeader>
            <form action={submitReceiptAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="points" className="text-white/80">Points</Label>
                <TopUpAmount buyPricePerPoint={Number(settings?.buy_price_per_point ?? 1)} />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Bank Account</Label>
                {singleBank ? (
                  <>
                    <input type="hidden" name="bank_account_id" value={singleBank.id} />
                    <div className="rounded-md bg-white/10 p-3 space-y-2">
                      <div className="text-white/80 text-sm mb-1">{singleBank.bank_name}</div>
                      <CopyField label="Account Name" value={singleBank.account_name} />
                      <CopyField label="Account Number" value={singleBank.account_number} />
                      <CopyField label="Account Type" value={singleBank.account_type} />
                    </div>
                  </>
                ) : (
                  <Select name="bank_account_id" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="file" className="text-white/80">Receipt File</Label>
                <Input id="file" name="file" type="file" accept="image/*,application/pdf" required />
              </div>
              <DialogFooter className="w-full">
                <Button type="submit" className="w-full bg-white/10 text-white/80 hover:bg-white/20">Top Up</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bank details list for multiple accounts */}
      {banks.length > 1 && (
        <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4 space-y-4">
          <div className="text-white font-semibold text-lg">Bank Details</div>
          <div className="space-y-3">
            {banks.map((b: any) => (
              <div key={b.id} className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
                <div className="text-white font-medium text-base pb-2 border-b border-white/10">{b.bank_name}</div>
                <CopyField label="Account Name" value={b.account_name} />
                <CopyField label="Account Number" value={b.account_number} />
                <CopyField label="Account Type" value={b.account_type} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions */}
      <div className="space-y-4">
        <div className="text-white font-semibold text-lg">Transactions</div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-white/80">Date</TableHead>
                <TableHead className="text-white/80">Type</TableHead>
                <TableHead className="text-white/80">Status</TableHead>
                <TableHead className="text-white/80">TTD</TableHead>
                <TableHead className="text-white/80">Points</TableHead>
                <TableHead className="text-white/80">To</TableHead>
                <TableHead className="text-white/80">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="text-white/80">{new Date(t.created_at).toLocaleString()}</TableCell>
                  <TableCell className={`font-medium ${
                    t.type === 'point_spend' && t.points_delta < 0
                      ? 'text-green-400'
                      : t.type === 'point_refund' && t.points_delta > 0
                      ? 'text-red-400'
                      : 'text-white/80'
                  }`}>
                    {t.type.replaceAll('_', ' ').replace(/\b\w/g, (char: string) => char.toUpperCase())}
                  </TableCell>
                  <TableCell className="text-white/80">{renderStatus(t.status)}</TableCell>
                  <TableCell className="text-white/80">{t.amount_ttd ? Number(t.amount_ttd).toFixed(2) : '—'}</TableCell>
                  <TableCell className="text-white/80">{t.points_delta > 0 ? '+' : ''}{t.points_delta}</TableCell>
                  <TableCell className="text-white/80">
                    {t.type === 'point_refund' && t.points_delta > 0 
                      ? 'You'
                      : t.recipient_name || (t.type === 'point_spend' && t.points_delta < 0 ? 'Platform' : '—')
                    }
                  </TableCell>
                  <TableCell className="text-white/80">
                    {t.signed_url ? (
                      <a className="text-white/80 underline" href={t.signed_url} target="_blank" rel="noreferrer">View</a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-white/60">No transactions yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {/* Mobile cards */}
        <div className="space-y-4 md:hidden">
          {transactions.map((t: any) => (
            <div key={t.id} className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className={`font-semibold text-base mb-0.5 ${
                    t.type === 'point_spend' && t.points_delta < 0
                      ? 'text-green-400'
                      : t.type === 'point_refund' && t.points_delta > 0
                      ? 'text-red-400'
                      : 'text-white'
                  }`}>
                    {t.type.replaceAll('_', ' ').replace(/\b\w/g, (char: string) => char.toUpperCase())}
                  </div>
                  <div className="text-xs text-white/50">
                    {new Date(t.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="ml-3">
                  {renderStatus(t.status)}
                </div>
              </div>
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wide">TTD</div>
                  <div className="text-base font-medium text-white">
                    {t.amount_ttd ? `TTD ${Number(t.amount_ttd).toFixed(2)}` : '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Points</div>
                  <div className="text-base font-semibold text-white">
                    {t.points_delta > 0 ? '+' : ''}{t.points_delta || '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wide">To</div>
                  <div className="text-sm text-white/80">
                    {t.type === 'point_refund' && t.points_delta > 0 
                      ? 'You'
                      : t.recipient_name || (t.type === 'point_spend' && t.points_delta < 0 ? 'Platform' : '—')
                    }
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-white/50 uppercase tracking-wide">Time</div>
                  <div className="text-sm text-white/70">
                    {new Date(t.created_at).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
              
              {/* Receipt Link */}
              {t.signed_url && (
                <div className="pt-2 border-t border-white/10">
                  <a 
                    className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors underline underline-offset-2" 
                    href={t.signed_url} 
                    target="_blank" 
                    rel="noreferrer"
                  >
                    View receipt
                  </a>
                </div>
              )}
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="rounded-lg bg-gradient-to-br from-white/10 to-transparent backdrop-blur-md border border-white/20 p-8 text-center">
              <p className="text-white/60">No transactions yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


