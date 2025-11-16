import { NextRequest, NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase-server"

function storagePathToObjectPath(storagePath: string | null | undefined) {
  if (!storagePath) return null
  const prefix = "dm-media/"
  if (storagePath.startsWith(prefix)) {
    return storagePath.slice(prefix.length)
  }
  return storagePath
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ attachmentId: string }> | { attachmentId: string } },
) {
  const params = await Promise.resolve(context.params)
  const attachmentId = params?.attachmentId?.trim()

  if (!attachmentId) {
    return NextResponse.json({ error: "Attachment ID is required" }, { status: 400 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get attachment details
    const { data: attachment, error: attachmentError } = await supabase
      .from("dm_message_media")
      .select("id, message_id, storage_path, file_name, mime_type")
      .eq("id", attachmentId)
      .single()

    if (attachmentError || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
    }

    // Check if user has access to this message (via thread participants)
    const { data: message, error: messageError } = await supabase
      .from("dm_messages")
      .select("thread_id")
      .eq("id", attachment.message_id)
      .single()

    if (messageError || !message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 })
    }

    // Check if user is a participant in the thread
    const { data: participant, error: participantError } = await supabase
      .from("dm_participants")
      .select("id")
      .eq("thread_id", message.thread_id)
      .eq("user_id", user.id)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get signed URL for the file
    const objectPath = storagePathToObjectPath(attachment.storage_path)
    if (!objectPath) {
      return NextResponse.json({ error: "Invalid storage path" }, { status: 400 })
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("dm-media")
      .createSignedUrl(objectPath, 3600) // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 })
    }

    // Fetch the file from Supabase storage
    const fileResponse = await fetch(signedUrlData.signedUrl)

    if (!fileResponse.ok) {
      return NextResponse.json({ error: "Failed to fetch file" }, { status: 500 })
    }

    // Get file content
    const fileBuffer = await fileResponse.arrayBuffer()

    // Determine file name - use original name from DB, fallback to storage path
    const fileName = attachment.file_name || objectPath.split('/').pop() || 'file'

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": attachment.mime_type || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": fileBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error("[api/dm/download][GET]", error)
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 })
  }
}








