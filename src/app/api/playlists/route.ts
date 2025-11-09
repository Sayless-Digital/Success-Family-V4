import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { validateAndPrepareItems, type PlaylistItemInput } from "./utils"

interface CreatePlaylistBody {
  communityId?: string
  title?: string
  description?: string | null
  status?: "draft" | "published"
  items?: PlaylistItemInput[]
}

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

    const body = (await request.json()) as CreatePlaylistBody
    const communityId = body.communityId?.trim()
    const title = body.title?.trim()

    if (!communityId || !title) {
      return NextResponse.json({ error: "communityId and title are required" }, { status: 400 })
    }

    const { data: community, error: communityError } = await supabase
      .from("communities")
      .select("id, owner_id")
      .eq("id", communityId)
      .single()

    if (communityError || !community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 })
    }

    if (community.owner_id !== user.id) {
      return NextResponse.json({ error: "Only the community owner can manage playlists" }, { status: 403 })
    }

    const status = body.status === "published" ? "published" : "draft"
    const publishedAt = status === "published" ? new Date().toISOString() : null

    const { data: playlist, error: createError } = await supabase
      .from("community_playlists")
      .insert({
        community_id: community.id,
        owner_id: user.id,
        title,
        description: body.description?.trim() || null,
        status,
        published_at: publishedAt,
      })
      .select()
      .single()

    if (createError || !playlist) {
      console.error("[Playlists API] Failed to create playlist:", createError)
      return NextResponse.json({ error: "Failed to create playlist" }, { status: 500 })
    }

    const validationItems = Array.isArray(body.items) ? body.items : []

    if (validationItems.length > 0) {
      const validationResult = await validateAndPrepareItems({
        supabase,
        communityId: community.id,
        playlistId: playlist.id,
        items: validationItems,
      })

      if (!validationResult.success) {
        return NextResponse.json({ error: validationResult.error }, { status: validationResult.status ?? 400 })
      }

      if (validationResult.items.length > 0) {
        const { error: insertItemsError } = await supabase
          .from("community_playlist_items")
          .insert(validationResult.items)

        if (insertItemsError) {
          console.error("[Playlists API] Failed to insert playlist items:", insertItemsError)
          return NextResponse.json({ error: "Playlist created but items failed to save" }, { status: 500 })
        }
      }
    }

    return NextResponse.json({
      success: true,
      playlistId: playlist.id,
    })
  } catch (error: any) {
    console.error("[Playlists API] Unexpected error:", error)
    return NextResponse.json(
      { error: error?.message || "Unexpected error while creating playlist" },
      { status: 500 },
    )
  }
}


