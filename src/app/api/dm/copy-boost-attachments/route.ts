import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { messageId } = await request.json()

    if (!messageId) {
      return NextResponse.json({ error: "messageId is required" }, { status: 400 })
    }

    // Get all media for this message that has source_storage_path (boost reward attachments)
    const { data: mediaItems, error: fetchError } = await supabase
      .from("dm_message_media")
      .select("id, source_storage_path, source_bucket, storage_path, file_name, mime_type")
      .eq("message_id", messageId)
      .not("source_storage_path", "is", null)

    if (fetchError) {
      console.error("Error fetching media items:", fetchError)
      return NextResponse.json({ error: "Failed to fetch media items" }, { status: 500 })
    }

    if (!mediaItems || mediaItems.length === 0) {
      return NextResponse.json({ success: true, message: "No files to copy" })
    }

    // Copy each file from source bucket to dm-media bucket
    const copyResults = await Promise.allSettled(
      mediaItems.map(async (media) => {
        if (!media.source_storage_path || !media.source_bucket) {
          return { id: media.id, success: false, error: "Missing source path or bucket" }
        }

        try {
          // Download file from source bucket
          const { data: sourceFile, error: downloadError } = await supabase.storage
            .from(media.source_bucket)
            .download(media.source_storage_path)

          if (downloadError || !sourceFile) {
            throw new Error(`Failed to download: ${downloadError?.message}`)
          }

          // Convert blob to array buffer for upload
          const arrayBuffer = await sourceFile.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          // Upload to dm-media bucket
          // storage_path format: dm-media/{user_id}/{thread_id}/{message_id}/{file_name}
          // Remove 'dm-media/' prefix to get the object path for storage API
          const destPath = media.storage_path.startsWith("dm-media/")
            ? media.storage_path.slice("dm-media/".length)
            : media.storage_path

          // Get content type from mime_type or default
          const contentType = media.mime_type || "application/octet-stream"
          
          const { error: uploadError } = await supabase.storage
            .from("dm-media")
            .upload(destPath, buffer, {
              contentType,
              upsert: true, // Overwrite if exists
            })

          if (uploadError) {
            throw new Error(`Failed to upload: ${uploadError.message}`)
          }

          // Clear source info after successful copy
          const { error: updateError } = await supabase
            .from("dm_message_media")
            .update({
              source_storage_path: null,
              source_bucket: null,
            })
            .eq("id", media.id)

          if (updateError) {
            console.error(`Failed to clear source info for ${media.id}:`, updateError)
          }

          return { id: media.id, success: true }
        } catch (error: any) {
          console.error(`Error copying file for media ${media.id}:`, error)
          return { id: media.id, success: false, error: error.message }
        }
      }),
    )

    const successful = copyResults.filter((r) => r.status === "fulfilled" && r.value.success).length
    const failed = copyResults.length - successful

    return NextResponse.json({
      success: true,
      copied: successful,
      failed,
      results: copyResults.map((r) => (r.status === "fulfilled" ? r.value : { error: r.reason })),
    })
  } catch (error: any) {
    console.error("Error in copy-boost-attachments:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

