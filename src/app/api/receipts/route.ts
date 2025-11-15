import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { randomUUID } from 'crypto'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const amount = Number(form.get('amount_ttd'))
  const bankAccountId = String(form.get('bank_account_id') || '')
  const file = form.get('file') as File | null

  // Get minimum top-up amount from platform settings
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('mandatory_topup_ttd')
    .eq('id', 1)
    .maybeSingle()

  const minimumTopup = Number(settings?.mandatory_topup_ttd ?? 150)

  if (!Number.isFinite(amount) || amount < minimumTopup) {
    return NextResponse.json({ error: `Minimum top up is ${minimumTopup.toFixed(2)} TTD` }, { status: 400 })
  }
  if (!bankAccountId) {
    return NextResponse.json({ error: 'bank_account_id is required' }, { status: 400 })
  }
  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const ext = (file.name?.split('.').pop() || 'bin').toLowerCase()
  const filePath = `${user.id}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, buffer, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 400 })
  }

  // Insert a pending top-up transaction with the uploaded receipt
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      user_id: user.id,
      type: 'top_up',
      bank_account_id: bankAccountId,
      amount_ttd: amount,
      receipt_url: filePath,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ transaction: data })
}


