import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { env } from '@/lib/env'
import { StreamClient } from '@stream-io/node-sdk'

// Create a new Stream call via their REST API
export async function POST(request: NextRequest) {
  try {
    console.log('Stream call API: Starting request')
    
    let supabase
    try {
      supabase = await createServerSupabaseClient()
      console.log('Stream call API: Supabase client created')
    } catch (error: any) {
      console.error('Stream call API: Failed to create Supabase client:', error)
      return NextResponse.json(
        { error: 'Failed to initialize server: ' + (error.message || 'Unknown error') },
        { status: 500 }
      )
    }
    
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('Stream call API: Auth error:', authError)
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch (error: any) {
      console.error('Stream call API: Failed to parse request body:', error)
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }
    
    const { eventId, title } = body

    if (!eventId || !title) {
      return NextResponse.json(
        { error: 'Event ID and title are required' },
        { status: 400 }
      )
    }

    // Verify user owns the event
    const { data: event, error: eventError } = await supabase
      .from('community_events')
      .select('id, owner_id, status')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    if (event.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - not event owner' },
        { status: 403 }
      )
    }

    if (event.status !== 'scheduled') {
      return NextResponse.json(
        { error: 'Event must be scheduled to go live' },
        { status: 400 }
      )
    }

    const apiKey = env.GETSTREAM_API_KEY
    const apiSecret = env.GETSTREAM_API_SECRET

    console.log('Stream call API: Checking GetStream config', { 
      hasApiKey: !!apiKey, 
      hasApiSecret: !!apiSecret 
    })

    if (!apiKey || !apiSecret) {
      console.error('Stream call API: GetStream not configured')
      return NextResponse.json(
        { error: 'GetStream not configured. Please set GETSTREAM_API_KEY and GETSTREAM_API_SECRET in your environment variables.' },
        { status: 500 }
      )
    }

    console.log('Stream call API: Creating Stream call', { eventId, title: title })
    
    let callId: string
    try {
      // Use Stream Node SDK for server-side call creation
      // This doesn't require WebSocket connections
      const client = new StreamClient(apiKey, apiSecret)

      // Create call using Node SDK (proper server-side method)
      // Note: When using server-side auth, either data.created_by or data.created_by_id must be provided
      const response = await client.video.getOrCreateCall({
        type: 'livestream',
        id: eventId,
        data: {
          created_by_id: user.id, // Required for server-side auth
          custom: {
            event_id: eventId,
            title: title,
          },
        },
        settings_override: {
          recording: {
            mode: 'cloud',
            quality: '1080p',
          },
        },
      })

      callId = response.call?.id || eventId
      console.log('Stream call API: Stream call created successfully:', callId)
    } catch (streamError: any) {
      console.error('Stream call API: Failed to create Stream call:', streamError)
      console.error('Stream call API: Error details:', {
        name: streamError.name,
        message: streamError.message,
        stack: streamError.stack,
        cause: streamError.cause
      })
      return NextResponse.json(
        { error: `Failed to create Stream call: ${streamError.message || 'Unknown error'}. Please check server logs for details.` },
        { status: 500 }
      )
    }

    // Update event with call ID and status
    const { error: updateError } = await supabase
      .from('community_events')
      .update({
        stream_call_id: callId,
        status: 'live',
        started_at: new Date().toISOString(),
      })
      .eq('id', eventId)

    if (updateError) {
      console.error('Error updating event:', updateError)
      // Note: Call is created but event update failed - this should be handled
    }

    return NextResponse.json({
      callId,
      success: true,
    })
  } catch (error: any) {
    console.error('Error creating Stream call:', error)
    const errorMessage = error.message || 'Failed to create call'
    console.error('Full error:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

