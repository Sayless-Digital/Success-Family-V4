import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-server'

export async function POST(req: Request) {
  try {
    const authResult = await requireAuth()
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user, supabase } = authResult

    const body = await req.json().catch(() => ({}))
    const amount = Number(body?.amount)
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const { data, error } = await supabase.rpc('apply_topup', {
      p_user_id: user.id,
      p_amount_ttd: amount,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ result: data })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unexpected error'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


