import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { validateAndPrepareItems, type PlaylistItemInput } from "../utils"

interface UpdatePlaylistBody {
  title?: string
  description?: string | null
  status?: "draft" | "published"
  items?: PlaylistItemInput[]
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ playlistId: string }> | { playlistId: string } },
) {
  const params = await Promise.resolve(context.params)
  const playlistId = typeof params?.playlistId === "string" ? params.playlistId : undefined

  if (!playlistId) {
    return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: playlist, error: playlistError } = await supabase
      .from("community_playlists")
      .select("id, community_id, owner_id, status, published_at")
      .eq("id", playlistId)
      .maybeSingle()

    if (playlistError && playlistError.code !== "PGRST116") {
      console.error("[Playlists API] Failed to load playlist:", playlistError)
      return NextResponse.json({ error: "Failed to load playlist" }, { status: 500 })
    }

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 })
    }

    if (playlist.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the community owner can update playlists" }, { status: 403 })
    }

    const body = (await request.json()) as UpdatePlaylistBody
    const updates: Record<string, unknown> = {}

    if (typeof body.title === "string") {
      const trimmed = body.title.trim()
      if (!trimmed) {
        return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
      }
      updates.title = trimmed
    }

    if (typeof body.description === "string") {
      updates.description = body.description.trim() || null
    } else if (body.description === null) {
      updates.description = null
    }

    if (body.status === "draft" || body.status === "published") {
      updates.status = body.status
      if (body.status === "published" && playlist.status !== "published") {
        updates.published_at = new Date().toISOString()
      } else if (body.status === "draft" && playlist.status !== "draft") {
        updates.published_at = null
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("community_playlists")
        .update(updates)
        .eq("id", playlistId)
        .eq("owner_id", user.id)

      if (updateError) {
        console.error("[Playlists API] Failed to update playlist:", updateError)
        return NextResponse.json({ error: "Failed to update playlist" }, { status: 500 })
      }
    }

    const incomingItems = Array.isArray(body.items) ? body.items : null

    if (incomingItems) {
      const validationResult = await validateAndPrepareItems({
        supabase,
        communityId: playlist.community_id,
        playlistId,
        items: incomingItems,
      })

      if (!validationResult.success) {
        return NextResponse.json({ error: validationResult.error }, { status: validationResult.status ?? 400 })
      }

      const { data: existingItems, error: existingItemsError } = await supabase
        .from("community_playlist_items")
        .select("playlist_id, event_recording_id, uploaded_video_id, position")
        .eq("playlist_id", playlistId)
        .order("position", { ascending: true })

      if (existingItemsError) {
        console.error("[Playlists API] Failed to fetch current playlist items:", existingItemsError)
        return NextResponse.json({ error: "Unable to update playlist items" }, { status: 500 })
      }

      const { error: deleteError } = await supabase.from("community_playlist_items").delete().eq("playlist_id", playlistId)

      if (deleteError) {
        console.error("[Playlists API] Failed to remove existing items:", deleteError)
        return NextResponse.json({ error: "Unable to update playlist items" }, { status: 500 })
      }

      if (validationResult.items.length > 0) {
        const { error: insertError } = await supabase
          .from("community_playlist_items")
          .insert(validationResult.items)

        if (insertError) {
          console.error("[Playlists API] Failed to insert new playlist items:", insertError)

          if (existingItems && existingItems.length > 0) {
            const { error: rollbackError } = await supabase
              .from("community_playlist_items")
              .insert(existingItems.map((item) => ({ ...item, playlist_id: playlistId })))

            if (rollbackError) {
              console.error("[Playlists API] Failed to restore previous playlist items:", rollbackError)
            }
          }

          return NextResponse.json({ error: "Playlist updated but items failed to save" }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Playlists API] Unexpected error during update:", error)
    return NextResponse.json({ error: error?.message || "Unexpected error while updating playlist" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ playlistId: string }> | { playlistId: string } },
) {
  const params = await Promise.resolve(context.params)
  const playlistId = typeof params?.playlistId === "string" ? params.playlistId : undefined

  if (!playlistId) {
    return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 })
  }

  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: playlist, error: playlistError } = await supabase
      .from("community_playlists")
      .select("id, owner_id")
      .eq("id", playlistId)
      .maybeSingle()

    if (playlistError && playlistError.code !== "PGRST116") {
      console.error("[Playlists API] Failed to load playlist:", playlistError)
      return NextResponse.json({ error: "Failed to load playlist" }, { status: 500 })
    }

    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 })
    }

    if (playlist.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the community owner can delete playlists" }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from("community_playlists")
      .delete()
      .eq("id", playlistId)
      .eq("owner_id", user.id)

    if (deleteError) {
      console.error("[Playlists API] Failed to delete playlist:", deleteError)
      return NextResponse.json({ error: "Failed to delete playlist" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Playlists API] Unexpected error during deletion:", error)
    return NextResponse.json({ error: error?.message || "Unexpected error while deleting playlist" }, { status: 500 })
  }
}


