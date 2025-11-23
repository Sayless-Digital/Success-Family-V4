import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"

const BUCKET_NAME = "community-uploads"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: "Only admins can upload learn page videos" }, { status: 403 })
    }

    const formData = await request.formData()
    const rawTitle = formData.get("title")
    const rawDescription = formData.get("description")
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Video file is required" }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 })
    }

    const extension = (() => {
      const parts = file.name?.split(".") ?? []
      return parts.length > 1 ? parts.pop()!.toLowerCase() : "mp4"
    })()

    // Store learn page videos in a special folder
    const objectPath = `learn-page/${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`
    const contentType = file.type || `video/${extension}` || "video/mp4"

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(objectPath, file, {
        cacheControl: "0",
        contentType,
        upsert: false,
      })

    if (uploadError) {
      console.error("[Learn Page Video Upload API] Storage upload failed:", uploadError)
      return NextResponse.json({ error: "Failed to upload video to storage" }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(objectPath)
    const storageUrl = publicUrlData?.publicUrl ?? null
    const storagePath = `${BUCKET_NAME}/${objectPath}`

    const title = typeof rawTitle === "string" && rawTitle.trim().length > 0 ? rawTitle.trim() : file.name
    const description = typeof rawDescription === "string" && rawDescription.trim().length > 0 ? rawDescription.trim() : null

    const { data: insertedVideo, error: insertError } = await supabase
      .from("uploaded_videos")
      .insert({
        community_id: null, // Null for learn page videos
        user_id: user.id,
        title,
        description,
        storage_path: storagePath,
        storage_url: storageUrl,
        file_size_bytes: file.size,
        duration_seconds: null,
        is_learn_page_video: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[Learn Page Video Upload API] Database insert failed:", insertError)
      // Attempt to clean up the uploaded file if database insert fails
      await supabase.storage.from(BUCKET_NAME).remove([objectPath]).catch((cleanupError) => {
        console.warn("[Learn Page Video Upload API] Failed to cleanup storage object:", cleanupError)
      })

      return NextResponse.json({ error: "Failed to save uploaded video metadata" }, { status: 500 })
    }

    // Update storage usage for the admin
    const { error: storageUpdateError } = await supabase.rpc("update_user_storage_usage", {
      p_user_id: user.id,
    })

    if (storageUpdateError) {
      console.warn("[Learn Page Video Upload API] Failed to update storage usage:", storageUpdateError)
    }

    return NextResponse.json(
      {
        success: true,
        video: insertedVideo,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error("[Learn Page Video Upload API] Unexpected error:", error)
    return NextResponse.json(
      { error: error?.message || "Unexpected error during video upload" },
      { status: 500 }
    )
  }
}


