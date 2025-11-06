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
    const { eventId, communityId, streamRecordingId, streamRecordingUrl, startedAt, endedAt, duration, streamRecordingData, thumbnailDataUrl } = body

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

    // Check for thumbnail URL from Stream.io recording data
    // Stream.io recordings may have thumbnail_url or thumbnail properties
    let thumbnailUrl: string | null = null
    if (streamRecordingData) {
      console.log('[Recording API] Full streamRecordingData keys:', Object.keys(streamRecordingData))
      console.log('[Recording API] streamRecordingData sample:', JSON.stringify(streamRecordingData, null, 2).substring(0, 1000))
      
      // Try multiple possible thumbnail property paths
      thumbnailUrl = streamRecordingData.thumbnail_url || 
                     streamRecordingData.thumbnail || 
                     streamRecordingData.thumbnail_urls?.[0] ||
                     streamRecordingData.thumbnails?.[0]?.url ||
                     streamRecordingData.thumbnails?.[0] ||
                     streamRecordingData.screenshot_url ||
                     streamRecordingData.preview_url ||
                     streamRecordingData.image_url ||
                     null
      
      console.log('[Recording API] Thumbnail URL from Stream.io:', thumbnailUrl)
      
      if (!thumbnailUrl) {
        console.log('[Recording API] No thumbnail found in recording data. Available properties:', Object.keys(streamRecordingData))
      }
    } else {
      console.log('[Recording API] No streamRecordingData provided')
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

    // Generate thumbnail if not provided and we have the video
    let thumbnailStoragePath: string | null = null
    let thumbnailStorageUrl: string | null = null
    
    // Check if client provided a thumbnail data URL
    if (!thumbnailUrl && thumbnailDataUrl) {
      try {
        console.log('[Recording API] Processing client-provided thumbnail data URL...')
        // Convert data URL to buffer (Node.js compatible)
        const base64Data = thumbnailDataUrl.split(',')[1]
        if (!base64Data) {
          throw new Error('Invalid thumbnail data URL format')
        }
        const binaryData = Buffer.from(base64Data, 'base64')
        
        const bucketName = 'event-recordings'
        const thumbnailFileName = `${eventId}/${streamRecordingId}-thumbnail-${Date.now()}.jpg`
        
        // Supabase Storage accepts Buffer or Blob
        const { data: thumbnailUploadData, error: thumbnailUploadError } = await supabase.storage
          .from(bucketName)
          .upload(thumbnailFileName, binaryData, {
            contentType: 'image/jpeg',
            upsert: false,
          })
        
        if (!thumbnailUploadError && thumbnailUploadData) {
          thumbnailStoragePath = `${bucketName}/${thumbnailFileName}`
          const { data: thumbnailUrlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(thumbnailFileName)
          thumbnailStorageUrl = thumbnailUrlData.publicUrl
          console.log('[Recording API] Client-provided thumbnail uploaded successfully:', thumbnailStorageUrl)
        } else {
          console.error('[Recording API] Error uploading client thumbnail:', thumbnailUploadError)
        }
      } catch (thumbnailProcessError: any) {
        console.error('[Recording API] Error processing client thumbnail:', thumbnailProcessError)
      }
    }
    
    if (!thumbnailUrl && !thumbnailStorageUrl && recordingBlob) {
      try {
        // Try to use Stream.io's thumbnail endpoint pattern
        // Stream.io CDN URLs can sometimes have thumbnail variants
        // Example: video.mp4 -> video-thumbnail.jpg or video.jpg
        const streamBaseUrl = streamRecordingUrl.split('?')[0] // Remove query params
        const possibleThumbnailUrls = [
          streamBaseUrl.replace('.mp4', '-thumbnail.jpg'),
          streamBaseUrl.replace('.mp4', '.jpg'),
          streamBaseUrl.replace('.mp4', '-thumb.jpg'),
          streamBaseUrl.replace('/video/', '/thumbnail/').replace('.mp4', '.jpg'),
        ]
        
        // Try each possible thumbnail URL
        for (const possibleUrl of possibleThumbnailUrls) {
          try {
            const testResponse = await fetch(possibleUrl, { method: 'HEAD' })
            if (testResponse.ok && testResponse.headers.get('content-type')?.startsWith('image/')) {
              thumbnailUrl = possibleUrl
              console.log('[Recording API] Found Stream.io thumbnail at:', thumbnailUrl)
              break
            }
          } catch (e) {
            // Continue to next URL
          }
        }
        
        // If still no thumbnail found, we'll need to generate one
        // For now, we'll skip and document it
        if (!thumbnailUrl) {
          console.log('[Recording API] No thumbnail found via Stream.io patterns. Video frame extraction requires FFmpeg.')
          console.log('[Recording API] To enable thumbnail generation, install FFmpeg and fluent-ffmpeg package.')
        }
      } catch (thumbnailError: any) {
        console.error('[Recording API] Error checking for thumbnails:', thumbnailError)
        // Continue without thumbnail
      }
    }
    
    if (thumbnailUrl) {
      // If Stream.io provided a thumbnail, download and upload it
      try {
        const thumbnailResponse = await fetch(thumbnailUrl)
        if (thumbnailResponse.ok) {
          const thumbnailBlob = await thumbnailResponse.blob()
          const bucketName = 'event-recordings'
          const thumbnailFileName = `${eventId}/${streamRecordingId}-thumbnail-${Date.now()}.jpg`
          
          const { data: thumbnailUploadData, error: thumbnailUploadError } = await supabase.storage
            .from(bucketName)
            .upload(thumbnailFileName, thumbnailBlob, {
              contentType: 'image/jpeg',
              upsert: false,
            })
          
          if (!thumbnailUploadError && thumbnailUploadData) {
            thumbnailStoragePath = `${bucketName}/${thumbnailFileName}`
            const { data: thumbnailUrlData } = supabase.storage
              .from(bucketName)
              .getPublicUrl(thumbnailFileName)
            thumbnailStorageUrl = thumbnailUrlData.publicUrl
            console.log('[Recording API] Thumbnail uploaded successfully')
          }
        }
      } catch (thumbnailDownloadError: any) {
        console.error('[Recording API] Error downloading/uploading thumbnail:', thumbnailDownloadError)
        // Continue without thumbnail
      }
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
      thumbnail_url: thumbnailStorageUrl || thumbnailUrl || null,
      duration_seconds: durationSeconds,
      file_size_bytes: fileSize || null,
      started_at: startedAt ? new Date(startedAt).toISOString() : null,
      ended_at: endedAt ? new Date(endedAt).toISOString() : null,
      is_processing: false,
      title: `Recording - ${new Date(startedAt || Date.now()).toLocaleDateString()}`,
    }

    console.log('[Recording API] Attempting to save to database:', {
      ...recordingData,
      thumbnail_url: recordingData.thumbnail_url || 'null',
    })
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

    console.log('[Recording API] Recording saved successfully:', {
      id: savedRecording?.id,
      thumbnail_url: savedRecording?.thumbnail_url || 'null',
    })

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

