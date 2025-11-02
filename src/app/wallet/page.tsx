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
      .select('id, type, amount_ttd, points_delta, receipt_url, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('platform_settings').select('buy_price_per_point, user_value_per_point').eq('id', 1).maybeSingle(),
  ])
  const txs = txError ? [] : (transactions ?? [])
  const signed = await Promise.all(
    txs.map(async (t: any) => {
      if (!t.receipt_url) return { ...t, signed_url: null }
      const { data: signedUrl } = await supabase.storage.from('receipts').createSignedUrl(t.receipt_url, 600)
      return { ...t, signed_url: signedUrl?.signedUrl || null }
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
      <div className="flex items-center justify-between gap-4">
        <div className="text-3xl font-semibold text-white">{Math.trunc(Number(wallet?.points_balance ?? 0))} pts</div>
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
        <div className="rounded-lg bg-white/10 p-4 space-y-3">
          <div className="text-white/80 font-medium">Bank Details</div>
          {banks.map((b: any) => (
            <div key={b.id} className="rounded-md bg-white/10 p-3 space-y-2">
              <div className="text-white/80 text-sm mb-1">{b.bank_name}</div>
              <CopyField label="Account Name" value={b.account_name} />
              <CopyField label="Account Number" value={b.account_number} />
              <CopyField label="Account Type" value={b.account_type} />
            </div>
          ))}
        </div>
      )}

      {/* Transactions */}
      <div className="space-y-3">
        <div className="text-white/80 font-medium">Transactions</div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-white/80">Date</TableHead>
                <TableHead className="text-white/80">Type</TableHead>
                <TableHead className="text-white/80">Status</TableHead>
                <TableHead className="text-white/80">TTD</TableHead>
                <TableHead className="text-white/80">Points</TableHead>
                <TableHead className="text-white/80">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t: any) => (
                <TableRow key={t.id}>
                  <TableCell className="text-white/80">{new Date(t.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-white/80">{t.type.replaceAll('_', ' ').replace(/\b\w/g, (char: string) => char.toUpperCase())}</TableCell>
                  <TableCell className="text-white/80">{renderStatus(t.status)}</TableCell>
                  <TableCell className="text-white/80">{t.amount_ttd ? Number(t.amount_ttd).toFixed(2) : '—'}</TableCell>
                  <TableCell className="text-white/80">{t.points_delta}</TableCell>
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
                  <TableCell colSpan={6} className="text-white/60">No transactions yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {transactions.map((t: any) => (
            <div key={t.id} className="rounded-md bg-white/10 p-3">
              <div className="flex justify-between text-white/80">
                <span className="font-medium">{t.type.replaceAll('_', ' ').replace(/\b\w/g, (char: string) => char.toUpperCase())}</span>
                <span className="text-xs">{new Date(t.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-white/80">
                <div>
                  <div className="text-white/60">TTD</div>
                  <div>{t.amount_ttd ? Number(t.amount_ttd).toFixed(2) : '—'}</div>
                </div>
                <div>
                  <div className="text-white/60">Points</div>
                  <div>{t.points_delta}</div>
                </div>
                <div>
                  <div className="text-white/60">Status</div>
                  <div>{renderStatus(t.status)}</div>
                </div>
              </div>
              {t.signed_url && (
                <div className="mt-2">
                  <a className="text-white/80 underline text-sm" href={t.signed_url} target="_blank" rel="noreferrer">View receipt</a>
                </div>
              )}
            </div>
          ))}
          {transactions.length === 0 && (
            <div className="text-white/60">No transactions yet.</div>
          )}
        </div>
      </div>
    </div>
  )
}


