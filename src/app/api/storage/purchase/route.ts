import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/storage/purchase
 * Purchases additional storage using points
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { additionalGb } = body

    if (!additionalGb || additionalGb <= 0 || !Number.isInteger(additionalGb)) {
      return NextResponse.json({ error: 'Invalid storage amount' }, { status: 400 })
    }

    // Get storage purchase price from platform settings
    const { data: settings, error: settingsError } = await supabase
      .from('platform_settings')
      .select('storage_purchase_price_per_gb')
      .eq('id', 1)
      .single()

    if (settingsError || !settings) {
      return NextResponse.json({ error: 'Failed to fetch pricing settings' }, { status: 500 })
    }

    const pricePerGb = settings.storage_purchase_price_per_gb ?? 10
    const costPoints = additionalGb * pricePerGb

    // Check wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('points_balance')
      .eq('user_id', user.id)
      .single()

    if (walletError || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 500 })
    }

    if (wallet.points_balance < costPoints) {
      return NextResponse.json({ 
        error: 'Insufficient points',
        required: costPoints,
        available: wallet.points_balance
      }, { status: 400 })
    }

    // Deduct points
    const { error: deductError } = await supabase
      .from('wallets')
      .update({ 
        points_balance: wallet.points_balance - costPoints,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)

    if (deductError) {
      return NextResponse.json({ error: 'Failed to deduct points' }, { status: 500 })
    }

    // Create transaction
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'point_spend',
        points_delta: -costPoints,
        recipient_user_id: null // Goes to platform
      })

    if (txError) {
      console.error('Error creating transaction:', txError)
      // Don't fail - points are already deducted
    }

    // Increase storage limit
    const { data: storageResult, error: storageError } = await supabase
      .rpc('increase_storage_limit', {
        p_user_id: user.id,
        p_additional_gb: additionalGb
      })

    if (storageError) {
      console.error('Error increasing storage limit:', storageError)
      return NextResponse.json({ error: 'Failed to increase storage limit' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      newLimitBytes: storageResult?.[0]?.new_limit_bytes,
      pointsDeducted: costPoints,
      additionalGb
    }, { status: 200 })
  } catch (error) {
    console.error('Error in storage purchase API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

