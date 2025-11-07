import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/storage
 * Returns user's storage information including usage, limit, cost, and file list
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update storage usage first (if function exists)
    const { error: updateError } = await supabase.rpc('update_user_storage_usage', {
      p_user_id: user.id
    })

    if (updateError) {
      console.error('Error updating storage usage:', updateError)
      // If function doesn't exist (migration not applied), continue with manual calculation
      if (updateError.code === '42883' || updateError.message?.includes('does not exist')) {
        console.warn('Storage functions not found - migration may not be applied yet')
      } else {
        // Other errors - continue anyway
      }
    }

    // Get storage record
    const { data: storage, error: storageError } = await supabase
      .from('user_storage')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (storageError) {
      // If table doesn't exist (migration not applied), return helpful error
      if (storageError.code === '42P01' || storageError.message?.includes('does not exist')) {
        console.error('user_storage table does not exist - migration needs to be applied')
        return NextResponse.json({ 
          error: 'Storage system not initialized. Please apply the database migration.',
          migrationRequired: true
        }, { status: 503 })
      }
      
      // If record doesn't exist (PGRST116), that's okay - we'll create it
      if (storageError.code !== 'PGRST116') {
        console.error('Error fetching storage:', storageError)
        return NextResponse.json({ 
          error: 'Failed to fetch storage',
          details: storageError.message 
        }, { status: 500 })
      }
    }

    // If no storage record exists, create one
    let storageData = storage
    if (!storageData) {
      const { data: newStorage, error: createError } = await supabase
        .from('user_storage')
        .insert({
          user_id: user.id,
          total_storage_bytes: 0,
          storage_limit_bytes: 1073741824, // 1 GB
          monthly_cost_points: 0
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating storage record:', createError)
        return NextResponse.json({ error: 'Failed to create storage record' }, { status: 500 })
      }

      storageData = newStorage
    }

    // Get all recordings with event and community info
    // First get events owned by user, then get recordings for those events
    const { data: userEvents, error: eventsError } = await supabase
      .from('community_events')
      .select('id')
      .eq('owner_id', user.id)

    if (eventsError) {
      console.error('Error fetching user events:', eventsError)
      return NextResponse.json({ 
        error: 'Failed to fetch user events',
        details: eventsError.message 
      }, { status: 500 })
    }

    const eventIds = userEvents?.map(e => e.id) || []
    
    // If user has no events, return empty recordings
    let recordings: any[] = []
    if (eventIds.length > 0) {
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('event_recordings')
        .select(`
          id,
          event_id,
          community_id,
          title,
          file_size_bytes,
          created_at,
          storage_url,
          stream_recording_url,
          event:community_events(
            id,
            description,
            scheduled_at,
            community:communities(
              id,
              name,
              slug
            )
          )
        `)
        .in('event_id', eventIds)
        .not('file_size_bytes', 'is', null)
        .gt('file_size_bytes', 0)
        .order('created_at', { ascending: false })

      if (recordingsError) {
        console.error('Error fetching recordings:', recordingsError)
        return NextResponse.json({ 
          error: 'Failed to fetch recordings',
          details: recordingsError.message 
        }, { status: 500 })
      }

      recordings = recordingsData || []
    }

    // Get storage pricing settings
    const { data: settings } = await supabase
      .from('platform_settings')
      .select('storage_purchase_price_per_gb, storage_monthly_cost_per_gb')
      .eq('id', 1)
      .single()

    return NextResponse.json({
      storage: storageData,
      recordings: recordings || [],
      pricing: {
        purchasePricePerGb: settings?.storage_purchase_price_per_gb ?? 10,
        monthlyCostPerGb: settings?.storage_monthly_cost_per_gb ?? 4
      }
    }, { status: 200 })
  } catch (error) {
    console.error('Error in storage API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

