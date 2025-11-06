import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { env } from '@/lib/env'
import { StreamClient } from '@stream-io/node-sdk'

export async function GET(request: NextRequest) {
  try {
    console.log('[Recordings API] Request received')
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[Recordings API] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Recordings API] User authenticated:', user.id)
    
    // Get call ID from query params
    const { searchParams } = new URL(request.url)
    const callId = searchParams.get('callId')
    
    if (!callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 })
    }

    const apiKey = env.GETSTREAM_API_KEY
    const apiSecret = env.GETSTREAM_API_SECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'GetStream not configured' }, { status: 500 })
    }

    // Use Stream Node SDK to get recordings
    const client = new StreamClient(apiKey, apiSecret)
    
    console.log('[Recordings API] Fetching recordings for call:', callId)
    
    // Get recordings using the Stream.io Node SDK
    // Call ID format is typically "type:id", but we'll try both formats
    let callType = 'default'
    let actualCallId = callId
    
    // If callId contains a colon, split it (format: "type:id")
    if (callId.includes(':')) {
      const parts = callId.split(':')
      callType = parts[0]
      actualCallId = parts.slice(1).join(':')
    }
    
    // Get the call object and list its recordings
    const call = client.video.call(callType, actualCallId)
    const recordingsResponse = await call.listRecordings()

    console.log('[Recordings API] Recordings fetched:', recordingsResponse.recordings?.length || 0)
    
    return NextResponse.json({
      success: true,
      recordings: recordingsResponse.recordings || [],
    })
  } catch (error: any) {
    console.error('[Recordings API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

