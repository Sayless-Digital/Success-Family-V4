import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types"

export type PlaylistItemInput = {
  sourceType: "recording" | "upload"
  sourceId: string
  position?: number
}

interface ValidateParams {
  supabase: SupabaseClient<Database>
  communityId: string
  playlistId: string
  items: PlaylistItemInput[]
}

type PreparedItem = {
  playlist_id: string
  event_recording_id?: string | null
  uploaded_video_id?: string | null
  position: number
}

export async function validateAndPrepareItems({
  supabase,
  communityId,
  playlistId,
  items,
}: ValidateParams): Promise<
  | { success: true; items: PreparedItem[] }
  | { success: false; error: string; status?: number }
> {
  if (!items.length) {
    return { success: true, items: [] }
  }

  const normalized = items
    .map((item, index) => ({
      sourceType: item.sourceType,
      sourceId: item.sourceId?.trim(),
      position: Number.isFinite(item.position) ? Number(item.position) : index,
    }))
    .filter((item) => item.sourceId)

  if (!normalized.length) {
    return { success: false, error: "Playlist items must include valid source IDs", status: 400 }
  }

  const recordingIds = normalized.filter((item) => item.sourceType === "recording").map((item) => item.sourceId)
  const uploadIds = normalized.filter((item) => item.sourceType === "upload").map((item) => item.sourceId)

  if (recordingIds.length > 0) {
    const { data: recordings, error: recordingsError } = await supabase
      .from("event_recordings")
      .select("id")
      .eq("community_id", communityId)
      .in("id", recordingIds)

    if (recordingsError) {
      console.error("[Playlists API] Failed to validate recordings:", recordingsError)
      return { success: false, error: "Unable to validate recordings", status: 500 }
    }

    if ((recordings?.length ?? 0) !== new Set(recordingIds).size) {
      return { success: false, error: "One or more recordings are invalid for this community" }
    }
  }

  if (uploadIds.length > 0) {
    const { data: uploads, error: uploadsError } = await supabase
      .from("uploaded_videos")
      .select("id")
      .eq("community_id", communityId)
      .in("id", uploadIds)

    if (uploadsError) {
      console.error("[Playlists API] Failed to validate uploads:", uploadsError)
      return { success: false, error: "Unable to validate uploaded videos", status: 500 }
    }

    if ((uploads?.length ?? 0) !== new Set(uploadIds).size) {
      return { success: false, error: "One or more uploaded videos are invalid for this community" }
    }
  }

  const prepared = normalized.map((item, index) => ({
    playlist_id: playlistId,
    event_recording_id: item.sourceType === "recording" ? item.sourceId : null,
    uploaded_video_id: item.sourceType === "upload" ? item.sourceId : null,
    position: index,
  }))

  return { success: true, items: prepared }
}






