import { NextRequest, NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase-server"

const SIGNED_URL_TTL_SECONDS = 60

type SourceType = "recording" | "upload"

interface SignedUrlRequestBody {
  playlistId?: string
  communityId?: string
  sourceType?: SourceType
  sourceId?: string
}

interface ParsedStorageObject {
  bucket: string
  path: string
}

function parseStorageObject(input?: string | null): ParsedStorageObject | null {
  if (!input) return null

  const trimmed = input.trim()
  if (!trimmed) return null

  if (trimmed.startsWith("http")) {
    try {
      const url = new URL(trimmed)
      const publicPrefix = "/storage/v1/object/public/"
      const signedPrefix = "/storage/v1/object/sign/"

      if (url.pathname.includes(publicPrefix)) {
        const remainder = url.pathname.split(publicPrefix)[1]
        const [bucket, ...rest] = remainder.split("/")
        if (!bucket || rest.length === 0) return null
        return { bucket, path: rest.join("/") }
      }

      if (url.pathname.includes(signedPrefix)) {
        const remainder = url.pathname.split(signedPrefix)[1]
        const [bucket, ...rest] = remainder.split("/")
        if (!bucket || rest.length === 0) return null
        return { bucket, path: rest.join("/") }
      }

      const objectIndex = url.pathname.indexOf("/object/")
      if (objectIndex !== -1) {
        const remainder = url.pathname.slice(objectIndex + "/object/".length)
        const segments = remainder.split("/").filter(Boolean)
        if (segments.length >= 2) {
          const bucket = segments[segments[0] === "public" ? 1 : 0]
          const offset = segments[0] === "public" ? 2 : 1
          const path = segments.slice(offset).join("/")
          if (bucket && path) {
            return { bucket, path }
          }
        }
      }
    } catch {
      return null
    }
    return null
  }

  const cleaned = trimmed.replace(/^\/+/, "")
  const [bucket, ...rest] = cleaned.split("/")
  if (!bucket || rest.length === 0) return null
  return { bucket, path: rest.join("/") }
}

async function userHasCommunityAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  communityId: string,
  userId: string,
  playlistOwnerId: string,
): Promise<boolean> {
  if (userId === playlistOwnerId) {
    return true
  }

  const { data: membership } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", communityId)
    .eq("user_id", userId)
    .maybeSingle()

  if (membership) {
    return true
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .maybeSingle()

  if (userProfile?.role === "admin") {
    return true
  }

  return false
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SignedUrlRequestBody
    const { playlistId, communityId, sourceId, sourceType } = body

    if (!sourceId || !sourceType) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
    }

    if (sourceType !== "recording" && sourceType !== "upload") {
      return NextResponse.json({ error: "Invalid source type" }, { status: 400 })
    }

    if (!playlistId && !communityId) {
      return NextResponse.json({ error: "Missing context" }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let targetCommunityId: string
    let ownerId: string

    if (playlistId) {
      const { data: playlist, error: playlistError } = await supabase
        .from("community_playlists")
        .select("id, community_id, owner_id")
        .eq("id", playlistId)
        .single()

      if (playlistError || !playlist) {
        return NextResponse.json({ error: "Playlist not found" }, { status: 404 })
      }

      targetCommunityId = playlist.community_id
      ownerId = playlist.owner_id
    } else {
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("id, owner_id")
        .eq("id", communityId)
        .single()

      if (communityError || !community) {
        return NextResponse.json({ error: "Community not found" }, { status: 404 })
      }

      targetCommunityId = community.id
      ownerId = community.owner_id
    }

    const canAccess = await userHasCommunityAccess(supabase, targetCommunityId, user.id, ownerId)

    if (!canAccess) {
      return NextResponse.json({ error: "You do not have access" }, { status: 403 })
    }

    let storagePath: string | null = null

    if (sourceType === "recording") {
      const { data: recording, error: recordingError } = await supabase
        .from("event_recordings")
        .select("id, community_id, storage_path, storage_url")
        .eq("id", sourceId)
        .single()

      if (recordingError || !recording) {
        return NextResponse.json({ error: "Recording not found" }, { status: 404 })
      }

      if (recording.community_id !== targetCommunityId) {
        return NextResponse.json({ error: "Recording not available" }, { status: 403 })
      }

      storagePath = recording.storage_path ?? recording.storage_url ?? null
    } else {
      const { data: upload, error: uploadError } = await supabase
        .from("uploaded_videos")
        .select("id, community_id, storage_path, storage_url")
        .eq("id", sourceId)
        .single()

      if (uploadError || !upload) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 })
      }

      if (upload.community_id !== targetCommunityId) {
        return NextResponse.json({ error: "Video not available" }, { status: 403 })
      }

      storagePath = upload.storage_path ?? upload.storage_url ?? null
    }

    const storageObject = parseStorageObject(storagePath)
    if (!storageObject) {
      return NextResponse.json({ error: "Storage path is invalid" }, { status: 400 })
    }

    const { bucket, path } = storageObject
    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

    if (signedError || !signed?.signedUrl) {
      console.error("[storage/signed-url] Failed to create signed URL:", signedError)
      return NextResponse.json({ error: "Failed to create signed URL" }, { status: 500 })
    }

    return NextResponse.json(
      { signedUrl: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    )
  } catch (error) {
    console.error("[storage/signed-url] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}



