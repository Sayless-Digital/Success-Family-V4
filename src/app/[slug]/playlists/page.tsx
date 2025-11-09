import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import type { UploadedVideo } from "@/types"
import type { PlaylistWithItems } from "./types"
import CommunityPlaylistsView from "./playlists-view"
import { TopUpGuard } from "@/components/topup-guard"

interface CommunityPlaylistsPageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function CommunityPlaylistsPage({ params }: CommunityPlaylistsPageProps) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: community, error: communityError } = await supabase
    .from("communities")
    .select(
      `
      id,
      name,
      slug,
      description,
      owner_id,
      is_active,
      created_at,
      updated_at,
      owner:users!communities_owner_id_fkey(id, username, first_name, last_name, profile_picture)
    `,
    )
    .eq("slug", slug)
    .single()

  if (communityError || !community) {
    notFound()
  }

  const {
    data: playlists,
    error: playlistsError,
  } = await supabase
    .from("community_playlists")
    .select(
      `
      id,
      community_id,
      owner_id,
      title,
      description,
      status,
      published_at,
      created_at,
      updated_at,
      items:community_playlist_items(
        id,
        playlist_id,
        event_recording_id,
        uploaded_video_id,
        position,
        created_at,
        event_recording:event_recordings(
          id,
          event_id,
          community_id,
          stream_recording_id,
          post_id,
          title,
          description,
          storage_url,
          storage_path,
          stream_recording_url,
          file_size_bytes,
          duration_seconds,
          started_at,
          ended_at,
          is_processing,
          created_at,
          saved_at
        ),
        uploaded_video:uploaded_videos(
          id,
          community_id,
          user_id,
          title,
          description,
          storage_url,
          storage_path,
          file_size_bytes,
          duration_seconds,
          created_at,
          uploader:users!uploaded_videos_user_id_fkey(
            id,
            username,
            first_name,
            last_name
          )
        )
      )
    `,
    )
    .eq("community_id", community.id)
    .order("created_at", { ascending: false })
    .order("position", { foreignTable: "community_playlist_items", ascending: true })

  if (playlistsError) {
    console.error("[Playlists Page] Failed to fetch playlists:", playlistsError)
  }

  const { data: recordings, error: recordingsError } = await supabase
    .from("event_recordings")
    .select(
      `
      *,
      event:community_events(
        id,
        scheduled_at,
        started_at,
        ended_at,
        description,
        owner:users!community_events_owner_id_fkey(
          id,
          username,
          first_name,
          last_name
        )
      )
    `,
    )
    .eq("community_id", community.id)
    .order("created_at", { ascending: false })

  if (recordingsError) {
    console.error("[Playlists Page] Failed to fetch recordings:", recordingsError)
  }

  const normalizedPlaylists: PlaylistWithItems[] = (playlists ?? []).map((playlist) => {
    const items = Array.isArray(playlist.items) ? playlist.items : []

    return {
      ...playlist,
      items: items.map((item) => {
        const eventRecording = Array.isArray(item.event_recording)
          ? item.event_recording[0] ?? null
          : item.event_recording ?? null
        const uploadedVideo = Array.isArray(item.uploaded_video)
          ? item.uploaded_video[0] ?? null
          : item.uploaded_video ?? null
        const normalizedUploadedVideo = uploadedVideo
          ? {
              ...uploadedVideo,
              uploader: Array.isArray(uploadedVideo.uploader)
                ? uploadedVideo.uploader[0] ?? null
                : uploadedVideo.uploader ?? null,
            }
          : null

        return {
          ...item,
          event_recording: eventRecording,
          uploaded_video: normalizedUploadedVideo,
        }
      }),
    }
  }) as unknown as PlaylistWithItems[]

  let uploadedVideos: UploadedVideo[] = []
  const { data: uploads, error: uploadsError } = await supabase
    .from("uploaded_videos")
    .select(
      `
      id,
      community_id,
      user_id,
      title,
      description,
      storage_path,
      storage_url,
      duration_seconds,
      file_size_bytes,
      created_at,
      updated_at,
      uploader:users!uploaded_videos_user_id_fkey(
        id,
        username,
        first_name,
        last_name
      )
    `,
    )
    .eq("community_id", community.id)
    .order("created_at", { ascending: false })

  if (uploadsError) {
    if (uploadsError.code === "42P01") {
      console.warn("[Playlists Page] uploaded_videos table not found. Migration might be pending.")
    } else {
      console.error("[Playlists Page] Failed to fetch uploaded videos:", uploadsError)
    }
  } else if (uploads) {
    uploadedVideos = uploads.map((upload) => {
      const uploader = Array.isArray(upload.uploader) ? upload.uploader[0] ?? null : upload.uploader ?? null
      return {
        ...upload,
        uploader,
      }
    }) as UploadedVideo[]
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isOwner = false
  let isMember = false

  if (user) {
    isOwner = community.owner_id === user.id

    const { data: membership } = await supabase
      .from("community_members")
      .select("id")
      .eq("community_id", community.id)
      .eq("user_id", user.id)
      .maybeSingle()

    isMember = !!membership
  }

  if (!isOwner && !isMember) {
    notFound()
  }

  return (
    <TopUpGuard communitySlug={slug}>
      <CommunityPlaylistsView
        community={community}
        playlists={normalizedPlaylists}
        recordings={recordings ?? []}
        uploadedVideos={uploadedVideos}
        isOwner={isOwner}
        isMember={isMember}
        currentUserId={user?.id}
      />
    </TopUpGuard>
  )
}

