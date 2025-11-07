import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { env } from '@/lib/env'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    console.log('[Recording API] Request received')
    const supabase = await createServerSupabaseClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('[Recording API] Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Recording API] User authenticated:', user.id)
    const body = await request.json()
    console.log('[Recording API] Request body:', body)
    const { eventId, communityId, streamRecordingId, streamRecordingUrl, startedAt, endedAt, duration } = body

    if (!eventId || !communityId || !streamRecordingId || !streamRecordingUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user is owner of the event
    const { data: event, error: eventError } = await supabase
      .from('community_events')
      .select('owner_id, community_id')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.owner_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized - Only event owner can save recordings' }, { status: 403 })
    }

    if (event.community_id !== communityId) {
      return NextResponse.json({ error: 'Community ID mismatch' }, { status: 400 })
    }

    // Check storage limit before proceeding
    // Update storage usage first
    const { error: updateStorageError } = await supabase.rpc('update_user_storage_usage', {
      p_user_id: user.id
    })

    if (updateStorageError) {
      console.error('[Recording API] Error updating storage:', updateStorageError)
      // Continue anyway - might be first time
    }

    // Get current storage status
    const { data: storage, error: storageError } = await supabase
      .from('user_storage')
      .select('total_storage_bytes, storage_limit_bytes')
      .eq('user_id', user.id)
      .single()

    if (storageError && storageError.code !== 'PGRST116') {
      console.error('[Recording API] Error fetching storage:', storageError)
      // Continue anyway - might be first time
    }

    // If storage record exists and user is over limit, prevent saving
    if (storage && storage.total_storage_bytes >= storage.storage_limit_bytes) {
      return NextResponse.json({ 
        error: 'Storage limit exceeded. Please increase your storage limit to save new recordings.',
        storageLimitExceeded: true
      }, { status: 403 })
    }

    // Download recording from Stream.io
    let recordingBlob: Blob | null = null
    let fileSize = 0
    
    try {
      const recordingResponse = await fetch(streamRecordingUrl)
      if (!recordingResponse.ok) {
        throw new Error(`Failed to download recording: ${recordingResponse.statusText}`)
      }
      recordingBlob = await recordingResponse.blob()
      fileSize = recordingBlob.size
    } catch (downloadError: any) {
      console.error('Error downloading recording:', downloadError)
      // Still save metadata even if download fails
    }

    // Upload to Supabase Storage if download succeeded
    let storagePath: string | null = null
    let storageUrl: string | null = null

    if (recordingBlob) {
      try {
        const bucketName = 'event-recordings'
        const fileName = `${eventId}/${streamRecordingId}-${Date.now()}.mp4`
        
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(fileName, recordingBlob, {
            contentType: 'video/mp4',
            upsert: false,
          })

        if (uploadError) {
          // If bucket doesn't exist, try to create it
          if (uploadError.message.includes('not found') || uploadError.message.includes('bucket')) {
            console.log('[Recording API] Bucket not found, attempting to create it...')
            
            // Try to create bucket using service role key if available
            if (env.SUPABASE_SERVICE_ROLE_KEY) {
              try {
                const adminClient = createClient(
                  env.NEXT_PUBLIC_SUPABASE_URL!,
                  env.SUPABASE_SERVICE_ROLE_KEY,
                  {
                    auth: {
                      autoRefreshToken: false,
                      persistSession: false,
                    },
                  }
                )
                
                // Create the bucket
                const { data: bucketData, error: createError } = await adminClient.storage.createBucket(bucketName, {
                  public: true,
                  fileSizeLimit: 52428800, // 50MB
                  allowedMimeTypes: ['video/mp4', 'video/webm', 'video/mpeg'],
                })
                
                if (createError) {
                  console.error('[Recording API] Failed to create bucket:', createError)
                  // Continue with metadata save
                } else {
                  console.log('[Recording API] Bucket created successfully, retrying upload...')
                  
                  // Retry upload after creating bucket
                  const { data: retryUploadData, error: retryError } = await supabase.storage
                    .from(bucketName)
                    .upload(fileName, recordingBlob, {
                      contentType: 'video/mp4',
                      upsert: false,
                    })
                  
                  if (!retryError && retryUploadData) {
                    storagePath = `${bucketName}/${fileName}`
                    const { data: urlData } = supabase.storage
                      .from(bucketName)
                      .getPublicUrl(fileName)
                    storageUrl = urlData.publicUrl
                  } else {
                    console.error('[Recording API] Upload failed after bucket creation:', retryError)
                  }
                }
              } catch (createBucketError: any) {
                console.error('[Recording API] Error creating bucket:', createBucketError)
                // Continue with metadata save
              }
            } else {
              console.warn('[Recording API] Storage bucket not found and SUPABASE_SERVICE_ROLE_KEY not configured. Please create "event-recordings" bucket manually in Supabase Storage dashboard.')
            }
          } else {
            throw uploadError
          }
        } else {
          storagePath = `${bucketName}/${fileName}`
          
          // Get public URL
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName)
          
          storageUrl = urlData.publicUrl
        }
      } catch (storageError: any) {
        console.error('[Recording API] Error uploading to storage:', storageError)
        // Continue with metadata save even if storage upload fails
      }
    }

    // Calculate duration in seconds
    const durationSeconds = duration ? Math.floor(duration / 1000) : undefined
    
    // Save recording metadata to database
    const recordingData = {
      event_id: eventId,
      community_id: communityId,
      stream_recording_id: streamRecordingId,
      stream_recording_url: streamRecordingUrl,
      storage_path: storagePath,
      storage_url: storageUrl,
      duration_seconds: durationSeconds,
      file_size_bytes: fileSize || null,
      started_at: startedAt ? new Date(startedAt).toISOString() : null,
      ended_at: endedAt ? new Date(endedAt).toISOString() : null,
      is_processing: false,
      title: `Recording - ${new Date(startedAt || Date.now()).toLocaleDateString()}`,
    }

    console.log('[Recording API] Attempting to save to database:', recordingData)
    const { data: savedRecording, error: dbError } = await supabase
      .from('event_recordings')
      .insert([recordingData])
      .select()
      .single()

    if (dbError) {
      console.error('[Recording API] Database error:', dbError)
      console.error('[Recording API] Error details:', JSON.stringify(dbError, null, 2))
      return NextResponse.json({ error: 'Failed to save recording metadata', details: dbError.message }, { status: 500 })
    }

    console.log('[Recording API] Recording saved successfully:', savedRecording?.id)

    // Update storage usage after saving recording
    const { error: finalUpdateError } = await supabase.rpc('update_user_storage_usage', {
      p_user_id: user.id
    })

    if (finalUpdateError) {
      console.error('[Recording API] Error updating storage after save:', finalUpdateError)
      // Don't fail the request - storage will be updated on next calculation
    }

    return NextResponse.json({
      success: true,
      recording: savedRecording,
      message: storagePath ? 'Recording saved successfully' : 'Recording metadata saved (storage upload failed - please check bucket configuration)',
    })
  } catch (error: any) {
    console.error('Error in save recording API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
