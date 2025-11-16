import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/storage/downgrade
 * Decreases storage limit (no refund on one-time purchase)
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
    const { newLimitGb } = body

    if (!newLimitGb || newLimitGb <= 0 || !Number.isInteger(newLimitGb)) {
      return NextResponse.json({ error: 'Invalid storage amount' }, { status: 400 })
    }

    // Decrease storage limit
    const { data: result, error: storageError } = await supabase
      .rpc('decrease_storage_limit', {
        p_user_id: user.id,
        p_new_limit_gb: newLimitGb
      })

    if (storageError) {
      console.error('Error decreasing storage limit:', storageError)
      return NextResponse.json({ error: 'Failed to decrease storage limit' }, { status: 500 })
    }

    if (!result || result.length === 0 || !result[0].success) {
      return NextResponse.json({ 
        error: result?.[0]?.message || 'Failed to decrease storage limit' 
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      newLimitBytes: result[0].new_limit_bytes,
      message: result[0].message,
      newLimitGb
    }, { status: 200 })
  } catch (error) {
    console.error('Error in storage downgrade API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}




















